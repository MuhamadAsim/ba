import Stripe from "stripe";
import Shop from "../models/shopModel.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * ⚠️ IMPORTANT
 * Route MUST use:
 * express.raw({ type: "application/json" })
 */
export const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Stripe signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const object = event.data?.object;
    if (!object) return res.json({ received: true });

    // 🔎 Resolve shop (Stripe = source of truth)
    let shop = null;

    if (object.subscription) {
      shop = await Shop.findOne({ stripeSubscriptionId: object.subscription });
    } else if (object.id?.startsWith("sub_")) {
      shop = await Shop.findOne({ stripeSubscriptionId: object.id });
    } else if (object.customer) {
      shop = await Shop.findOne({ stripeCustomerId: object.customer });
    }

    if (!shop) {
      console.warn("⚠️ Shop not found:", event.type, object.id);
      return res.json({ received: true });
    }

    switch (event.type) {
      /**
       * 🔁 Subscription created / updated
       */
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = object;

        await shop.syncStripeSubscription(subscription);

        // 🔄 Reset bids only on new billing cycle
        const periodStart = new Date(subscription.current_period_start * 1000);
        if (
          !shop.bidUsage?.periodStart ||
          shop.bidUsage.periodStart.getTime() !== periodStart.getTime()
        ) {
          shop.bidUsage = {
            usedThisPeriod: 0,
            periodStart,
            periodEnd: new Date(subscription.current_period_end * 1000),
          };
        }

        await shop.save();
        break;
      }

      /**
       * 💳 Invoice paid → subscription is healthy
       */
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        if (object.subscription) {
          const sub = await stripe.subscriptions.retrieve(object.subscription);
          shop.subscriptionStatus = sub.status;

          const period = object.lines?.data?.[0]?.period;
          if (period) {
            const periodStart = new Date(period.start * 1000);
            if (
              !shop.bidUsage?.periodStart ||
              shop.bidUsage.periodStart.getTime() !== periodStart.getTime()
            ) {
              shop.bidUsage = {
                usedThisPeriod: 0,
                periodStart,
                periodEnd: new Date(period.end * 1000),
              };
            }
          }

          await shop.save();
        }
        break;
      }

      /**
       * ❌ Payment failed
       */
      case "invoice.payment_failed": {
        shop.subscriptionStatus = "past_due";
        await shop.save();
        break;
      }

      /**
       * 🛑 Subscription fully ended
       */
      case "customer.subscription.deleted": {
        shop.subscriptionStatus = "canceled";
        shop.plan = null;
        shop.stripeSubscriptionId = null;

        shop.currentSubscription = {
          ...shop.currentSubscription,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date(),
        };

        await shop.save();
        break;
      }

      default:
        console.log("ℹ️ Unhandled Stripe event:", event.type);
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook processing failed:", err);
    return res.status(500).send("Webhook processing failed");
  }
};









// import Stripe from "stripe";
// import Shop from "../models/shopModel.js";

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// /**
//  * Stripe Webhook – SINGLE SOURCE OF TRUTH
//  */
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
//     console.error("❌ Stripe signature error:", err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   try {
//     const object = event.data?.object;
//     if (!object) return res.json({ received: true });

//     // 1️⃣ Resolve shop (Stripe is source of truth)
//     let shop = null;

//     if (object.subscription) {
//       shop = await Shop.findOne({ stripeSubscriptionId: object.subscription });
//     } else if (object.id?.startsWith("sub_")) {
//       shop = await Shop.findOne({ stripeSubscriptionId: object.id });
//     } else if (object.customer) {
//       shop = await Shop.findOne({ stripeCustomerId: object.customer });
//     }

//     if (!shop) {
//       console.warn("⚠️ Shop not found for event:", event.type, object.id);
//       return res.json({ received: true });
//     }

//     // 2️⃣ Handle subscription events
//     switch (event.type) {
//       case "customer.subscription.created":
//       case "customer.subscription.updated": {
//         const subscription = object;

//         // Sync subscription snapshot
//         await shop.syncStripeSubscription(subscription);

//         // Only reset bids if new billing period started
//         const currentPeriodStart = new Date(subscription.current_period_start * 1000);
//         if (!shop.bidUsage?.periodStart || shop.bidUsage.periodStart.getTime() !== currentPeriodStart.getTime()) {
//           shop.bidUsage = {
//             usedThisPeriod: 0,
//             periodStart: currentPeriodStart,
//             periodEnd: new Date(subscription.current_period_end * 1000),
//           };
//         }

//         await shop.save();
//         break;
//       }

//       case "customer.subscription.deleted": {
//         shop.subscriptionStatus = "canceled";
//         // Keep subscription ID for history
//         if (shop.currentSubscription) {
//           shop.currentSubscription.currentPeriodEnd = new Date();
//           shop.currentSubscription.cancelAtPeriodEnd = false;
//         }
//         await shop.save();
//         break;
//       }

//       case "invoice.payment_failed": {
//         shop.subscriptionStatus = "past_due";
//         await shop.save();
//         break;
//       }

//       case "invoice.paid":
//       case "invoice.payment_succeeded": {
//         shop.subscriptionStatus = "active";

//         if (object.lines?.data?.[0]?.period) {
//           const period = object.lines.data[0].period;
//           const periodStart = new Date(period.start * 1000);
//           if (!shop.bidUsage?.periodStart || shop.bidUsage.periodStart.getTime() !== periodStart.getTime()) {
//             shop.bidUsage = {
//               usedThisPeriod: 0,
//               periodStart,
//               periodEnd: new Date(period.end * 1000),
//             };
//           }
//         }

//         await shop.save();
//         break;
//       }

//       default:
//         console.log("Unhandled Stripe event type:", event.type);
//         break;
//     }

//     return res.json({ received: true });
//   } catch (err) {
//     console.error("❌ Webhook processing failed:", err);
//     return res.status(500).send("Webhook processing failed");
//   }
// };
