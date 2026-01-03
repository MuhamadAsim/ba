// utils/notifyCounterOffer.js
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";

export const notifyCounterOffer = async (offer, counterData) => {
  try {
    const shopId = offer.shopId;
    const customerId = offer.bidId.user_id;

    // Fetch shop - ADDED countryCode and plan
    const shop = await Shop.findById(shopId).select("email phone countryCode businessName ownerName plan");
    if (!shop) {
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

    // ---------------------- TWILIO SMS ----------------------
    if (shop.phone && process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
      
      // Clean the phone number - remove all non-numeric characters
      const cleanedPhone = shop.phone.replace(/\D/g, '');
      
      // Get country code (default to +1 if not provided)
      let countryCode = shop.countryCode || "+1";
      
      // Ensure country code starts with +
      if (!countryCode.startsWith('+')) {
        countryCode = '+' + countryCode;
      }
      
      // Remove any plus from the country code for the full phone number
      const countryCodeNumber = countryCode.replace('+', '');
      
      // Construct full phone number in E.164 format
      const fullPhone = `+${countryCodeNumber}${cleanedPhone}`;
      
      console.log(`📱 SMS Details for ${shop.businessName}:`, {
        originalPhone: shop.phone,
        cleanedPhone: cleanedPhone,
        countryCode: countryCode,
        countryCodeNumber: countryCodeNumber,
        fullPhone: fullPhone,
        shopPlan: shop.plan,
        smsTextLength: smsText ? smsText.length : 0
      });

      // Validate phone number format (E.164 format for Twilio)
      if (!/^\+\d{10,15}$/.test(fullPhone)) {
        console.error(`❌ Invalid phone number format for ${shop.businessName}: ${fullPhone}`);
        console.error(`   Expected format: +[country code][phone number] (10-15 digits)`);
        return;
      }

      const smsText = `
${customerName} submitted a counter offer!

Original Offer: $${offer.price}
Counter Price: $${counterData.counterPrice}
${counterData.message ? `Message: ${counterData.message}` : ''}

Check your dashboard for details.
      `;

      try {
        
        const twilioMessage = await twilioClient.messages.create({
          body: smsText,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: fullPhone,
        });
        
      } catch (twilioError) {
        console.error(`❌ Twilio SMS Error for shop ${shop.businessName}:`, {
          errorCode: twilioError.code,
          errorMessage: twilioError.message,
          moreInfo: twilioError.moreInfo,
          phoneNumber: fullPhone,
          twilioFromNumber: process.env.TWILIO_PHONE_NUMBER
        });
        
        // Check for common Twilio errors
        if (twilioError.code === 21211) {
          console.error(`   ⚠️ Invalid phone number format. Please check: ${fullPhone}`);
        } else if (twilioError.code === 21614) {
          console.error(`   ⚠️ Phone number is not SMS-capable: ${fullPhone}`);
        } else if (twilioError.code === 21408) {
          console.error(`   ⚠️ Not authorized to send to this number: ${fullPhone}`);
        } else if (twilioError.code === 21612) {
          console.error(`   ⚠️ Phone number has opted out of SMS: ${fullPhone}`);
        }
      }
    } 
  } catch (err) {
    console.error("❌ Error notifying shop about counter offer:", {
      error: err.message,
      stack: err.stack
    });
  }
};