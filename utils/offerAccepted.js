import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";

export const offerAccepted = async ({ shopId, customerId, subject, message, bid, offer }) => {
  try {
    // Fetch shop
    const shop = await Shop.findById(shopId).select("email phone countryCode businessName ownerName plan");
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

    // ---------------------- TWILIO SMS ----------------------
    const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    const smsText = `
${subject}

${message}

${offer ? `Offer: $${offer.price}` : ""}
${bid ? `Category: ${bid.requestCategory}` : ""}
    `;

    if (shop.phone) {
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
        smsTextLength: smsText.length
      });

      // Validate phone number format (E.164 format for Twilio)
      if (!/^\+\d{10,15}$/.test(fullPhone)) {
        console.error(`❌ Invalid phone number format for ${shop.businessName}: ${fullPhone}`);
        console.error(`   Expected format: +[country code][phone number] (10-15 digits)`);
        return;
      }

      try {
        console.log(`📱 Attempting to send SMS to ${fullPhone} for shop ${shop.businessName}...`);
        
        const twilioMessage = await twilioClient.messages.create({
          body: smsText,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: fullPhone,
        });

        console.log(`✅ SMS SUCCESSFULLY sent to ${fullPhone} for shop ${shop.businessName}`);
        console.log(`   Twilio Message SID: ${twilioMessage.sid}`);
        console.log(`   Message Status: ${twilioMessage.status}`);
        console.log(`   Message Price: ${twilioMessage.price || 'N/A'}`);
        console.log(`   Message Date Created: ${twilioMessage.dateCreated}`);
        
      } catch (twilioError) {
        console.error(`❌ Twilio SMS Error for ${shop.businessName}:`, {
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
    } else {
      console.log(`📱 No phone number available for shop ${shop.businessName}, skipping SMS`);
    }

  } catch (err) {
    console.error("❌ Error notifying shop:", err);
  }
};