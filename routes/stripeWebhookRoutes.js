import express from "express";
import { stripeWebhookHandler } from "../controllers/stripeWebhookController.js";

const router = express.Router();

// Use RAW parser only here
router.post('/stripe', express.raw({ type: "application/json" }), stripeWebhookHandler);

export default router;
