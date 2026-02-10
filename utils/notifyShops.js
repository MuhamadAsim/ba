import Shop from "../models/shopModel.js";
import Plan from "../models/planModel.js"
import { sendEmail } from "./sendEmail.js";
import twilio from "twilio";

const MAX_RADIUS_MILES = 15

// ---------------------- Haversine distance calculation ----------------------
const getDistanceMiles = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ---------------------- Notify Shops For Bid ----------------------
export const notifyShopsForBid = async (newBid, customer) => {
  try {
    // ---------------------- 1️⃣ GET BID LOCATION (Use bid's location, not customer's) ----------------------
    const bidLocation = {
      latitude: newBid.latitude,
      longitude: newBid.longitude,
      address: newBid.address,
      country: newBid.country,
      zipCode: newBid.zipCode,
    };

    // Validate bid has location
    if (!bidLocation.latitude || !bidLocation.longitude) {
      return;
    }

    const customerLat = bidLocation.latitude;
    const customerLng = bidLocation.longitude;

    // ---------------------- 2️⃣ GET VERIFIED SHOPS ----------------------
    // Populate the plan details to access notificationDelay
    const shops = await Shop.find({
      status: "active",
      isEmailVerified: true,
      isVerified: true,
    }).select("email phone countryCode businessName ownerName location latitude longitude plan")
      .populate({
        path: 'plan',
        select: 'features name'
      });

    if (!shops.length) {
      return;
    }

    // ---------------------- 3️⃣ FILTER BY RADIUS USING BID LOCATION ----------------------
    // Use bid's radius if available, otherwise fall back to MAX_RADIUS_MILES
    const radiusToUse = (newBid.radius && newBid.radius > 0) ? newBid.radius : MAX_RADIUS_MILES;
    
    console.log(`🎯 Using radius: ${radiusToUse} miles ${newBid.radius ? '(from bid)' : '(default)'}`);

    const nearbyShops = shops.filter((shop) => {
      let shopLat = null;
      let shopLng = null;

      if (shop.location?.coordinates?.length === 2) {
        shopLng = shop.location.coordinates[0];
        shopLat = shop.location.coordinates[1];
      } else if (shop.latitude && shop.longitude) {
        shopLat = shop.latitude;
        shopLng = shop.longitude;
      }

      if (!shopLat || !shopLng) {
        return false;
      }

      const distance = getDistanceMiles(customerLat, customerLng, shopLat, shopLng);
      const isWithinRadius = distance <= radiusToUse;

      return isWithinRadius;
    });

    if (!nearbyShops.length) {
      return;
    }

    // ---------------------- 4️⃣ EMAIL + SMS TEMPLATES ----------------------
    const customerName = customer.name || "Customer";

    // Get first letter of each name part for subject and content
    const getInitials = (name) => {
      if (!name) return '';
      return name
        .trim()
        .split(/\s+/)
        .map(part => part.charAt(0).toUpperCase())
        .join(' ');
    };

    const customerInitials = getInitials(customerName);

    // Add website link
    const websiteLink = "https://bidawrap.com/partner/dashboard/bids";

    // Use initials in subject instead of full name
    const subject = `${customerInitials} posted a bid`;

    const buildEmailHTML = () => {
      // Use the direct URL without any email tracking
      const directBidLink = `https://bidawrap.com/partner/dashboard/bids`;

      return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
      ${customerInitials} posted a new bid
    </h2>
    
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Category:</strong> ${newBid.requestCategory}</p>
      <p><strong>Description:</strong> ${newBid.serviceDescription}</p>
      <p><strong>Vehicle:</strong> ${newBid.vehicleYear} ${newBid.vehicleMake} ${newBid.vehicleModel} ${newBid.vehicleTrim || ''}</p>
      <p><strong>Location:</strong> ${bidLocation.address || bidLocation.zipCode || 'Location provided'}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${directBidLink}" 
         style="background-color: #007bff; color: white; padding: 12px 30px; 
                text-decoration: none; border-radius: 5px; font-weight: bold; 
                display: inline-block; font-size: 16px;"
         target="_blank">
        View Bid & Submit Offer
      </a>
    </div>
    
    <p style="color: #666; margin-top: 20px; font-size: 14px;">
      Or copy and paste this link in your browser:<br>
      <span style="color: #007bff; word-break: break-all;">${directBidLink}</span>
    </p>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
      <p>You received this notification because you are within ${radiusToUse} miles of the bid location.</p>
    </div>
  </div>
`;
    };

    const buildSMSText = () => `
${customerInitials} posted a new bid!
Category: ${newBid.requestCategory}
Vehicle: ${newBid.vehicleYear} ${newBid.vehicleMake} ${newBid.vehicleModel}
Location: ${bidLocation.zipCode || bidLocation.address?.substring(0, 30) || 'Check dashboard'}
`;

    const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    // ---------------------- 5️⃣ SEND NOTIFICATIONS WITH PLAN-BASED DELAYS ----------------------
    const notificationPromises = [];

    for (const shop of nearbyShops) {
      // Get notification delay from plan (in minutes), default to 0 if no plan
      let notificationDelayMinutes = 0;
      
      if (shop.plan && shop.plan.features && shop.plan.features.notificationDelay) {
        notificationDelayMinutes = shop.plan.features.notificationDelay;
      }

      const emailHTML = buildEmailHTML();
      const smsText = buildSMSText();

      const sendNotifications = async () => {
        try {
          // EMAIL
          await sendEmail(shop.email, subject, emailHTML);

          // SMS - WITH DETAILED LOGGING AND VALIDATION
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

            // Construct full phone number
            const fullPhone = `+${countryCodeNumber}${cleanedPhone}`;

            console.log(`📱 SMS Details for ${shop.businessName}:`, {
              originalPhone: shop.phone,
              cleanedPhone: cleanedPhone,
              countryCode: countryCode,
              countryCodeNumber: countryCodeNumber,
              fullPhone: fullPhone,
              shopPlan: shop.plan?.name || 'No plan',
              notificationDelay: `${notificationDelayMinutes} minutes`,
              smsTextLength: smsText.length
            });

            // Validate phone number format (E.164 format for Twilio)
            if (!/^\+\d{10,15}$/.test(fullPhone)) {
              console.error(`❌ Invalid phone number format for ${shop.businessName}: ${fullPhone}`);
              console.error(`   Expected format: +[country code][phone number] (10-15 digits)`);
              return;
            }

            try {
              const message = await twilioClient.messages.create({
                body: smsText,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: fullPhone,
              });

              console.log(`✅ SMS sent to ${shop.businessName}:`, {
                messageId: message.sid,
                to: fullPhone,
                delayApplied: `${notificationDelayMinutes} minutes`
              });

            } catch (twilioError) {
              console.error(`❌ Twilio SMS Error for ${shop.businessName}:`, {
                errorCode: twilioError.code,
                errorMessage: twilioError.message,
                moreInfo: twilioError.moreInfo,
                phoneNumber: fullPhone,
                twilioFromNumber: process.env.TWILIO_PHONE_NUMBER,
                delayApplied: `${notificationDelayMinutes} minutes`
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
          }
        } catch (err) {
          console.error(`❌ Notification error for shop ${shop.businessName}:`, {
            error: err.message,
            stack: err.stack,
            delayApplied: `${notificationDelayMinutes} minutes`
          });
        }
      };

      // Apply notification delay based on plan
      if (notificationDelayMinutes > 0) {
        notificationPromises.push(
          new Promise(resolve => {
            setTimeout(async () => {
              console.log(`⏰ Delayed notification for ${shop.businessName} (${notificationDelayMinutes} minutes delay)`);
              await sendNotifications();
              resolve();
            }, notificationDelayMinutes * 60 * 1000); // Convert minutes to milliseconds
          })
        );
      } else {
        // Send immediately if no delay
        notificationPromises.push(sendNotifications());
      }
    }

    // Wait for all notifications to complete
    const results = await Promise.allSettled(notificationPromises);

    // Log summary of notification results
    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter(r => r.status === 'rejected').length;

    console.log(`📊 Notification Summary:`, {
      totalShops: nearbyShops.length,
      notificationsSent: fulfilled,
      notificationsFailed: rejected,
      radiusUsed: `${radiusToUse} miles`,
      timestamp: new Date().toISOString()
    });

    // Log any rejected promises
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`   ❌ Failed notification for shop ${nearbyShops[index]?.businessName}:`, result.reason);
      }
    });

  } catch (error) {
    console.error("❌ Error in notifyShopsForBid:", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};