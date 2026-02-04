import Admin from "../models/adminModel.js";
import { sendEmail } from "./sendEmail.js";

export const notifySuperAdminsNewShop = async (shop, plan) => {
  try {
    // ============================
    // 1️⃣ Notify SUPER ADMINS
    // ============================
    const superAdmins = await Admin.find({
      role: "super_admin",
      isActive: true,
    }).select("email");

    if (superAdmins.length) {
      const adminEmails = superAdmins.map((admin) => admin.email);

      const adminSubject = "New Shop Pending Approval";

      const adminHtml = `
        <h2>🚨 New Shop Requires Approval</h2>
        <p>A shop has completed registration and is waiting for admin approval.</p>

        <hr />

        <p><strong>Business Name:</strong> ${shop.businessName}</p>
        <p><strong>Owner Name:</strong> ${shop.ownerName}</p>
        <p><strong>Email:</strong> ${shop.email}</p>
        <p><strong>Country:</strong> ${shop.country}</p>
        <p><strong>Plan:</strong> ${plan?.name || "N/A"}</p>

        <hr />

        <p>Status: <b>Pending Approval</b></p>
        <p>Please review this shop in the admin dashboard.</p>
      `;

      await Promise.all(
        adminEmails.map((email) =>
          sendEmail(email, adminSubject, adminHtml)
        )
      );

      console.log("📧 Super admins notified:", adminEmails);
    } else {
      console.warn("⚠️ No active super admins found to notify");
    }

    // ============================
    // 2️⃣ Notify SHOP OWNER
    // ============================
    const shopSubject = "Your Shop Is Pending Admin Approval";

    const shopHtml = `
      <h2>✅ Registration Completed</h2>
      <p>Hi ${shop.ownerName || "there"},</p>

      <p>Your shop <strong>${shop.businessName}</strong> has been successfully registered.</p>

      <p>Our admin team is currently reviewing your information.</p>

      <hr />

      <p><strong>Current Status:</strong> Pending Admin Approval</p>
      <p>You’ll receive another email once your shop is approved.</p>

      <p>Thank you for choosing us 🚀</p>
    `;

    await sendEmail(shop.email, shopSubject, shopHtml);

    console.log("📧 Shop owner notified:", shop.email);

  } catch (error) {
    console.error("❌ Failed to notify admins / shop:", error);
  }
};
