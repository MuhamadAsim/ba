// controllers/twilioWebhookController.js
import twilio from "twilio";
import Bid from "../models/bidModel.js";
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";

// Messaging response webhook for Twilio
export const handleSmsReply = async (req, res) => {
  try {
    // Twilio sends form data, not JSON
    const {
      Body: messageBody,
      From: fromNumber,
      To: toNumber,
      MessageSid: messageSid,
      SmsStatus: smsStatus,
      AccountSid: accountSid
    } = req.body;

    console.log("📨 Twilio Webhook Received:", {
      from: fromNumber,
      to: toNumber,
      body: messageBody,
      messageSid,
      smsStatus,
      timestamp: new Date().toISOString()
    });

    // Clean the incoming phone number (remove +1, spaces, etc.)
    const cleanedFromNumber = fromNumber.replace(/\D/g, '');
    
    // Determine if this is a shop or customer based on the phone number
    // We need to check both Shop and Bid collections
    
    // 1️⃣ Check if this is a SHOP (shop.phone)
    const shop = await Shop.findOne({
      $expr: {
        $eq: [
          { $replaceAll: { input: { $toString: "$phone" }, find: "\\D", replacement: "" } },
          cleanedFromNumber
        ]
      }
    });

    // 2️⃣ Check if this is a CUSTOMER (bid.phone)
    const bid = await Bid.findOne({
      $expr: {
        $eq: [
          { $replaceAll: { input: { $toString: "$phone" }, find: "\\D", replacement: "" } },
          cleanedFromNumber
        ]
      }
    });

    const message = messageBody.trim().toUpperCase();
    
    // ---------------------- HANDLE STOP COMMAND ----------------------
    if (message === 'STOP' || message === 'STOPALL' || message === 'UNSUBSCRIBE' || 
        message === 'CANCEL' || message === 'END' || message === 'QUIT') {
      
      if (shop) {
        // 🔥 Block SHOP from receiving SMS - handle edge cases
        const updateData = {
          isSmsBlocked: true,
          $set: {
            'smsOptOutDetails.optedOutAt': new Date(),
            'smsOptOutDetails.fromNumber': fromNumber,
            'smsOptOutDetails.message': messageBody,
            'smsOptOutDetails.messageSid': messageSid,
            'smsOptOutDetails.source': 'twilio_stop_reply'
          }
        };
        
        await Shop.findByIdAndUpdate(shop._id, updateData, { 
          new: true,
          upsert: false, // Don't create new doc, just update existing
          runValidators: true
        });
        
        console.log(`🚫 Shop SMS blocked for ${shop.businessName} (${shop._id})`);
        
        // Send confirmation SMS
        await sendOptOutConfirmation(shop.phone, 'shop');
        
      } else if (bid) {
        // 🔥 Block BID from receiving SMS - handle edge cases
        const updateData = {
          isSmsBlocked: true,
          $set: {
            'smsOptOutDetails.optedOutAt': new Date(),
            'smsOptOutDetails.fromNumber': fromNumber,
            'smsOptOutDetails.message': messageBody,
            'smsOptOutDetails.messageSid': messageSid,
            'smsOptOutDetails.source': 'twilio_stop_reply'
          }
        };
        
        await Bid.findByIdAndUpdate(bid._id, updateData, {
          new: true,
          upsert: false,
          runValidators: true
        });
        
        console.log(`🚫 Bid SMS blocked for bid ${bid._id} (phone: ${bid.phone})`);
        
        // Also update customer's SMS consent if they have a user account
        if (bid.user_id) {
          const customer = await Customer.findById(bid.user_id);
          if (customer) {
            // Update customer's SMS consent - handle edge cases
            const customerUpdate = {
              smsConsent: false,
              $set: {
                'smsOptOutDetails.optedOutAt': new Date(),
                'smsOptOutDetails.bidId': bid._id,
                'smsOptOutDetails.fromNumber': fromNumber,
                'smsOptOutDetails.message': messageBody,
                'smsOptOutDetails.messageSid': messageSid
              }
            };
            
            await Customer.findByIdAndUpdate(customer._id, customerUpdate, {
              new: true,
              upsert: false,
              runValidators: true
            });
            
            console.log(`📝 Customer ${customer._id} SMS consent updated`);
          }
        }
        
        // Send confirmation SMS
        await sendOptOutConfirmation(bid.phone, 'customer');
        
      } else {
        // Phone number not found in our system
        console.log(`⚠️ STOP received from unknown number: ${fromNumber}`);
        
        // Still send a response but don't store anything
        return twimlResponse(res, 
          `You have been unsubscribed from Bidawrap SMS notifications. ` +
          `If you continue receiving messages, please contact support@bidawrap.com`
        );
      }
      
      // Always respond with <Response> to acknowledge receipt (Twilio expects this)
      return twimlResponse(res, `You have been unsubscribed from Bidawrap SMS notifications. Reply HELP for assistance.`);
    }
    
    // ---------------------- HANDLE HELP COMMAND ----------------------
    else if (message === 'HELP') {
      if (shop || bid) {
        // Send help information
        return twimlResponse(res, 
          `Bidawrap SMS Commands:\n` +
          `STOP - Unsubscribe from all SMS\n` +
          `HELP - Show this message\n\n` +
          `For support: support@bidawrap.com or visit bidawrap.com/help`
        );
      } else {
        return twimlResponse(res, 
          `Bidawrap Support\n` +
          `Email: support@bidawrap.com\n` +
          `Website: bidawrap.com/help\n\n` +
          `Reply STOP to unsubscribe`
        );
      }
    }
    
    // ---------------------- HANDLE START COMMAND (Re-subscribe) ----------------------
    else if (message === 'START' || message === 'YES' || message === 'UNSTOP') {
      if (shop) {
        // Re-enable shop SMS - handle edge cases
        const updateData = {
          isSmsBlocked: false,
          $set: {
            'smsOptInDetails.optedInAt': new Date(),
            'smsOptInDetails.fromNumber': fromNumber,
            'smsOptInDetails.message': messageBody,
            'smsOptInDetails.messageSid': messageSid
          },
          $unset: {
            'smsOptOutDetails': "" // Clear opt-out details when they opt back in
          }
        };
        
        await Shop.findByIdAndUpdate(shop._id, updateData, {
          new: true,
          upsert: false,
          runValidators: true
        });
        
        console.log(`✅ Shop SMS re-enabled for ${shop.businessName} (${shop._id})`);
        
        return twimlResponse(res, 
          `You have been resubscribed to Bidawrap SMS notifications. ` +
          `Reply HELP for commands or STOP to unsubscribe again.`
        );
        
      } else if (bid) {
        // Re-enable bid SMS - handle edge cases
        const updateData = {
          isSmsBlocked: false,
          $set: {
            'smsOptInDetails.optedInAt': new Date(),
            'smsOptInDetails.fromNumber': fromNumber,
            'smsOptInDetails.message': messageBody,
            'smsOptInDetails.messageSid': messageSid
          },
          $unset: {
            'smsOptOutDetails': "" // Clear opt-out details when they opt back in
          }
        };
        
        await Bid.findByIdAndUpdate(bid._id, updateData, {
          new: true,
          upsert: false,
          runValidators: true
        });
        
        console.log(`✅ Bid SMS re-enabled for bid ${bid._id}`);
        
        // Also update customer's SMS consent if they have a user account
        if (bid.user_id) {
          const customer = await Customer.findById(bid.user_id);
          if (customer) {
            const customerUpdate = {
              smsConsent: true,
              $set: {
                'smsOptInDetails.optedInAt': new Date(),
                'smsOptInDetails.bidId': bid._id,
                'smsOptInDetails.fromNumber': fromNumber
              },
              $unset: {
                'smsOptOutDetails': ""
              }
            };
            
            await Customer.findByIdAndUpdate(customer._id, customerUpdate, {
              new: true,
              upsert: false,
              runValidators: true
            });
          }
        }
        
        return twimlResponse(res, 
          `You have been resubscribed to Bidawrap SMS notifications for this bid. ` +
          `Reply HELP for commands or STOP to unsubscribe again.`
        );
      } else {
        // Unknown number trying to START
        return twimlResponse(res, 
          `We couldn't find your number in our system. Please contact support@bidawrap.com for assistance.`
        );
      }
    }
    
    // ---------------------- HANDLE UNKNOWN COMMANDS ----------------------
    else {
      console.log(`❓ Unknown command from ${fromNumber}: ${messageBody}`);
      
      return twimlResponse(res, 
        `Unknown command. Reply HELP for available commands or STOP to unsubscribe.`
      );
    }

  } catch (error) {
    console.error("❌ Error in Twilio webhook:", error);
    // Always return a TwiML response even on error
    return twimlResponse(res, "An error occurred. Please try again later.");
  }
};

