import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";

export const notifyCounterAccepted = async (offer, counterOffer, shopId, bidId) => {
  try {
    // Fetch bid with phone number and SMS block status
    const bid = await Bid.findById(bidId).select(
      "user_id contactMethod serviceDescription requestCategory phone isSmsBlocked"  // ← Added phone and isSmsBlocked
    );

    if (!bid) {
      console.error(`❌ Bid not found: ${bidId}`);
      return;
    }

    // Fetch customer
    const customer = await Customer.findById(bid.user_id).select(
      "name email phone"
    );

    if (!customer) {
      console.error(`❌ Customer not found for bid: ${bidId}`);
      return;
    }

    // Fetch shop (with SMS block status)
    const shop = await Shop.findById(shopId).select(
      "businessName ownerName phone isSmsBlocked"  // ← Added phone and isSmsBlocked for shop notifications
    );

    if (!shop) {
      console.error(`❌ Shop not found: ${shopId}`);
      return;
    }

    // Direct customer dashboard link
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
                    display: inline-block; font-size: 16px;"
             target="_blank">
            View Accepted Bid
          </a>
          <p style="margin-top: 10px; color: #666; font-size: 14px;">
            Your bid is now marked as <strong>In Progress</strong>.
          </p>
        </div>

        <p style="color: #666; margin-top: 20px; font-size: 14px;">
          Or copy and paste this link in your browser:<br>
          <span style="color: #28a745; word-break: break-all;">${customerDashboardLink}</span>
        </p>
      </div>
    `;

    // -----------------------------
    // 🔥 NOTIFICATION LOGIC BEGINS
    // -----------------------------

    const method = bid.contactMethod || "email";

    // Send EMAIL to customer
    if (method === "email" || method === "both") {
      await sendEmail(customer.email, subject, html);
      console.log(`📧 Counter offer acceptance email sent to customer: ${customer.email}`);
    }

    // -----------------------------
    // 📱 CUSTOMER SMS NOTIFICATION
    // -----------------------------
    // 🔥 CHECK IF SMS IS BLOCKED FOR THIS BID
    // If isSmsBlocked field exists AND is true, skip SMS to customer
    if (bid.isSmsBlocked === true) {
      console.log(`🚫 Customer SMS blocked for bid ${bidId} - customer has opted out`);
    } else {
      // Send SMS to customer if method allows
      if ((method === "sms" || method === "both") && 
          process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
        
        // Use phone from BID model first, fallback to customer phone
        const phoneToUse = bid.phone;
        
        if (phoneToUse) {
          const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
          
          // Clean the phone number - remove ALL non-numeric characters
          const cleanedPhone = phoneToUse.replace(/\D/g, '');
          
          console.log(`📱 Customer SMS Details:`, {
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

          // 📱 CUSTOMER SMS with proper branding and commands
          const smsText = `Bidawrap: Counter offer accepted!

Shop: ${shop.businessName}
Accepted Price: $${counterOffer.counterPrice}
Category: ${bid.requestCategory}

Your bid is now in progress.

Reply STOP to stop SMS for this bid
Reply HELP for assistance`;

          try {
            const twilioMessage = await twilioClient.messages.create({
              body: smsText,
              from: process.env.TWILIO_PHONE_NUMBER,
              to: fullPhone,
            });

            console.log(`✅ Customer SMS sent to ${phoneToUse}: ${twilioMessage.sid}`);
            console.log(`📱 SMS Content: "${smsText.replace(/\n/g, ' ')}"`);

          } catch (twilioError) {
            console.error(`❌ Twilio SMS Error for customer:`, {
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
        } else {
          console.log(`ℹ️ No customer SMS sent - no phone number available`);
        }
      }
    }

    // -----------------------------
    // 🏪 SHOP SMS NOTIFICATION
    // -----------------------------
    // 🔥 CHECK IF SMS IS BLOCKED FOR THIS SHOP
    // If shop.isSmsBlocked exists AND is true, skip SMS to shop
    if (shop.isSmsBlocked === true) {
      console.log(`🚫 Shop SMS blocked for shop ${shopId} - shop has opted out`);
    } else {
      // Send SMS to shop owner if they have phone number
      if (shop.phone && process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
        
        // Clean the phone number
        const cleanedPhone = shop.phone.replace(/\D/g, '');
        
        console.log(`📱 Shop SMS Details:`, {
          originalPhone: shop.phone,
          cleanedPhone: cleanedPhone,
          phoneLength: cleanedPhone.length,
          smsBlocked: shop.isSmsBlocked || false
        });
        
        // Format phone number with country code
        let fullPhone;
        if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
          fullPhone = `+${cleanedPhone}`;
        } else if (cleanedPhone.length === 10) {
          fullPhone = `+1${cleanedPhone}`;
        } else if (cleanedPhone.length > 11) {
          fullPhone = `+${cleanedPhone}`;
        } else {
          console.error(`❌ Invalid shop phone number length: ${cleanedPhone.length} digits`);
          return;
        }
        
        // Validate format
        if (!/^\+\d{10,15}$/.test(fullPhone)) {
          console.error(`❌ Invalid shop phone format: ${fullPhone}`);
          return;
        }

        // 🏪 SHOP SMS with proper branding
        const shopSmsText = `Bidawrap: Counter offer accepted!

Customer: ${customer.name || 'Customer'}
Accepted Price: $${counterOffer.counterPrice}
Category: ${bid.requestCategory}

The counter offer has been accepted. Bid is now in progress.

Reply STOP to stop SMS
Reply HELP for assistance`;

        try {
          const twilioMessage = await twilioClient.messages.create({
            body: shopSmsText,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: fullPhone,
          });

          console.log(`✅ Shop SMS sent to ${shop.phone}: ${twilioMessage.sid}`);
          console.log(`📱 Shop SMS Content: "${shopSmsText.replace(/\n/g, ' ')}"`);
          
        } catch (twilioError) {
          console.error(`❌ Twilio SMS Error for shop:`, {
            errorCode: twilioError.code,
            errorMessage: twilioError.message,
            phoneNumber: fullPhone
          });
        }
      } else {
        console.log(`ℹ️ No shop SMS sent - ${!shop.phone ? 'no phone number' : 'Twilio credentials missing'}`);
      }
    }

    // -----------------------------
    // 🔥 NOTIFICATION LOGIC ENDS
    // -----------------------------

  } catch (err) {
    console.error("❌ Error notifying about counter acceptance:", {
      error: err.message,
      stack: err.stack
    });
  }
};