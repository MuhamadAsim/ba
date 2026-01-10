// import Stripe from "stripe";
// import Shop from "../models/shopModel.js";

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// export const stripeWebhookHandler = async (req, res) => {
//   const sig = req.headers["stripe-signature"];
//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(
//       req.body,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET
//     );
//   } catch (err) {
//     console.error("❌ Webhook signature verification failed:", err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   try {
//     const object = event.data?.object;
//     if (!object) return res.json({ received: true });

//     // Find shop
//     let shop = null;
//     const shopId = object.metadata?.shopId || object.lines?.data?.[0]?.metadata?.shopId;
//     if (shopId) shop = await Shop.findById(shopId);
//     if (!shop && object.subscription) shop = await Shop.findOne({ stripeSubscriptionId: object.subscription });
//     if (!shop && object.id?.startsWith("sub_")) shop = await Shop.findOne({ stripeSubscriptionId: object.id });
//     if (!shop && object.customer) shop = await Shop.findOne({ stripeCustomerId: object.customer });

//     if (!shop) {
//       console.warn("⚠️ Shop not found for event:", event.type);
//       return res.json({ received: true });
//     }

//     const now = new Date();
//     const trialEnd = shop.currentSubscription?.trialEnd ? new Date(shop.currentSubscription.trialEnd) : null;
//     const isTrial = trialEnd && now < trialEnd;

//     switch (event.type) {
//       case "customer.subscription.created":
//       case "customer.subscription.updated":
//         await shop.updateSubscriptionFromStripe(object);

//         if (shop.currentSubscription?.trialEnd) {
//           shop.currentSubscription.daysRemaining = Math.max(
//             0,
//             Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
//           );
//           shop.currentSubscription.isTrial = now < trialEnd;
//         }

//         await shop.save();
//         break;

//       case "customer.subscription.deleted":
//         // Map Stripe canceled → valid enum
//         shop.subscriptionStatus = isTrial ? "trial_canceled" : "inactive";

//         if (shop.currentSubscription) {
//           shop.currentSubscription.cancelAtPeriodEnd = false;
//           shop.currentSubscription.currentPeriodEnd = now;
//           shop.currentSubscription.daysRemaining = 0;
//           shop.currentSubscription.isTrial = false;
//         }

//         shop.stripeSubscriptionId = null;
//         await shop.save();
//         break;

//       default:
//         break; // Ignore other events
//     }

//     return res.json({ received: true });
//   } catch (err) {
//     console.error("❌ Stripe webhook processing error:", err);
//     return res.status(500).send("Webhook processing failed");
//   }
// };







import Stripe from "stripe";
import Shop from "../models/shopModel.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Stripe Webhook – SINGLE SOURCE OF TRUTH
 * Handles:
 * - Trials
 * - Subscription lifecycle
 * - Payment success/failure
 * - Grace periods
 * - Final cancellation
 */
export const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  // 1️⃣ Verify webhook signature
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const object = event.data?.object;
    if (!object) return res.json({ received: true });

    // 2️⃣ Resolve shop (robust lookup)
    let shop = null;

    const shopId =
      object.metadata?.shopId ||
      object.lines?.data?.[0]?.metadata?.shopId;

    if (shopId) shop = await Shop.findById(shopId);
    if (!shop && object.subscription)
      shop = await Shop.findOne({ stripeSubscriptionId: object.subscription });
    if (!shop && object.id?.startsWith("sub_"))
      shop = await Shop.findOne({ stripeSubscriptionId: object.id });
    if (!shop && object.customer)
      shop = await Shop.findOne({ stripeCustomerId: object.customer });

    if (!shop) {
      console.warn("⚠️ Shop not found for event:", event.type);
      return res.json({ received: true });
    }

    const now = new Date();

    // Helper: recompute trial state
    const recomputeTrial = () => {
      if (!shop.currentSubscription?.trialEnd) return;

      const trialEnd = new Date(shop.currentSubscription.trialEnd);
      shop.currentSubscription.isTrial = now < trialEnd;
      shop.currentSubscription.daysRemaining = Math.max(
        0,
        Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
      );
    };

    // 3️⃣ Handle events
    switch (event.type) {

      /**
       * ================================
       * SUBSCRIPTION EVENTS
       * ================================
       */

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        // Sync EVERYTHING from Stripe (plan, trial, period, cancel flags)
        await shop.updateSubscriptionFromStripe(object);

        recomputeTrial();

        await shop.save();
        break;
      }

      case "customer.subscription.deleted": {
        const trialEnd = shop.currentSubscription?.trialEnd
          ? new Date(shop.currentSubscription.trialEnd)
          : null;

        const trialStillValid = trialEnd && now < trialEnd;

        shop.subscriptionStatus = trialStillValid
          ? "trial_canceled"
          : "inactive";

        if (shop.currentSubscription) {
          shop.currentSubscription.cancelAtPeriodEnd = false;
          shop.currentSubscription.currentPeriodEnd = now;
          shop.currentSubscription.isTrial = false;
          shop.currentSubscription.daysRemaining = 0;
        }

        shop.stripeSubscriptionId = null;
        await shop.save();
        break;
      }

      /**
       * ================================
       * PAYMENT / BILLING EVENTS
       * ================================
       */

      case "invoice.payment_failed": {
        // Card failed — Stripe will retry automatically
        shop.subscriptionStatus = "past_due";
        await shop.save();
        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.paid": {
        // Payment successful
        shop.subscriptionStatus = "active";
        shop.lastPaidAt = now;

        recomputeTrial();

        await shop.save();
        break;
      }

      case "invoice.finalized": {
        // Invoice created – no state change required
        break;
      }

      default:
        break; // Ignore other events
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("❌ Stripe webhook processing error:", err);
    return res.status(500).send("Webhook processing failed");
  }
};
