import Shop from "../models/shopModel.js";
import { sendEmail } from "./sendEmail.js";
import axios from "axios";
import twilio from "twilio";
import zipcodes from "zipcodes";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const MAX_RADIUS_MILES = 1500;

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
    const customerZip = customer.zip;

    if (!customerZip) {
      console.log("❌ Customer ZIP not provided. Cannot filter shops.");
      return;
    }

    let customerLat = null;
    let customerLng = null;

    // ---------------------- 1️⃣ TRY GOOGLE GEOCODING FIRST ----------------------
    try {
      const geoURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${customerZip}&components=country:US&key=${GOOGLE_API_KEY}`;
      const geoRes = await axios.get(geoURL);

      if (geoRes.data.results.length > 0) {
        customerLat = geoRes.data.results[0].geometry.location.lat;
        customerLng = geoRes.data.results[0].geometry.location.lng;

        console.log(`📍 Google resolved ZIP ${customerZip} → (${customerLat}, ${customerLng})`);
      } else {
        console.log(`⚠️ Google could NOT resolve ZIP ${customerZip}. Will try fallback.`);
      }
    } catch (err) {
      console.log("⚠️ Google API error. Trying fallback ZIP resolver.");
    }

    // ---------------------- 2️⃣ FALLBACK → ZIPCODE DATABASE ----------------------
    if (!customerLat || !customerLng) {
      const zipData = zipcodes.lookup(customerZip);

      if (zipData) {
        customerLat = zipData.latitude;
        customerLng = zipData.longitude;

        console.log(`📌 Fallback ZIP resolver → (${customerLat}, ${customerLng})`);
      } else {
        console.log(`❌ ZIP ${customerZip} is INVALID or not found in fallback DB.`);
        return;
      }
    }

    // ---------------------- 3️⃣ GET VERIFIED SHOPS ----------------------
    const shops = await Shop.find({
      status: "active",
      isEmailVerified: true,
      isVerified: true,
    }).select("email phone countryCode businessName ownerName location latitude longitude plan");

    if (!shops.length) {
      console.log("⚠️ No shops found.");
      return;
    }

    // ---------------------- 4️⃣ FILTER BY RADIUS (≤15 miles) ----------------------
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

      if (!shopLat || !shopLng) return false;

      const distance = getDistanceMiles(customerLat, customerLng, shopLat, shopLng);
      return distance <= MAX_RADIUS_MILES;
    });

    console.log(`📍 ${nearbyShops.length} shops found within 15 miles.`);

    if (!nearbyShops.length) return;

    // ---------------------- 5️⃣ EMAIL + SMS TEMPLATES ----------------------
    const customerName = customer.name || "Customer";
    const subject = `${customerName} posted a bid`;

    const buildEmailHTML = () => `
      <h2>${customerName} posted a new bid</h2>
      <p><strong>Email:</strong> ${customer.email}</p>
      <p><strong>Category:</strong> ${newBid.requestCategory}</p>
      <p><strong>Description:</strong> ${newBid.serviceDescription}</p>
      <p><strong>Vehicle:</strong> ${newBid.vehicleYear} ${newBid.vehicleMake} ${newBid.vehicleModel} ${newBid.vehicleTrim}</p>
      <p><strong>ZIP:</strong> ${customer.zip}</p>
      <hr/>
      <p>You received this because you are within 15 miles of the customer.</p>
    `;

    const buildSMSText = () => `
${customerName} posted a new bid!
Category: ${newBid.requestCategory}
Vehicle: ${newBid.vehicleYear} ${newBid.vehicleMake} ${newBid.vehicleModel}
ZIP: ${customer.zip}
Login to view.
    `;

    const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    // ---------------------- 6️⃣ SEND NOTIFICATIONS ----------------------
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
          console.error("❌ Notification error:", err);
        }
      };

      if (shop.plan === "professional") {
        await sendNotifications();
      } else {
        setTimeout(sendNotifications, 60 * 60 * 1000); // 1-hour delay
      }
    }

    console.log("✅ Notification workflow complete.");
  } catch (error) {
    console.error("❌ Error in notifyShopsForBid:", error);
  }
};
