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

    // Fetch shop with SMS block status
    const shop = await Shop.findById(shopId).select(
      "email phone ownerPhone countryCode businessName ownerName plan isSmsBlocked"
    );
    if (!shop) {
      console.error(`❌ Shop not found: ${shopId}`);
      return;
    }

    // Fetch customer
    const customer = await Customer.findById(customerId).select("name email");
    const customerName = customer?.name || "Customer";

    // Direct link for shop dashboard
    const shopDashboardLink = "https://bidawrap.com/partner/dashboard/bids";

    // Prepare email subject
    const subject = `${customerName} submitted a counter offer`;

    // Build HTML with dashboard link
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #ffc107; padding-bottom: 10px;">
          ${customerName} submitted a counter offer
        </h2>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #ffc107; margin-top: 0;">Counter Offer Details</h3>
          <p><strong>Original Offer Price:</strong> $${offer.price}</p>
          <p style="font-size: 18px; font-weight: bold; color: #ffc107;">
            <strong>Counter Price:</strong> $${counterData.counterPrice}
          </p>
          <p><strong>Customer Message:</strong> ${counterData.message || "No message provided"}</p>

          <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107;">
            <h4 style="margin-top: 0;">Bid Information</h4>
            <p><strong>Category:</strong> ${offer.bidId.requestCategory}</p>
            <p><strong>Description:</strong> ${offer.bidId.serviceDescription}</p>
            <p><strong>Vehicle:</strong> ${offer.bidId.vehicleYear} ${offer.bidId.vehicleMake} ${offer.bidId.vehicleModel} ${offer.bidId.vehicleTrim || ''}</p>
          </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${shopDashboardLink}" 
             style="background-color: #ffc107; color: #333; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold; 
                    display: inline-block; font-size: 16px;"
             target="_blank">
            View & Respond to Counter Offer
          </a>
          <p style="margin-top: 10px; color: #666; font-size: 14px;">
            Login to your partner dashboard to review and respond
          </p>
        </div>

        <p style="color: #666; margin-top: 20px; font-size: 14px;">
          Or copy and paste this link in your browser:<br>
          <span style="color: #ffc107; word-break: break-all;">${shopDashboardLink}</span>
        </p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
          <p>This counter-offer was sent to <strong>${shop.businessName}</strong> (${shop.ownerName || ''}).</p>
        </div>
      </div>
    `;

    // ---------------------- EMAIL ----------------------
    await sendEmail(shop.email, subject, html);
    console.log(`📧 Counter offer notification email sent to shop: ${shop.email}`);

    // ---------------------- TWILIO SMS ----------------------
    if (shop.isSmsBlocked === true) {
      console.log(`🚫 Shop SMS blocked for shop ${shopId} - shop has opted out`);
    } else {
      if (shop.ownerPhone && process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

        // Clean the phone number - remove all non-numeric characters
        const cleanedPhone = shop.ownerPhone.replace(/\D/g, '');

        // 🔥 FIX: Remove any + from country code
        let countryCode = (shop.countryCode || "1").replace('+', '');

        console.log(`📱 SMS Details for ${shop.businessName}:`, {
          originalPhone: shop.ownerPhone,
          cleanedPhone: cleanedPhone,
          countryCode: countryCode, // Now shows "1" instead of "+1"
          shopPlan: shop.plan,
          smsBlocked: shop.isSmsBlocked || false
        });

        // Construct full phone number in E.164 format
        let fullPhone;

        if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
          // Already has US country code
          fullPhone = `+${cleanedPhone}`;
        } else if (cleanedPhone.length === 10) {
          // Add country code (now without +)
          fullPhone = `+${countryCode}${cleanedPhone}`;
        } else if (cleanedPhone.length > 11) {
          // International number, assume it has country code
          fullPhone = `+${cleanedPhone}`;
        } else {
          console.error(`❌ Invalid phone number length: ${cleanedPhone.length} digits`);
          return;
        }

        // Validate phone number format
        if (!/^\+\d{10,15}$/.test(fullPhone)) {
          console.error(`❌ Invalid phone number format for ${shop.businessName}: ${fullPhone}`);
          return;
        }

        // SMS text
        const smsText = `Bidawrap: Counter offer received!

Customer: ${customerName}
Original: $${offer.price}
Counter: $${counterData.counterPrice}
${counterData.message ? `Message: ${counterData.message.substring(0, 60)}${counterData.message.length > 60 ? '...' : ''}` : ''}

Check email to respond.

Reply STOP to stop SMS
Reply HELP for assistance`;

        try {
          const twilioMessage = await twilioClient.messages.create({
            body: smsText,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: fullPhone,
          });

          console.log(`✅ Counter offer SMS sent to shop ${shop.businessName}: ${twilioMessage.sid}`);

        } catch (twilioError) {
          console.error(`❌ Twilio SMS Error for shop ${shop.businessName}:`, {
            errorCode: twilioError.code,
            errorMessage: twilioError.message,
            phoneNumber: fullPhone
          });
        }
      } else {
        console.log(`ℹ️ No SMS sent to shop ${shop.businessName} -`, {
          hasPhone: !!shop.ownerPhone,
          hasTwilioSid: !!process.env.TWILIO_SID,
          hasTwilioAuth: !!process.env.TWILIO_AUTH_TOKEN,
          hasTwilioPhone: !!process.env.TWILIO_PHONE_NUMBER
        });
      }
    }
  } catch (err) {
    console.error("❌ Error notifying shop about counter offer:", {
      error: err.message,
      stack: err.stack
    });
  }
};