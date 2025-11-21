import express from "express";
import { getGoogleAuthURL, googleCallback } from "../controllers/customerAuthController.js";

const router = express.Router();

router.get("/google", getGoogleAuthURL);
router.get("/google-callback", googleCallback);

export default router;
