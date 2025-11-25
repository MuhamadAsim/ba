// utils/notifyCounterOffer.js
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/BidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
// import twilio from "twilio"; // commented until Twilio keys available

export const notifyCounterOffer = async (offer, counterData) => {
  try {
    const shopId = offer.shopId;
    const customerId = offer.bidId.user_id;

    // Fetch shop
    const shop = await Shop.findById(shopId).select("email phone businessName ownerName");
    if (!shop) {
      console.log("⚠️ Shop not found for counter offer notification");
      return;
    }

    // Fetch customer
    const customer = await Customer.findById(customerId).select("name email");
    const customerName = customer?.name || "Customer";

    // Prepare email subject
    const subject = `${customerName} submitted a counter offer`;

    // Build HTML
    const html = `
      <h2>${customerName} just sent a counter offer</h2>

      <h3>Counter Offer Details</h3>
      <p><strong>Original Offer Price:</strong> $${offer.price}</p>
      <p><strong>Counter Price:</strong> $${counterData.counterPrice}</p>
      <p><strong>Message:</strong> ${counterData.message || "No message provided"}</p>

      <h3>Bid Information</h3>
      <p><strong>Category:</strong> ${offer.bidId.requestCategory}</p>
      <p><strong>Description:</strong> ${offer.bidId.serviceDescription}</p>
      <p><strong>Vehicle:</strong> ${offer.bidId.vehicleYear} ${offer.bidId.vehicleMake} ${offer.bidId.vehicleModel} ${offer.bidId.vehicleTrim}</p>

      <hr/>
      <p>This counter-offer is sent to <strong>${shop.businessName}</strong>.</p>
    `;

    // ---------------------- EMAIL ----------------------
    await sendEmail(shop.email, subject, html);
    console.log("📧 Counter offer email sent to shop:", shop.email);

    // -------------------------------------------------------------
    // --------------- TWILIO SMS (COMMENTED OUT) -------------------
    /*
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    const smsText = `
${customerName} submitted a counter offer!

Original Offer: $${offer.price}
Counter Price: $${counterData.counterPrice}
Message: ${counterData.message}

Check your dashboard for details.
    `;

    if (shop.phone) {
      await client.messages.create({
        body: smsText,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: shop.phone,
      });

      console.log("📱 SMS sent to shop:", shop.phone);
    }
    */
    // -------------------------------------------------------------

  } catch (err) {
    console.error("❌ Error notifying shop about counter offer:", err);
  }
};
