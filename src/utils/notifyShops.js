// utils/notifyShops.js
import Shop from "../models/shopModel.js";
import { sendEmail } from "./sendEmail.js";
// import twilio from "twilio";  

export const notifyShopsForBid = async (newBid, customer) => {
  try {
    const customerName = customer.name || "Customer";

    // 1️⃣ Fetch shops that provide the requested service
    const shops = await Shop.find({
      services: { $in: [newBid.requestCategory] },
      status: "active",
      isEmailVerified: true,
      isVerified: true,
    }).select("email phone businessName ownerName");

    if (!shops.length) {
      console.log("⚠️ No shops found matching the service category.");
      return;
    }

    // 2️⃣ Build email subject
    const subject = `${customerName} posted a bid`;

    // 3️⃣ Create reusable HTML template for shops
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
      <p><strong>Desired Finish:</strong> ${newBid.desiredFinish}</p>
      <p><strong>Has Existing Wrap:</strong> ${newBid.hasExistingWrap ? "Yes" : "No"}</p>
      <p><strong>Due Date:</strong> ${newBid.dueDate || "Not specified"}</p>
      <p><strong>Customer ZIP:</strong> ${customer.zip || "N/A"}</p>

      <hr/>
      <p>You received this bid because your shop offers services in: <strong>${newBid.requestCategory}</strong>.</p>
    `;

    // 4️⃣ Send emails to all shops
    for (const shop of shops) {
      await sendEmail(shop.email, subject, buildEmailHTML());
    }

    console.log(`📧 Sent bid notification email to ${shops.length} shops.`);

    // -------------------------------------------------------------
    // 5️⃣ TWILIO SMS SECTION (COMMENTED OUT — NOT ACTIVE NOW)
    // -------------------------------------------------------------
    /*
    // Uncomment when Twilio keys are available
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    const smsMessage = `
${customerName} posted a new bid!

Category: ${newBid.requestCategory}
Vehicle: ${newBid.vehicleYear} ${newBid.vehicleMake} ${newBid.vehicleModel}
Description: ${newBid.serviceDescription}
Customer Email: ${customer.email}
ZIP: ${customer.zip}

Login to your shop dashboard to view this bid.
    `;

    for (const shop of shops) {
      if (shop.phone) {
        await client.messages.create({
          body: smsMessage,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: shop.phone,
        });
      }
    }

    console.log(\`📱 SMS sent to \${shops.length} shops.\`);
    */
    // -------------------------------------------------------------

  } catch (error) {
    console.error("❌ Error notifying shops:", error);
  }
};
