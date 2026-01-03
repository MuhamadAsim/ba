// utils/notifyNewOffer.js
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";

export const notifyNewOffer = async (offer, bidId, shopId, price, note) => {
  try {
    // ------------------------------------
    // 1) Fetch Bid
    // ------------------------------------
    const bid = await Bid.findById(bidId).select(
      "user_id serviceDescription requestCategory"
    );

    if (!bid) {
      return;
    }

    // ------------------------------------
    // 2) Fetch Customer From Bid
    // ------------------------------------
    const customer = await Customer.findById(bid.user_id).select(
      "name email phone"
    );

    if (!customer) {
      return;
    }

    // ------------------------------------
    // 3) Fetch Shop
    // ------------------------------------
    const shop = await Shop.findById(shopId).select(
      "businessName ownerName"
    );

    if (!shop) {
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


    // ------------------------------------
    // 7) SMS NOTIFICATION (Twilio)
    // ------------------------------------
    if (customer.phone && process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
      
      // Clean the phone number - remove ALL non-numeric characters
      const cleanedPhone = customer.phone.replace(/\D/g, '');
      
      console.log(`📱 SMS Details for customer ${customer.name}:`, {
        originalPhone: customer.phone,
        cleanedPhone: cleanedPhone,
        phoneLength: cleanedPhone.length
      });
      
      // Check if the phone number already has country code
      // If it starts with '1' (US/Canada) and is 11 digits, it already has country code
      // If it's 10 digits, add '+1' for US/Canada
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
New Offer Received!

Shop: ${shop.businessName}
Price: $${price || offer?.price}

Check your dashboard for full details.
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
  } catch (err) {
    console.error("❌ notifyNewOffer FAILED:", err.message);
  }
};