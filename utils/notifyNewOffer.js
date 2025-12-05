// utils/notifyNewOffer.js
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio"; // enable only when credentials are added

export const notifyNewOffer = async (offer, bidId, shopId, price, note) => {
  try {
    // ------------------------------------
    // 1) Fetch Bid
    // ------------------------------------
    const bid = await Bid.findById(bidId).select(
      "user_id serviceDescription requestCategory"
    );

    if (!bid) {
      console.log("⚠️ notifyNewOffer: Bid not found");
      return;
    }

    // ------------------------------------
    // 2) Fetch Customer From Bid
    // ------------------------------------
    const customer = await Customer.findById(bid.user_id).select(
      "name email phone"
    );

    if (!customer) {
      console.log("⚠️ notifyNewOffer: Customer not found");
      return;
    }

    // ------------------------------------
    // 3) Fetch Shop
    // ------------------------------------
    const shop = await Shop.findById(shopId).select(
      "businessName ownerName"
    );

    if (!shop) {
      console.log("⚠️ notifyNewOffer: Shop not found");
      return;
    }

    // ------------------------------------
    // 4) Email Subject
    // ------------------------------------
    const subject = `${shop.businessName} submitted a new offer on your request`;

    // ------------------------------------
    // 5) Email Body (HTML)
    // ------------------------------------
    const html = `
      <h2>🎉 You Received a New Offer!</h2>

      <p><strong>Shop:</strong> ${shop.businessName} (${shop.ownerName})</p>
      <p><strong>Offer Price:</strong> $${price || offer?.price}</p>
      <p><strong>Message:</strong> ${note || offer?.note || "No message provided"}</p>

      <h3>Request Details:</h3>
      <p><strong>Category:</strong> ${bid.requestCategory}</p>
      <p><strong>Description:</strong> ${bid.serviceDescription}</p>

      <hr />
      <p>Login to your dashboard to view more details and respond to the offer.</p>
    `;

    // ------------------------------------
    // 6) Send Email to Customer
    // ------------------------------------
    await sendEmail(customer.email, subject, html);

    console.log(`📧 Email sent to customer (${customer.email})`);


    // -------------------------------------------------------------
    // OPTIONAL: SMS NOTIFICATION (Twilio)
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    if (customer.phone) {
      const smsText = `
New Offer Received!

Shop: ${shop.businessName}
Price: $${price}

Check your dashboard for full details.
      `;

      await client.messages.create({
        body: smsText,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: customer.phone,
      });

      console.log("📱 SMS sent to:", customer.phone);
    }
    // -------------------------------------------------------------

  } catch (err) {
    console.error("❌ notifyNewOffer FAILED:", err.message);
  }
};
