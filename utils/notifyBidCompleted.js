// utils/notifyBidCompleted.js
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
// import twilio from "twilio"; // Enable later

export const notifyBidCompleted = async (shopId, bidId) => {
  try {
    // Fetch shop
    const shop = await Shop.findById(shopId).select("businessName ownerName");
    if (!shop) {
      console.log("⚠️ Shop not found (notifyBidCompleted)");
      return;
    }

    // Fetch bid details
    const bid = await Bid.findById(bidId).select(
      "user_id serviceDescription requestCategory vehicleYear vehicleMake vehicleModel vehicleTrim"
    );
    if (!bid) {
      console.log("⚠️ Bid not found (notifyBidCompleted)");
      return;
    }

    // Fetch customer
    const customer = await Customer.findById(bid.user_id).select(
      "name email phone"
    );
    if (!customer) {
      console.log("⚠️ Customer not found (notifyBidCompleted)");
      return;
    }

    const customerName = customer?.name || "Customer";

    // Email subject
    const subject = `Your bid has been marked as completed by ${shop.businessName}`;

    // HTML Email
    const html = `
      <h2>Your Bid Has Been Completed 🎉</h2>

      <p><strong>Shop:</strong> ${shop.businessName} (${shop.ownerName})</p>

      <h3>Bid Details</h3>
      <p><strong>Category:</strong> ${bid.requestCategory}</p>
      <p><strong>Description:</strong> ${bid.serviceDescription}</p>
      <p><strong>Vehicle:</strong> ${bid.vehicleYear} ${bid.vehicleMake} ${bid.vehicleModel} ${bid.vehicleTrim}</p>

      <hr/>
      <p>Your job is now marked as <strong>Completed</strong>.</p>
      <p>If something is incorrect, please contact support or the shop directly.</p>
    `;

    // ✉️ Send Email
    await sendEmail(customer.email, subject, html);
    console.log("📧 Bid completion email sent to:", customer.email);

    // ---------------------------------------------------
    // --------------- TWILIO SMS (commented) -------------
    /*
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    if (customer.phone) {
      const smsText = `
Your bid has been marked as completed by ${shop.businessName}.

Category: ${bid.requestCategory}
Description: ${bid.serviceDescription}

Thank you for using our service!
      `;

      await client.messages.create({
        body: smsText,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: customer.phone,
      });

      console.log("📱 SMS sent to customer:", customer.phone);
    }
    */
    // ---------------------------------------------------

  } catch (err) {
    console.error("❌ Error sending bid completion notification:", err);
  }
};
