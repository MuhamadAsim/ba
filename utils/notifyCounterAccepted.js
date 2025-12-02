// utils/notifyCounterAccepted.js
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
// import twilio from "twilio";  // enable later

export const notifyCounterAccepted = async (offer, counterOffer, shopId, bidId) => {
  try {
    // Fetch bid
    const bid = await Bid.findById(bidId).select(
      "user_id serviceDescription requestCategory"
    );

    if (!bid) {
      console.log("⚠️ Bid not found (notifyCounterAccepted)");
      return;
    }

    // Fetch customer
    const customer = await Customer.findById(bid.user_id).select(
      "name email phone"
    );

    if (!customer) {
      console.log("⚠️ Customer not found (notifyCounterAccepted)");
      return;
    }

    // Fetch shop
    const shop = await Shop.findById(shopId).select(
      "businessName ownerName"
    );

    if (!shop) {
      console.log("⚠️ Shop not found (notifyCounterAccepted)");
      return;
    }

    const customerName = customer?.name || "Customer";

    // Email subject
    const subject = `${shop.businessName} accepted your counter offer!`;

    // Email HTML
    const html = `
      <h2>Your Counter Offer Was Accepted 🎉</h2>

      <p><strong>Shop:</strong> ${shop.businessName} (${shop.ownerName})</p>
      <p><strong>Accepted Price:</strong> $${counterOffer.counterPrice}</p>

      <h3>Bid Information</h3>
      <p><strong>Category:</strong> ${bid.requestCategory}</p>
      <p><strong>Description:</strong> ${bid.serviceDescription}</p>

      <hr />
      <p>Your bid is now marked as <strong>In Progress</strong>.</p>
    `;

    // ✉️ Send email
    await sendEmail(customer.email, subject, html);
    console.log("📧 Counter-accepted email sent to:", customer.email);

    // -------------------------------------------------------
    // --------- TWILIO SMS (OPTIONAL, commented) -------------
    /*
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    if (customer.phone) {
      const smsText = `
Great news!
${shop.businessName} accepted your counter offer.

Accepted Price: $${counterOffer.counterPrice}

Your bid is now in progress.
      `;

      await client.messages.create({
        body: smsText,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: customer.phone,
      });

      console.log("📱 SMS sent to customer:", customer.phone);
    }
    */
    // -------------------------------------------------------

  } catch (err) {
    console.error("❌ Error notifying customer about counter acceptance:", err);
  }
};
