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

    console.log("📍 Bid Location Data:", {
      latitude: bidLocation.latitude,
      longitude: bidLocation.longitude,
      address: bidLocation.address,
      zipCode: bidLocation.zipCode,
      country: bidLocation.country,
    });

    // Validate bid has location
    if (!bidLocation.latitude || !bidLocation.longitude) {
      console.log("❌ Bid missing location coordinates. Cannot filter shops.");
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
      console.log("⚠️ No shops found.");
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
        console.log(`⚠️ Shop ${shop.businessName} missing location data`);
        return false;
      }

      const distance = getDistanceMiles(customerLat, customerLng, shopLat, shopLng);
      const isWithinRadius = distance <= MAX_RADIUS_MILES;
      
      if (isWithinRadius) {
        console.log(`✅ Shop ${shop.businessName} is ${distance.toFixed(2)} miles away`);
      }
      
      return isWithinRadius;
    });

    console.log(`📍 ${nearbyShops.length} shops found within ${MAX_RADIUS_MILES} miles of bid location.`);

    if (!nearbyShops.length) {
      console.log("⚠️ No shops within radius.");
      return;
    }

    // ---------------------- 4️⃣ EMAIL + SMS TEMPLATES ----------------------
    const customerName = customer.name || "Customer";
    const subject = `${customerName} posted a bid`;

    const buildEmailHTML = () => `
      <h2>${customerName} posted a new bid</h2>
      <p><strong>Email:</strong> ${customer.email}</p>
      <p><strong>Category:</strong> ${newBid.requestCategory}</p>
      <p><strong>Description:</strong> ${newBid.serviceDescription}</p>
      <p><strong>Vehicle:</strong> ${newBid.vehicleYear} ${newBid.vehicleMake} ${newBid.vehicleModel} ${newBid.vehicleTrim || ''}</p>
      <p><strong>Location:</strong> ${bidLocation.address || bidLocation.zipCode || 'Location provided'}</p>
      <p><strong>Coordinates:</strong> ${bidLocation.latitude?.toFixed(6)}, ${bidLocation.longitude?.toFixed(6)}</p>
      <hr/>
      <p>You received this because you are within ${MAX_RADIUS_MILES} miles of the bid location.</p>
    `;

    const buildSMSText = () => `
${customerName} posted a new bid!
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
          console.log(`📧 Email sent → ${shop.email}`);

          // SMS
          if (shop.phone) {
            const fullPhone = `${shop.countryCode || "+1"}${shop.phone}`;

            await twilioClient.messages.create({
              body: smsText,
              from: process.env.TWILIO_PHONE_NUMBER,
              to: fullPhone,
            });

            console.log(`📱 SMS sent → ${fullPhone}`);
          }
        } catch (err) {
          console.error(`❌ Notification error for shop ${shop.businessName}:`, err.message);
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
    await Promise.allSettled(notificationPromises);

    console.log("✅ Notification workflow complete.");
  } catch (error) {
    console.error("❌ Error in notifyShopsForBid:", error);
  }
};