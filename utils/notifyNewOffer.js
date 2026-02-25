import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";

export const notifyNewOffer = async (offer, bidId, shopId, price, note) => {
  try {
    // ------------------------------------
    // 1) Fetch Bid WITH phone number and SMS block status
    // ------------------------------------
    const bid = await Bid.findById(bidId).select(
      "user_id serviceDescription requestCategory phone firstName lastName isSmsBlocked"  // ← Added isSmsBlocked
    );

    if (!bid) {
      console.error(`❌ Bid not found: ${bidId}`);
      return;
    }

    // ------------------------------------
    // 2) Fetch Customer From Bid
    // ------------------------------------
    const customer = await Customer.findById(bid.user_id).select(
      "name email phone"
    );

    if (!customer) {
      console.error(`❌ Customer not found for bid: ${bidId}`);
      return;
    }

    // ------------------------------------
    // 3) Fetch Shop
    // ------------------------------------
    const shop = await Shop.findById(shopId).select(
      "businessName ownerName"
    );

    if (!shop) {
      console.error(`❌ Shop not found: ${shopId}`);
      return;
    }

    // ------------------------------------
    // 4) Email Subject
    // ------------------------------------
    const subject = `${shop.businessName} submitted a new offer on your request`;

    // ------------------------------------
    // 5) Email Body (HTML) with Direct Dashboard Link
    // ------------------------------------
    const customerDashboardLink = "https://bidawrap.com/dashboard/bids";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
          🎉 You Received a New Offer!
        </h2>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Offer Details</h3>
          <p><strong>Shop:</strong> ${shop.businessName} (${shop.ownerName || ''})</p>
          <p><strong>Offer Price:</strong> $${price || offer?.price}</p>
          <p><strong>Message:</strong> ${note || offer?.note || "No message provided"}</p>

          <div style="margin-top: 20px; padding: 15px; background-color: #e7f3ff; border-left: 4px solid #007bff;">
            <h4 style="margin-top: 0;">Your Request Details:</h4>
            <p><strong>Category:</strong> ${bid.requestCategory}</p>
            <p><strong>Description:</strong> ${bid.serviceDescription}</p>
          </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${customerDashboardLink}" 
             style="background-color: #007bff; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold; 
                    display: inline-block; font-size: 16px;"
             target="_blank">
            View & Respond to Offer
          </a>
          <p style="margin-top: 10px; color: #666; font-size: 14px;">
            Login to your dashboard to review the full offer and respond
          </p>
        </div>

        <p style="color: #666; margin-top: 20px; font-size: 14px;">
          Or copy and paste this link in your browser:<br>
          <span style="color: #007bff; word-break: break-all;">${customerDashboardLink}</span>
        </p>
      </div>
    `;

    // ------------------------------------
    // 6) Send Email to Customer
    // ------------------------------------
    await sendEmail(customer.email, subject, html);
    console.log(`📧 Offer notification email sent to customer: ${customer.email}`);

    // ------------------------------------
    // 7) SMS NOTIFICATION (Twilio) - WITH BLOCKING CHECK
    // ------------------------------------
    // 🔥 CHECK IF SMS IS BLOCKED FOR THIS BID
    // If isSmsBlocked field exists AND is true, skip SMS
    if (bid.isSmsBlocked === true) {
      console.log(`🚫 SMS blocked for bid ${bidId} - customer has opted out`);
      return; // Exit early, don't send SMS
    }

    const phoneToUse = bid.phone;

    if (phoneToUse && process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

      // Clean the phone number - remove ALL non-numeric characters
      const cleanedPhone = phoneToUse.replace(/\D/g, '');

      console.log(`📱 SMS Details for customer ${customer.name || bid.firstName}:`, {
        originalPhone: phoneToUse,
        source: bid.phone ? 'from bid submission' : 'from customer profile',
        cleanedPhone: cleanedPhone,
        phoneLength: cleanedPhone.length,
        smsBlocked: bid.isSmsBlocked || false
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

      // SMS text WITHOUT link
      // SMS text with proper branding and commands
      const smsText = `Bidawrap: New Offer Received!

Shop: ${shop.businessName}
Price: $${price || offer?.price}

Check your email for details.

Reply STOP to stop SMS for this bid
Reply HELP for assistance`;
      try {
        const twilioMessage = await twilioClient.messages.create({
          body: smsText,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: fullPhone,
        });

        console.log(`✅ SMS sent to ${phoneToUse} (from ${bid.phone ? 'bid' : 'customer profile'}): ${twilioMessage.sid}`);

      } catch (twilioError) {
        console.error(`❌ Twilio SMS Error:`, {
          errorCode: twilioError.code,
          errorMessage: twilioError.message,
          phoneNumber: fullPhone,
          source: bid.phone ? 'bid' : 'customer'
        });

        // Check for common Twilio errors
        if (twilioError.code === 21211) {
          console.error(`   ⚠️ Invalid phone number format. Please check: ${fullPhone}`);
        } else if (twilioError.code === 21614) {
          console.error(`   ⚠️ Phone number is not SMS-capable: ${fullPhone}`);
        }
      }
    } else {
      console.log(`ℹ️ No SMS sent - ${!phoneToUse ? 'no phone number available' : 'Twilio credentials missing'}`);
    }

  } catch (err) {
    console.error("❌ notifyNewOffer FAILED:", err.message);
    console.error(err.stack);
  }
};