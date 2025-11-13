
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


const router = express.Router();



router.get("/", googleCallback);


export default router;

