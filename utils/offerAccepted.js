import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
// import twilio from "twilio"; // Twilio commented out until keys available

export const offerAccepted = async ({ shopId, customerId, subject, message, bid, offer }) => {
  try {
    // Fetch shop
    const shop = await Shop.findById(shopId).select("email phone businessName ownerName");
    if (!shop) {
      console.log("⚠️ Shop not found for notification");
      return;
    }

    // Fetch customer (optional)
    const customer = await Customer.findById(customerId).select("name email");
    const customerName = customer?.name || "Customer";

    // Build HTML Email
    const html = `
      <h2>${subject}</h2>

      <h3>Details</h3>
      <p><strong>Message:</strong> ${message}</p>

      ${offer ? `<p><strong>Offer Price:</strong> $${offer.price}</p>` : ""}

      ${bid ? `
        <h3>Bid Information</h3>
        <p><strong>Category:</strong> ${bid.requestCategory}</p>
        <p><strong>Description:</strong> ${bid.serviceDescription}</p>
        <p><strong>Vehicle:</strong> ${bid.vehicleYear} ${bid.vehicleMake} ${bid.vehicleModel} ${bid.vehicleTrim}</p>
      ` : ""}

      <hr/>
      <p>This notification is sent to <strong>${shop.businessName}</strong>.</p>
    `;

    // ---------------------- SENDGRID EMAIL ----------------------
    await sendEmail(shop.email, subject, html);
    console.log("📧 Email sent to shop:", shop.email);

    // -------------------------------------------------------------
    // ----------------- TWILIO SMS (COMMENTED OUT) ----------------
    /*
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    const smsText = `
${subject}

${message}

${offer ? `Offer: $${offer.price}` : ""}
${bid ? `Category: ${bid.requestCategory}` : ""}
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
    console.error("❌ Error notifying shop:", err);
  }
};