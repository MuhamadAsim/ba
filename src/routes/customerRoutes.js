import express from "express";
import {
  signup,
  verifyOtp,
  signin,
  updateProfile,
  forgotPassword,
  resetPassword,
} from "../controllers/customerAuthController.js";
import {getCustomerBidStats} from "../controllers/customerController.js"
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
router.put(
  "/profile",
  authenticateCustomer,
  upload.single("avatar"),
  updateProfile
);


//bids
router.get("/customer-stats/:userId", getCustomerBidStats);




export default router;