// Helper function to send TwiML response
const twimlResponse = (res, message) => {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(message);
  
  res.set('Content-Type', 'text/xml');
  return res.status(200).send(twiml.toString());
};

// Helper function to send opt-out confirmation
const sendOptOutConfirmation = async (phoneNumber, type) => {
  try {
    if (!process.env.TWILIO_SID || !process.env.TWILIO_AUTH_TOKEN) return;
    
    const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Clean phone number
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    let fullPhone;
    
    if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
      fullPhone = `+${cleanedPhone}`;
    } else if (cleanedPhone.length === 10) {
      fullPhone = `+1${cleanedPhone}`;
    } else if (cleanedPhone.length > 11) {
      fullPhone = `+${cleanedPhone}`;
    } else {
      console.error(`❌ Invalid phone number length: ${cleanedPhone.length}`);
      return;
    }
    
    const confirmationMessage = type === 'shop' 
      ? `You have been unsubscribed from Bidawrap SMS notifications for your shop. Reply START to resubscribe.`
      : `You have been unsubscribed from Bidawrap SMS notifications for this bid. Reply START to resubscribe.`;
    
    const message = await twilioClient.messages.create({
      body: confirmationMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: fullPhone,
    });
    
    console.log(`✅ Opt-out confirmation sent to ${phoneNumber}: ${message.sid}`);
  } catch (error) {
    console.error("❌ Error sending opt-out confirmation:", error);
  }
};

