// utils/notifyCounterAccepted.js
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";

export const notifyCounterAccepted = async (offer, counterOffer, shopId, bidId) => {
  try {
    // Fetch bid (now includes contactMethod)
    const bid = await Bid.findById(bidId).select(
      "user_id contactMethod serviceDescription requestCategory"
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

    const subject = `${shop.businessName} accepted your counter offer!`;

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

    // -----------------------------
    // 🔥 NOTIFICATION LOGIC
    // -----------------------------

    const method = bid.contactMethod || "email";

    // Send EMAIL
    if (method === "email" || method === "both") {
      await sendEmail(customer.email, subject, html);
      console.log("📧 Counter-accepted email sent to:", customer.email);
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
      
      console.log(`📱 Formatted phone for Twilio: ${fullPhone}`);
      
      // Validate phone number format (E.164 format for Twilio)
      if (!/^\+\d{10,15}$/.test(fullPhone)) {
        console.error(`❌ Invalid phone number format: ${fullPhone}`);
        console.error(`   Expected format: +[country code][phone number] (10-15 digits)`);
        return;
      }

      const smsText = `
Great news!
${shop.businessName} accepted your counter offer.

Accepted Price: $${counterOffer.counterPrice}

Your bid is now in progress.
      `;

      try {
        console.log(`📱 Attempting to send SMS to ${fullPhone} for customer ${customer.name}...`);
        
        const twilioMessage = await twilioClient.messages.create({
          body: smsText,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: fullPhone,
        });

        console.log(`✅ SMS SUCCESSFULLY sent to ${fullPhone} for customer ${customer.name}`);
        console.log(`   Twilio Message SID: ${twilioMessage.sid}`);
        console.log(`   Message Status: ${twilioMessage.status}`);
        
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
    } else if ((method === "sms" || method === "both") && !customer.phone) {
      console.log(`📱 Customer ${customer.name} has no phone number, skipping SMS`);
    }

    // -----------------------------

  } catch (err) {
    console.error("❌ Error notifying customer about counter acceptance:", {
      error: err.message,
      stack: err.stack
    });
  }
};