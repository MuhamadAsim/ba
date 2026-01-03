import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
//
export const sendEmail = async (to, subject, html) => {
  const msg = {
    to,
    from: process.env.SENDGRID_SENDER,
    subject,
    html,
  };

  try {
    await sgMail.send(msg);
  } catch (error) {
    console.error("❌ Email send error:", error.response?.body || error);
    throw new Error("Failed to send email");
  }
};