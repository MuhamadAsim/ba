import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";

export const offerAccepted = async ({ shopId, customerId, subject, message, bid, offer }) => {
  try {
    // Fetch shop with SMS block status
    const shop = await Shop.findById(shopId).select(
      "email phone countryCode businessName ownerName plan isSmsBlocked"  // ← Added isSmsBlocked
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
    // 🔥 CHECK IF SMS IS BLOCKED FOR THIS SHOP
    // If isSmsBlocked field exists AND is true, skip SMS to shop
    if (shop.isSmsBlocked === true) {
      console.log(`🚫 SMS blocked for shop ${shop.businessName} - shop has opted out`);
    } else {
      // Use shop.phone field (not ownerPhone)
      if (shop.phone && process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

        // 📱 SHOP SMS with proper branding and commands
        const smsText = `Bidawrap: Offer Accepted! 🎉

${subject}

${message}
${offer ? `Accepted Price: $${offer.price}` : ""}
${bid ? `Category: ${bid.requestCategory}` : ""}
${bid ? `Vehicle: ${bid.vehicleYear} ${bid.vehicleMake} ${bid.vehicleModel}` : ""}

Check email for details.

Reply STOP to stop SMS
Reply HELP for assistance`;

        // Clean the phone number - remove all non-numeric characters
        const cleanedPhone = shop.phone.replace(/\D/g, '');

        console.log(`📱 SMS Details for ${shop.businessName}:`, {
          originalPhone: shop.phone,
          cleanedPhone: cleanedPhone,
          countryCode: shop.countryCode || '1',
          shopPlan: shop.plan,
          smsBlocked: shop.isSmsBlocked || false,
          smsTextLength: smsText.length
        });

        // Construct full phone number in E.164 format
        let fullPhone;
        const countryCode = shop.countryCode || "1";
        
        if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
          // Already has US country code
          fullPhone = `+${cleanedPhone}`;
        } else if (cleanedPhone.length === 10) {
          // Add country code
          fullPhone = `+${countryCode}${cleanedPhone}`;
        } else if (cleanedPhone.length > 11) {
          // International number, assume it has country code
          fullPhone = `+${cleanedPhone}`;
        } else {
          console.error(`❌ Invalid phone number length for ${shop.businessName}: ${cleanedPhone.length} digits`);
          return;
        }

        // Validate phone number format (E.164 format for Twilio)
        if (!/^\+\d{10,15}$/.test(fullPhone)) {
          console.error(`❌ Invalid phone number format for ${shop.businessName}: ${fullPhone}`);
          return;
        }

        try {
          const twilioMessage = await twilioClient.messages.create({
            body: smsText,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: fullPhone,
          });

          console.log(`✅ Offer accepted SMS sent to shop ${shop.businessName}: ${twilioMessage.sid}`);
          console.log(`📱 SMS Content: "${smsText.replace(/\n/g, ' ')}"`);

        } catch (twilioError) {
          console.error(`❌ Twilio SMS Error for ${shop.businessName}:`, {
            errorCode: twilioError.code,
            errorMessage: twilioError.message,
            phoneNumber: fullPhone
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
        console.log(`ℹ️ No SMS sent to shop ${shop.businessName} - ${!shop.phone ? 'no phone number' : 'Twilio credentials missing'}`);
      }
    }

  } catch (err) {
    console.error("❌ Error notifying shop:", err.message);
  }
};