import express from "express";
import { signup, signin, updateProfile } from "../controllers/customerAuthController.js";
import { authenticateCustomer } from "../middlewares/authCustomerMiddleware.js";
import { upload } from "../middlewares/upload.js"; // ✅ only import once

const router = express.Router();

// 🧩 Auth routes
router.post("/signup", signup);
router.post("/signin", signin);

// 🧑‍💼 Profile update route (with Cloudinary upload)
router.put(
  "/profile",
  authenticateCustomer,
  upload.single("avatar"), // ✅ use .single() to handle a single file field
  updateProfile
);

export default router;
