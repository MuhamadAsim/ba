import Shop from "../models/shopModel.js";
import { sendEmail } from "./sendEmail.js";
import axios from "axios";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const MAX_RADIUS_MILES = 15;

// Haversine distance calculation
const getDistanceMiles = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8; // Earth radius in miles

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const notifyShopsForBid = async (newBid, customer) => {
  try {
    const customerZip = customer.zip;

    if (!customerZip) {
      console.log("❌ Customer zip not provided, skipping radius filter.");
      return;
    }

    // --------------------------------------------
    // 1️⃣ Convert ZIP → Lat/Lng using Google Maps
    // --------------------------------------------

    const geoURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${customerZip}&key=${GOOGLE_API_KEY}`;
    const geoRes = await axios.get(geoURL);

    if (!geoRes.data.results.length) {
      console.log("⚠️ Could not resolve customer ZIP to coordinates.");
      return;
    }

    const customerLat = geoRes.data.results[0].geometry.location.lat;
    const customerLng = geoRes.data.results[0].geometry.location.lng;

    // --------------------------------------------
    // 2️⃣ Get ALL shops that match category
    // --------------------------------------------

    const shops = await Shop.find({
      services: { $in: [newBid.requestCategory] },
      status: "active",
      isEmailVerified: true,
      isVerified: true,
    }).select("email phone businessName ownerName location latitude longitude");

    if (!shops.length) {
      console.log("⚠️ No shops found for this service category.");
      return;
    }

    // --------------------------------------------
    // 3️⃣ Filter shops by RADIUS ≤ 15 miles
    // --------------------------------------------
    const nearbyShops = shops.filter((shop) => {
      let shopLat = null;
      let shopLng = null;

      // Prefer GeoJSON coordinates
      if (shop.location?.coordinates?.length === 2) {
        shopLng = shop.location.coordinates[0];
        shopLat = shop.location.coordinates[1];
      }
      // Fallback to old fields
      else if (shop.latitude && shop.longitude) {
        shopLat = shop.latitude;
        shopLng = shop.longitude;
      }

      if (!shopLat || !shopLng) return false;

      const distance = getDistanceMiles(
        customerLat,
        customerLng,
        shopLat,
        shopLng
      );

      return distance <= MAX_RADIUS_MILES;
    });

    console.log(`📍 Found ${nearbyShops.length} nearby shops within 15 miles.`);

    if (!nearbyShops.length) {
      console.log("⚠️ No shops within 15 miles radius.");
      return;
    }

    // --------------------------------------------
    // 4️⃣ Build email template
    // --------------------------------------------

    const customerName = customer.name || "Customer";
    const subject = `${customerName} posted a bid`;

    const buildEmailHTML = () => `
      <h2>${customerName} posted a new bid</h2>
      <p><strong>Customer Name:</strong> ${customerName}</p>
      <p><strong>Customer Email:</strong> ${customer.email}</p>

      <h3>Bid Details:</h3>
      <p><strong>Category:</strong> ${newBid.requestCategory}</p>
      <p><strong>Description:</strong> ${newBid.serviceDescription}</p>
      <p><strong>Vehicle:</strong> 
         ${newBid.vehicleYear} ${newBid.vehicleMake} 
         ${newBid.vehicleModel} ${newBid.vehicleTrim}</p>
      <p><strong>Condition:</strong> ${newBid.vehicleCondition}</p>
      <p><strong>Has Existing Wrap:</strong> ${
        newBid.hasExistingWrap ? "Yes" : "No"
      }</p>
      <p><strong>Desired Finish:</strong> ${newBid.desiredFinish}</p>

      <p><strong>Due Date:</strong> ${newBid.dueDate || "Not specified"}</p>
      <p><strong>Customer ZIP:</strong> ${customer.zip}</p>

      <hr/>
      <p>You received this bid because your shop is within <strong>15 miles</strong> of the customer.</p>
    `;

    // --------------------------------------------
    // 5️⃣ Send emails
    // --------------------------------------------
    for (const shop of nearbyShops) {
      await sendEmail(shop.email, subject, buildEmailHTML());
    }

    console.log(`📧 Email sent to ${nearbyShops.length} shops.`);

    // --------------------------------------------
    // 6️⃣ SMS (Twilio) — OPTIONAL
    // --------------------------------------------
    /*
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    const smsText = `
${customerName} posted a new bid!

Category: ${newBid.requestCategory}
Vehicle: ${newBid.vehicleYear} ${newBid.vehicleMake} ${newBid.vehicleModel}
ZIP: ${customer.zip}

Login to your dashboard to view the bid.
    `;

    for (const shop of nearbyShops) {
      if (shop.phone) {
        await client.messages.create({
          body: smsText,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: shop.phone,
        });
      }
    }

    console.log("📱 SMS sent.");
    */
  } catch (error) {
    console.error("❌ Error notifying shops:", error);
  }
};
