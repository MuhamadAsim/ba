// utils/notifyBidCompleted.js
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";

export const notifyBidCompleted = async (shopId, bidId) => {
  try {
    // Fetch shop (now includes isSmsBlocked)
    const shop = await Shop.findById(shopId).select(
      "businessName ownerName isSmsBlocked"  // ← Added isSmsBlocked
    );
    if (!shop) return console.log("⚠️ Shop not found");

    // Fetch bid (now includes contactMethod and phone)
    const bid = await Bid.findById(bidId).select(
      "user_id contactMethod serviceDescription requestCategory vehicleYear vehicleMake vehicleModel vehicleTrim phone isSmsBlocked"  // ← Added phone and isSmsBlocked
    );
    if (!bid) return console.log("⚠️ Bid not found");

    // Fetch customer
    const customer = await Customer.findById(bid.user_id).select(
      "name email phone"
    );
    if (!customer) return console.log("⚠️ Customer not found");

    const subject = `Your bid has been marked as completed by ${shop.businessName}`;

    const html = `
      <h2>Your Bid Has Been Completed 🎉</h2>

      <p><strong>Shop:</strong> ${shop.businessName} (${shop.ownerName || ''})</p>

      <h3>Bid Details</h3>
      <p><strong>Category:</strong> ${bid.requestCategory}</p>
      <p><strong>Description:</strong> ${bid.serviceDescription}</p>
      <p><strong>Vehicle:</strong> ${bid.vehicleYear} ${bid.vehicleMake} ${bid.vehicleModel} ${bid.vehicleTrim || ''}</p>

      <hr/>
      <p>Your job is now marked as <strong>Completed</strong>.</p>
      <p>If something is incorrect, please contact support or the shop directly.</p>
    `;

    // -----------------------------
    // 🔥 NOTIFICATION LOGIC BEGINS
    // -----------------------------

    const method = bid.contactMethod || "email";

    // Send EMAIL
    if (method === "email" || method === "both") {
      await sendEmail(customer.email, subject, html);
      console.log(`📧 Bid completion email sent to customer: ${customer.email}`);
    }

    // -----------------------------
    // 📱 CUSTOMER SMS NOTIFICATION
    // -----------------------------
    // 🔥 CHECK IF SMS IS BLOCKED FOR THIS BID
    // If isSmsBlocked field exists AND is true, skip SMS to customer
    if (bid.isSmsBlocked === true) {
      console.log(`🚫 Customer SMS blocked for bid ${bidId} - customer has opted out`);
    } else {
      // Send SMS to customer if method allows and phone exists
      if ((method === "sms" || method === "both") && 
          process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
        
        const phoneToUse = bid.phone 
        
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
          const smsText = `Bidawrap: Your bid is complete!

Shop: ${shop.businessName}
Vehicle: ${bid.vehicleYear} ${bid.vehicleMake} ${bid.vehicleModel}
Category: ${bid.requestCategory}

Thank you for using Bidawrap!

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
        const shopSmsText = `Bidawrap: Bid #${bidId.slice(-6)} completed

Customer: ${customer.name || 'Customer'}
Vehicle: ${bid.vehicleYear} ${bid.vehicleMake} ${bid.vehicleModel}
Category: ${bid.requestCategory}

The bid has been marked as completed.

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
    console.error("❌ Error sending bid completion notification:", {
      error: err.message,
      stack: err.stack
    });
  }
};