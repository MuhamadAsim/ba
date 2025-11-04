import express from "express";
import {
  signup,
  verifyOtp,
  signin,
  updateProfile,
} from "../controllers/customerAuthController.js";
import { authenticateCustomer } from "../middlewares/authCustomerMiddleware.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

// 🧩 Auth routes (OTP-based)
router.post("/signup", signup);          // Step 1: register + send OTP
router.post("/verify-otp", verifyOtp);   // Step 2: verify OTP
router.post("/signin", signin);          // Step 3: normal login after verification

// 🧑‍💼 Profile update (with Cloudinary upload)
router.put(
  "/profile",
  authenticateCustomer,
  upload.single("avatar"),
  updateProfile
);

export default router;
