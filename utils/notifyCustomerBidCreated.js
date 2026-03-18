// utils/notifyCustomerBidCreated.js
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";






// ---------------------- Helper function to format phone for Twilio ----------------------
const formatPhoneForTwilio = (phone, countryCode = "1") => {
  if (!phone) return null;

  // Clean the phone number - remove all non-numeric characters
  const cleanedPhone = phone.replace(/\D/g, '');

  if (!cleanedPhone) return null;

  // Remove any + from country code
  const cc = (countryCode || "1").replace('+', '');

  let formattedPhone;

  if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
    // Already has US country code
    formattedPhone = `+${cleanedPhone}`;
  } else if (cleanedPhone.length === 10) {
    // Add country code
    formattedPhone = `+${cc}${cleanedPhone}`;
  } else if (cleanedPhone.length > 11) {
    // International number, check if it already has country code
    if (cleanedPhone.startsWith(cc)) {
      formattedPhone = `+${cleanedPhone}`;
    } else {
      formattedPhone = `+${cc}${cleanedPhone}`;
    }
  } else {
    return null;
  }

  // Validate E.164 format
  if (!/^\+\d{10,15}$/.test(formattedPhone)) {
    return null;
  }

  return formattedPhone;
};






export const notifyCustomerBidCreated = async (bid, customer) => {
  try {
    const customerName = customer.name || `${bid.firstName || ''} ${bid.lastName || ''}`.trim() || 'Customer';
    const customerEmail = customer.email || bid.email;
    const customerPhone = bid.phone;
    
    console.log(`📣 Sending bid confirmation to customer: ${customerName}`);

    // ---------------------- EMAIL NOTIFICATION ----------------------
    if (customerEmail) {
      const emailSubject = "Your Bid Has Been Submitted Successfully";
      
      const emailHTML = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
            ✅ Bid Submitted Successfully!
          </h2>
          
          <p>Hello ${customerName},</p>
          
          <p>Your bid has been submitted and local shops are now reviewing your request.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Bid Summary</h3>
            <p><strong>Bid ID:</strong> ${bid._id}</p>
            <p><strong>Service:</strong> ${bid.requestCategory}</p>
            <p><strong>Vehicle:</strong> ${bid.vehicleYear} ${bid.vehicleMake} ${bid.vehicleModel}</p>
            <p><strong>Description:</strong> ${bid.serviceDescription}</p>
            <p><strong>Status:</strong> <span style="color: #28a745;">Active - Waiting for offers</span></p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://bidawrap.com/customer/my-bids" 
               style="background-color: #007bff; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; font-weight: bold; 
                      display: inline-block; font-size: 16px;">
              Track Your Bid
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            You'll receive notifications when shops submit offers. Typically, you'll start receiving offers within 24-48 hours.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            <p>Thank you for using Bidawrap!</p>
          </div>
        </div>
      `;

      await sendEmail(customerEmail, emailSubject, emailHTML);
      console.log(`📧 Bid confirmation email sent to customer: ${customerEmail}`);
    }

    // ---------------------- SMS NOTIFICATION ----------------------
    if (customerPhone && process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      
      // Format phone (use customer's country code if available, default to "1")
      const countryCode = customer.countryCode || "1";
      const formattedPhone = formatPhoneForTwilio(customerPhone, countryCode);

      if (!formattedPhone) {
        console.log(`❌ Invalid customer phone number: ${customerPhone}`);
        return;
      }

      console.log(`📱 Sending SMS to customer at ${formattedPhone}`);

      const smsText = `Bidawrap: Your bid has been submitted successfully!

Bid ID: ${bid._id.toString().slice(-8)}
Service: ${bid.requestCategory}
Vehicle: ${bid.vehicleYear} ${bid.vehicleMake} ${bid.vehicleModel}


You'll be notified when shops respond.`;

      try {
        const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
        
        const message = await twilioClient.messages.create({
          body: smsText,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone,
        });

        console.log(`✅ Bid confirmation SMS sent to customer:`, {
          messageId: message.sid,
          to: formattedPhone
        });

      } catch (twilioError) {
        console.error(`❌ Twilio SMS Error for customer:`, {
          errorCode: twilioError.code,
          errorMessage: twilioError.message,
          phoneNumber: formattedPhone
        });
      }
    } else {
      console.log(`ℹ️ No SMS sent to customer - ${!customerPhone ? 'no phone number' : 'Twilio credentials missing'}`);
    }

  } catch (error) {
    console.error("❌ Error in notifyCustomerBidCreated:", {
      error: error.message,
      stack: error.stack,
      bidId: bid._id,
      customerId: customer._id
    });
  }
};
