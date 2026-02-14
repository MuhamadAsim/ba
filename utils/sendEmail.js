import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async (
  to,
  subject,
  html,
  options = {}
) => {
  const {
    from = process.env.SENDGRID_SENDER, // default (BACKWARD SAFE)
    replyTo,
    cc,
    bcc,
  } = options;

  const msg = {
    to,
    from,
    subject,
    html,
  };

  // Optional fields only added if present
  if (replyTo) msg.replyTo = replyTo;
  if (cc) msg.cc = cc;
  if (bcc) msg.bcc = bcc;

  try {
    await sgMail.send(msg);
  } catch (error) {
    console.error(
      "❌ Email send error:",
      error.response?.body || error
    );
    throw new Error("Failed to send email");
  }
};
