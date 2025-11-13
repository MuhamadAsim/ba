import express from "express";
import {
  signup,
  verifyOtp,
  signin,
  updateProfile,
  forgotPassword,
  resetPassword,
  googleAuth,
  googleCallback,
  
} from "../controllers/customerAuthController.js";
import {getCustomerBidStats , getUserBidsWithOffers , getBidOffers , acceptOffer, cancelBid ,repostBid} from "../controllers/customerController.js"
import { authenticateCustomer } from "../middlewares/authCustomerMiddleware.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

// 🧩 Auth routes (OTP-based)
router.post("/signup", signup);          // Step 1: register + send OTP
router.post("/verify-otp", verifyOtp);   // Step 2: verify OTP
router.post("/signin", signin);          // Step 3: normal login after verification
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// 🧑‍💼 Profile update (with Cloudinary upload)
router.put("/profile" , authenticateCustomer, upload.single("avatar"), updateProfile);


//bids
router.get("/customer-stats/:userId", getCustomerBidStats);
router.get("/my-bids", authenticateCustomer, getUserBidsWithOffers);
router.get("/:bidId/offers", authenticateCustomer, getBidOffers);
router.post("/offers/:offerId/accept", authenticateCustomer, acceptOffer);
router.patch("/:bidId/cancel", authenticateCustomer, cancelBid);
router.post("/repost-bid", authenticateCustomer, repostBid);

router.get("/google-OAuth", googleAuth);






export default router;
