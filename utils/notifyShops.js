import Shop from "../models/shopModel.js";
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
    const shops = await Shop.find({
      status: "active",
      isEmailVerified: true,
      isVerified: true,
    }).select("email phone countryCode businessName ownerName location latitude longitude plan");

    if (!shops.length) {
      return;
    }


    // ---------------------- 3️⃣ FILTER BY RADIUS (≤15 miles) USING BID LOCATION ----------------------
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
      const isWithinRadius = distance <= MAX_RADIUS_MILES;

  

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
    
    // Use initials in subject instead of full name
    const subject = `${customerInitials} posted a bid`;

    const buildEmailHTML = () => {
      return `
      <h2>${customerInitials} posted a new bid</h2>
      <p><strong>Category:</strong> ${newBid.requestCategory}</p>
      <p><strong>Description:</strong> ${newBid.serviceDescription}</p>
      <p><strong>Vehicle:</strong> ${newBid.vehicleYear} ${newBid.vehicleMake} ${newBid.vehicleModel} ${newBid.vehicleTrim || ''}</p>
      <p><strong>Location:</strong> ${bidLocation.address || bidLocation.zipCode || 'Location provided'}</p>
      <p><strong>Coordinates:</strong> ${bidLocation.latitude?.toFixed(6)}, ${bidLocation.longitude?.toFixed(6)}</p>
      <hr/>
      <p>You received this because you are within ${MAX_RADIUS_MILES} miles of the bid location.</p>
    `;
    };

    const buildSMSText = () => `
${customerInitials} posted a new bid!
Category: ${newBid.requestCategory}
Vehicle: ${newBid.vehicleYear} ${newBid.vehicleMake} ${newBid.vehicleModel}
Location: ${bidLocation.zipCode || bidLocation.address?.substring(0, 30) || 'Check dashboard'}
Login to view.
    `;

    const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    // ---------------------- 5️⃣ SEND NOTIFICATIONS ----------------------
    const notificationPromises = [];

    for (const shop of nearbyShops) {
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
              shopPlan: shop.plan,
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

              
            } catch (twilioError) {
              console.error(`❌ Twilio SMS Error for ${shop.businessName}:`, {
                errorCode: twilioError.code,
                errorMessage: twilioError.message,
                moreInfo: twilioError.moreInfo,
                phoneNumber: fullPhone,
                twilioFromNumber: process.env.TWILIO_PHONE_NUMBER
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
            stack: err.stack
          });
        }
      };

      // Professional plan shops get immediate notifications
      // Basic plan shops get delayed notifications
      if (shop.plan === "professional") {
        notificationPromises.push(sendNotifications());
      } else {
        notificationPromises.push(
          new Promise(resolve => {
            setTimeout(async () => {
              await sendNotifications();
              resolve();
            }, 60 * 60 * 1000); // 1-hour delay
          })
        );
      }
    }

    // Wait for all notifications to complete
    const results = await Promise.allSettled(notificationPromises);
    
    // Log summary of notification results
    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter(r => r.status === 'rejected').length;
    
 

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