// utils/notifyNewOffer.js
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
// import twilio from "twilio";  // enable once credentials added

export const notifyNewOffer = async (offer, bidId, shopId, price, note) => {
  try {
    // Fetch customer from bid
    const bid = await Bid.findById(bidId).select("user_id serviceDescription requestCategory");
    if (!bid) {
      console.log("⚠️ Bid not found (notifyNewOffer)");
      return;
    }

    const customer = await Customer.findById(bid.user_id).select("name email phone");
    if (!customer) {
      console.log("⚠️ Customer not found (notifyNewOffer)");
      return;
    }

    // Fetch shop
    const shop = await Shop.findById(shopId).select("businessName ownerName");
    if (!shop) {
      console.log("⚠️ Shop not found (notifyNewOffer)");
      return;
    }

    // Email subject
    const subject = `${shop.businessName} submitted a new offer`;

    // Build HTML email
    const html = `
      <h2>New Offer Received</h2>

      <p><strong>Shop:</strong> ${shop.businessName} (${shop.ownerName})</p>
      <p><strong>Offer Price:</strong> $${price}</p>
      <p><strong>Message:</strong> ${note || "No message provided"}</p>

      <h3>Bid Information:</h3>
      <p><strong>Category:</strong> ${bid.requestCategory}</p>
      <p><strong>Description:</strong> ${bid.serviceDescription}</p>

      <hr />
      <p>Please log in to your dashboard to view and respond to the offer.</p>
    `;

    // ✉️ EMAIL to customer
    await sendEmail(customer.email, subject, html);
    console.log("📧 New offer email sent to customer:", customer.email);

    // -------------------------------------------------------------
    // -------------- SMS via Twilio (optional) ---------------------
    /*
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    if (customer.phone) {
      const smsText = `
A new offer has been submitted!

Shop: ${shop.businessName}
Offer Price: $${price}

Check your dashboard to view details.
      `;

      await client.messages.create({
        body: smsText,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: customer.phone,
      });

      console.log("📱 SMS sent to customer:", customer.phone);
    }
    */
    // -------------------------------------------------------------

  } catch (err) {
    console.error("❌ Error notifying customer about new offer:", err);
  }
};
