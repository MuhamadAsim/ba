import express from "express";
import { getGoogleAuthURL, googleCallback } from "../controllers/customerAuthController.js";
import { googleCallbackPartner,getGoogleAuthURLShop } from "../controllers/shopAuthController.js";



const router = express.Router();

router.get("/google", getGoogleAuthURL);
router.get("/google-partner", getGoogleAuthURLShop);
router.get("/google-callback", googleCallback);
router.get("/google-callback-partner", googleCallbackPartner);


export default router;