// Status callback webhook (optional - for delivery status)
export const handleSmsStatus = async (req, res) => {
  try {
    const {
      MessageSid: messageSid,
      MessageStatus: messageStatus,
      To: toNumber,
      ErrorCode: errorCode
    } = req.body;

    console.log("📊 SMS Status Update:", {
      messageSid,
      status: messageStatus,
      to: toNumber,
      errorCode,
      timestamp: new Date().toISOString()
    });

    // You can log this to a database if needed
    // You might want to create an SmsLog model for this
    /*
    const SmsLog = mongoose.model('SmsLog');
    await SmsLog.findOneAndUpdate(
      { messageSid },
      { 
        status: messageStatus,
        to: toNumber,
        errorCode,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
    */

    res.status(200).send();
  } catch (error) {
    console.error("❌ Error in SMS status webhook:", error);
    res.status(500).send();
  }
};

// Optional: Endpoint to check opt-out status
export const checkOptOutStatus = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    
    const shop = await Shop.findOne({
      $expr: {
        $eq: [
          { $replaceAll: { input: { $toString: "$phone" }, find: "\\D", replacement: "" } },
          cleanedNumber
        ]
      }
    }).select('businessName isSmsBlocked smsOptOutDetails smsOptInDetails');
    
    const bid = await Bid.findOne({
      $expr: {
        $eq: [
          { $replaceAll: { input: { $toString: "$phone" }, find: "\\D", replacement: "" } },
          cleanedNumber
        ]
      }
    }).select('isSmsBlocked smsOptOutDetails smsOptInDetails');
    
    return res.status(200).json({
      success: true,
      data: {
        shop: shop || null,
        bid: bid || null
      }
    });
    
  } catch (error) {
    console.error("❌ Error checking opt-out status:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking opt-out status"
    });
  }
};