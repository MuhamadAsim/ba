import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";

// ---------------------- Helper function to format phone for Twilio ----------------------
const formatPhoneForTwilio = (phone, countryCode = "1") => {
  if (!phone) return null;

  // Clean the phone number - remove all non-numeric characters
  const cleanedPhone = phone.replace(/\D/g, '');

  if (!cleanedPhone) return null;

  // Remove any + from country code (since we'll add it ourselves)
  const cc = (countryCode || "1").replace('+', '');

  let formattedPhone;

  if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
    // Already has US country code
    formattedPhone = `+${cleanedPhone}`;
  } else if (cleanedPhone.length === 10) {
    // Add country code (cc is without +)
    formattedPhone = `+${cc}${cleanedPhone}`;
  } else if (cleanedPhone.length > 11) {
    // International number, check if it already has country code
    if (cleanedPhone.startsWith(cc)) {
      formattedPhone = `+${cleanedPhone}`;
    } else {
      formattedPhone = `+${cc}${cleanedPhone}`;
    }
  } else {
    console.error(`❌ Invalid phone number length: ${cleanedPhone.length} digits`);
    return null;
  }

  // Validate E.164 format
  if (!/^\+\d{10,15}$/.test(formattedPhone)) {
    console.error(`❌ Invalid E.164 format: ${formattedPhone}`);
    return null;
  }

  return formattedPhone;
};

export const offerAccepted = async ({ shopId, customerId, subject, message, bid, offer }) => {
  try {
    // Fetch shop with SMS block status
    const shop = await Shop.findById(shopId).select(
      "email phone ownerPhone countryCode businessName ownerName plan isSmsBlocked"
    );
    if (!shop) {
      console.error(`❌ Shop not found: ${shopId}`);
      return;
    }

    // Fetch customer (optional)
    const customer = await Customer.findById(customerId).select("name email");
    const customerName = customer?.name || "Customer";

    // Direct link for shop dashboard
    const shopDashboardLink = "https://bidawrap.com/partner/dashboard/bids";

    // Build HTML Email
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
          ${subject}
        </h2>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #28a745; margin-top: 0;">🎉 Congratulations!</h3>
          <p style="font-size: 16px;"><strong>Message:</strong> ${message}</p>

          ${offer ? `<p style="font-size: 18px; font-weight: bold; color: #28a745;">
            <strong>Accepted Offer Price:</strong> $${offer.price}
          </p>` : ""}

          ${bid ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #e9f7ef; border-left: 4px solid #28a745;">
              <h4 style="margin-top: 0;">Bid Information</h4>
              <p><strong>Category:</strong> ${bid.requestCategory}</p>
              <p><strong>Description:</strong> ${bid.serviceDescription}</p>
              <p><strong>Vehicle:</strong> ${bid.vehicleYear} ${bid.vehicleMake} ${bid.vehicleModel} ${bid.vehicleTrim || ''}</p>
            </div>
          ` : ""}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${shopDashboardLink}" 
             style="background-color: #28a745; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold; 
                    display: inline-block; font-size: 16px;"
             target="_blank">
            View Bid in Dashboard
          </a>
          <p style="margin-top: 10px; color: #666; font-size: 14px;">
            Manage this accepted bid on your partner dashboard
          </p>
        </div>

        <p style="color: #666; margin-top: 20px; font-size: 14px;">
          Or copy and paste this link in your browser:<br>
          <span style="color: #28a745; word-break: break-all;">${shopDashboardLink}</span>
        </p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
          <p>This notification was sent to <strong>${shop.businessName}</strong> (${shop.ownerName || ''}).</p>
        </div>
      </div>
    `;

    // ---------------------- SENDGRID EMAIL ----------------------
    await sendEmail(shop.email, subject, html);
    console.log(`📧 Offer accepted notification email sent to shop: ${shop.email}`);

    // ---------------------- TWILIO SMS ----------------------
    if (shop.isSmsBlocked === true) {
      console.log(`🚫 SMS blocked for shop ${shop.businessName} - shop has opted out`);
    } else {
      if (shop.ownerPhone && process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

        // 📱 SHOP SMS
        const smsText = `Bidawrap: Offer Accepted! 🎉

${subject}

${message}
${offer ? `Accepted Price: $${offer.price}` : ""}
${bid ? `Category: ${bid.requestCategory}` : ""}
${bid ? `Vehicle: ${bid.vehicleYear} ${bid.vehicleMake} ${bid.vehicleModel}` : ""}

Check email for details.

Reply STOP to stop SMS
Reply HELP for assistance`;

        // Format phone using helper function
        const formattedPhone = formatPhoneForTwilio(shop.ownerPhone, shop.countryCode);

        if (!formattedPhone) {
          console.error(`❌ Could not format phone for ${shop.businessName}: ${shop.ownerPhone}`);
          return;
        }

        console.log(`📱 Sending SMS to ${shop.businessName} at ${formattedPhone}`);

        try {
          const twilioMessage = await twilioClient.messages.create({
            body: smsText,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: formattedPhone,
          });

          console.log(`✅ Offer accepted SMS sent to shop ${shop.businessName}: ${twilioMessage.sid}`);

        } catch (twilioError) {
          console.error(`❌ Twilio SMS Error for ${shop.businessName}:`, {
            errorCode: twilioError.code,
            errorMessage: twilioError.message,
            phoneNumber: formattedPhone
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
    console.error("❌ Error notifying shop:", err.message);
  }
};