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
      return;
    }

    // Fetch customer
    const customer = await Customer.findById(bid.user_id).select(
      "name email phone"
    );

    if (!customer) {
      return;
    }

    // Fetch shop
    const shop = await Shop.findById(shopId).select(
      "businessName ownerName"
    );

    if (!shop) {
      return;
    }

    // Add customer dashboard link
    const customerDashboardLink = "https://bidawrap.com/dashboard/bids";

    const subject = `${shop.businessName} accepted your counter offer!`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
          Your Counter Offer Was Accepted 🎉
        </h2>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #28a745; margin-top: 0;">Accepted Offer Details</h3>
          <p><strong>Shop:</strong> ${shop.businessName} (${shop.ownerName || ''})</p>
          <p style="font-size: 18px; font-weight: bold; color: #28a745;">
            <strong>Accepted Price:</strong> $${counterOffer.counterPrice}
          </p>

          <div style="margin-top: 20px; padding: 15px; background-color: #e9f7ef; border-left: 4px solid #28a745;">
            <h4 style="margin-top: 0;">Your Bid Information</h4>
            <p><strong>Category:</strong> ${bid.requestCategory}</p>
            <p><strong>Description:</strong> ${bid.serviceDescription}</p>
          </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${customerDashboardLink}" 
             style="background-color: #28a745; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold; 
                    display: inline-block; font-size: 16px;">
            View Accepted Bid
          </a>
          <p style="margin-top: 10px; color: #666; font-size: 14px;">
            Your bid is now marked as <strong>In Progress</strong>.
          </p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
          <p>Or copy and paste this link: ${customerDashboardLink}</p>
        </div>
      </div>
    `;

    // -----------------------------
    // 🔥 NOTIFICATION LOGIC
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

      // SMS text with dashboard link
      const smsText = `
Great news! ${shop.businessName} accepted your counter offer.

Accepted Price: $${counterOffer.counterPrice}

Your bid is now in progress. View details:
${customerDashboardLink}
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

  } catch (err) {
    console.error("❌ Error notifying customer about counter acceptance:", {
      error: err.message,
      stack: err.stack
    });
  }
};