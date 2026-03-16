// utils/notifyBidCompleted.js
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";

export const notifyBidCompleted = async (shopId, bidId) => {
  try {
    // Fetch shop (NOW INCLUDES phone!)
    const shop = await Shop.findById(shopId).select(
      "businessName ownerName phone ownerPhone isSmsBlocked"  // ← FIXED: Added 'phone'
    );
    if (!shop) return console.log("⚠️ Shop not found");

    // Fetch bid (now includes contactMethod and phone)
    const bid = await Bid.findById(bidId).select(
      "user_id contactMethod serviceDescription requestCategory vehicleYear vehicleMake vehicleModel vehicleTrim phone isSmsBlocked"
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

    // Send EMAIL to customer
    if (method === "email" || method === "both") {
      await sendEmail(customer.email, subject, html);
      console.log(`📧 Bid completion email sent to customer: ${customer.email}`);
    }

    // -----------------------------
    // 📱 CUSTOMER SMS NOTIFICATION
    // -----------------------------
    if (bid.isSmsBlocked === true) {
      console.log(`🚫 Customer SMS blocked for bid ${bidId} - customer has opted out`);
    } else {
      if ((method === "sms" || method === "both") &&
        process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {

        const phoneToUse = bid.phone;

        if (phoneToUse) {
          const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

          // Clean the phone number
          const cleanedPhone = phoneToUse.replace(/\D/g, '');

          console.log(`📱 Customer SMS Details:`, {
            originalPhone: phoneToUse,
            cleanedPhone: cleanedPhone,
            phoneLength: cleanedPhone.length,
            smsBlocked: bid.isSmsBlocked || false
          });

          // Format phone number
          let fullPhone;
          if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
            fullPhone = `+${cleanedPhone}`;
          } else if (cleanedPhone.length === 10) {
            fullPhone = `+1${cleanedPhone}`;
          } else if (cleanedPhone.length > 11) {
            fullPhone = `+${cleanedPhone}`;
          } else {
            console.error(`❌ Invalid phone number length: ${cleanedPhone.length} digits`);
            return;
          }

          if (!/^\+\d{10,15}$/.test(fullPhone)) {
            console.error(`❌ Invalid phone number format: ${fullPhone}`);
            return;
          }

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

            console.log(`✅ Customer SMS sent: ${twilioMessage.sid}`);

          } catch (twilioError) {
            console.error(`❌ Twilio SMS Error for customer:`, {
              errorCode: twilioError.code,
              errorMessage: twilioError.message,
              phoneNumber: fullPhone
            });
          }
        } else {
          console.log(`ℹ️ No customer SMS sent - no phone number available`);
        }
      }
    }

    // -----------------------------
    // 🏪 SHOP SMS NOTIFICATION
    // -----------------------------
    if (shop.isSmsBlocked === true) {
      console.log(`🚫 Shop SMS blocked for shop ${shopId} - shop has opted out`);
    } else {
      // NOW this will work because we fetched shop.ownerPhone!
      if (shop.ownerPhone && process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

        // Clean the phone number
        const cleanedPhone = shop.ownerPhone.replace(/\D/g, '');

        console.log(`📱 Shop SMS Details:`, {
          originalPhone: shop.ownerPhone,
          cleanedPhone: cleanedPhone,
          phoneLength: cleanedPhone.length,
          smsBlocked: shop.isSmsBlocked || false
        });

        // Format phone number
        let fullPhone;
        if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
          fullPhone = `+${cleanedPhone}`;
        } else if (cleanedPhone.length === 10) {
          fullPhone = `+1${cleanedPhone}`;
        } else if (cleanedPhone.length > 11) {
          fullPhone = `+${cleanedPhone}`;
        } else {
          console.error(`❌ Invalid shop.ownerPhone number length: ${cleanedPhone.length} digits`);
          return;
        }

        if (!/^\+\d{10,15}$/.test(fullPhone)) {
          console.error(`❌ Invalid shop.ownerPhone format: ${fullPhone}`);
          return;
        }

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

          console.log(`✅ Shop SMS sent: ${twilioMessage.sid}`);

        } catch (twilioError) {
          console.error(`❌ Twilio SMS Error for shop:`, {
            errorCode: twilioError.code,
            errorMessage: twilioError.message,
            phoneNumber: fullPhone
          });
        }
      } else {
        console.log(`ℹ️ No shop SMS sent - ${!shop.ownerPhone ? 'no phone number' : 'Twilio credentials missing'}`);
      }
    }

  } catch (err) {
    console.error("❌ Error sending bid completion notification:", {
      error: err.message,
      stack: err.stack
    });
  }
};