// utils/notifyBidCompleted.js
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";

export const notifyBidCompleted = async (shopId, bidId) => {
  try {
    // Fetch shop
    const shop = await Shop.findById(shopId).select("businessName ownerName");
    if (!shop) return console.log("⚠️ Shop not found");

    // Fetch bid (now includes contactMethod)
    const bid = await Bid.findById(bidId).select(
      "user_id contactMethod serviceDescription requestCategory vehicleYear vehicleMake vehicleModel vehicleTrim"
    );
    if (!bid) return console.log("⚠️ Bid not found");

    // Fetch customer
    const customer = await Customer.findById(bid.user_id).select(
      "name email phone"
    );
    if (!customer) return console.log("⚠️ Customer not found");

    const subject = `Your bid has been marked as completed by ${shop.businessName}`;

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

    // -----------------------------
    // 🔥 NOTIFICATION LOGIC BEGINS
    // -----------------------------

    const method = bid.contactMethod || "email";

    // Send EMAIL
    if (method === "email" || method === "both") {
      await sendEmail(customer.email, subject, html);
    }

    // Send SMS
    if ((method === "sms" || method === "both") && customer.phone && 
        process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
      
      const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
      
      // Clean the phone number - remove ALL non-numeric characters
      const cleanedPhone = customer.phone.replace(/\D/g, '');
      
      console.log(`📱 SMS Details for customer ${customer.name}:`, {
        originalPhone: customer.phone,
        cleanedPhone: cleanedPhone,
        phoneLength: cleanedPhone.length
      });
      
      // Check if the phone number already has country code
      let fullPhone;
      
      if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
        // Already has US country code
        fullPhone = `+${cleanedPhone}`;
      } else if (cleanedPhone.length === 10) {
        // Add US country code
        fullPhone = `+1${cleanedPhone}`;
      } else if (cleanedPhone.length > 11) {
        // International number, assume it has country code
        fullPhone = `+${cleanedPhone}`;
      } else {
        console.error(`❌ Invalid phone number length: ${cleanedPhone.length} digits`);
        return;
      }
      
      
      // Validate phone number format (E.164 format for Twilio)
      if (!/^\+\d{10,15}$/.test(fullPhone)) {
        console.error(`❌ Invalid phone number format: ${fullPhone}`);
        console.error(`   Expected format: +[country code][phone number] (10-15 digits)`);
        return;
      }

      const smsText = `
Your bid has been marked as completed by ${shop.businessName}.

Category: ${bid.requestCategory}
Description: ${bid.serviceDescription}

Thank you for using our service!
      `;

      try {
        
        const twilioMessage = await twilioClient.messages.create({
          body: smsText,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: fullPhone,
        });

      
        
      } catch (twilioError) {
        console.error(`❌ Twilio SMS Error for customer ${customer.name}:`, {
          errorCode: twilioError.code,
          errorMessage: twilioError.message,
          phoneNumber: fullPhone
        });
        
        // Check for common Twilio errors
        if (twilioError.code === 21211) {
          console.error(`   ⚠️ Invalid phone number format. Please check: ${fullPhone}`);
        } else if (twilioError.code === 21614) {
          console.error(`   ⚠️ Phone number is not SMS-capable: ${fullPhone}`);
        }
      }
    } 
    // -----------------------------
    // 🔥 NOTIFICATION LOGIC ENDS
    // -----------------------------

  } catch (err) {
    console.error("❌ Error sending bid completion notification:", {
      error: err.message,
      stack: err.stack
    });
  }
};