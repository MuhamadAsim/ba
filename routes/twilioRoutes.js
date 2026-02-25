import express from "express";
import { handleSmsReply, handleSmsStatus } from "../controllers/twilioWebhookController.js";

const router = express.Router();

// Twilio webhook endpoints (NO authentication - Twilio calls these)
router.post("/sms/reply", handleSmsReply);
router.post("/sms/status", handleSmsStatus);

export default router;