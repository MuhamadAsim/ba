// ============================================
// BACKEND: customerController.js - FIXED
// ============================================

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Customer from "../models/customerModel.js";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

// ---------------------- CONFIGURE SENDGRID ----------------------
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ---------------------- HELPERS ----------------------

// Generate 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP Email
const sendOtpEmail = async (email, otp) => {
  const msg = {
    to: email,
    from: process.env.SENDGRID_SENDER,
    subject: "Your Verification Code - PrimeBank",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;background:#f9f9f9;padding:20px;border-radius:8px;">
        <h2 style="color:#333;">Verify your account</h2>
        <p>Use the following code to verify your email address:</p>
        <h1 style="color:#2f54eb;">${otp}</h1>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <hr />
        <p style="font-size:12px;color:#888;">If you didn't request this, please ignore this email.</p>
      </div>
    `,
  };

  await sgMail.send(msg);
};

// ---------------------- SIGNUP (send OTP) ----------------------
export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password || !name)
      return res.status(400).json({ message: "All fields are required" });

    // Check if customer already exists
    const existing = await Customer.findOne({ email });

    if (existing) {
      // ✅ If already verified, reject signup
      if (existing.isEmailVerified) {
        return res.json({ 
          status: "exists", 
          message: "Account already exists. Please sign in instead." 
        });
      } else {
        // ✅ If not verified, resend OTP (allow retry)
        const otp = generateOtp();
        existing.otp = otp;
        existing.otpExpiry = Date.now() + 10 * 60 * 1000;
        await existing.save();

        await sendOtpEmail(email, otp);
        return res.json({ 
          status: "otp_sent", 
          message: "OTP sent to your email. Please verify your account." 
        });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate new OTP
    const otp = generateOtp();

    // Create new customer
    const newCustomer = new Customer({
      name,
      email,
      password: hashedPassword,
      avatar: "",
      phone: "",
      address: "",
      zip: "",
      isEmailVerified: false,
      otp,
      otpExpiry: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    await newCustomer.save();

    // Send OTP email
    await sendOtpEmail(email, otp);

    return res.json({ 
      status: "otp_sent", 
      message: "OTP sent to your email" 
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error during signup" });
  }
};

// ---------------------- VERIFY OTP ----------------------
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const customer = await Customer.findOne({ email });
    if (!customer) 
      return res.status(404).json({ 
        status: "error",
        message: "Customer not found" 
      });

    if (!customer.otp || !customer.otpExpiry)
      return res.json({ 
        status: "invalid", 
        message: "No OTP found. Please request a new one." 
      });

    if (customer.otp !== otp)
      return res.json({ 
        status: "invalid", 
        message: "Invalid OTP. Please check and try again." 
      });

    if (customer.otpExpiry < Date.now())
      return res.json({ 
        status: "expired", 
        message: "OTP expired. Please request a new one." 
      });

    // Mark as verified
    customer.isEmailVerified = true;
    customer.otp = undefined;
    customer.otpExpiry = undefined;
    await customer.save();

    // Generate JWT after verification
    const token = jwt.sign(
      { customerId: customer._id, email: customer.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      status: "verified",
      message: "Email verified successfully",
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        avatar: customer.avatar || null,
        phone: customer.phone || null,
        address: customer.address || null,
        zip: customer.zip || null,
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ 
      status: "error",
      message: "Server error during OTP verification" 
    });
  }
};

// ---------------------- SIGNIN ----------------------
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const customer = await Customer.findOne({ email });
    if (!customer) 
      return res.json({ 
        status: "invalid_credentials", 
        message: "Invalid email or password" 
      });

    // ✅ Check password FIRST before checking verification
    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch)
      return res.json({ 
        status: "invalid_credentials", 
        message: "Invalid email or password" 
      });

    // ✅ If credentials are correct but NOT verified, send OTP
    if (!customer.isEmailVerified) {
      const otp = generateOtp();
      customer.otp = otp;
      customer.otpExpiry = Date.now() + 10 * 60 * 1000;
      await customer.save();

      await sendOtpEmail(email, otp);
      
      return res.json({ 
        status: "not_verified", 
        message: "Email not verified. OTP sent to your email." 
      });
    }

    // ✅ Generate JWT for verified user
    const token = jwt.sign(
      { customerId: customer._id, email: customer.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      status: "success",
      message: "Login successful",
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        avatar: customer.avatar || null,
        phone: customer.phone || null,
        address: customer.address || null,
        zip: customer.zip || null,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ 
      status: "error",
      message: "Server error during signin" 
    });
  }
};

// ---------------------- UPDATE PROFILE ----------------------
export const updateProfile = async (req, res) => {
  try {
    const customer = req.customer; // from authenticateCustomer middleware

    // Only allow updates to specific fields
    const fieldsToUpdate = ["name", "phone", "address", "zip"];
    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) customer[field] = req.body[field];
    });

    // ✅ If avatar file uploaded (Cloudinary)
    if (req.file) {
      customer.avatar = req.file.path; // Cloudinary gives the full URL here
    }

    await customer.save();

    res.status(200).json({
      message: "Profile updated successfully",
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone || "",
        address: customer.address || "",
        zip: customer.zip || "",
        avatar: customer.avatar || "",
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      message: "Server error while updating profile",
      error: error.message,
    });
  }
};










// ============================================
// FORGOT PASSWORD CONTROLLERS
// ============================================


// ---------------------- FORGOT PASSWORD (send OTP) ----------------------
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        status: "error",
        message: "Email is required" 
      });
    }

    // Find customer by email
    const customer = await Customer.findOne({ email });

    if (!customer) {
      return res.json({ 
        status: "not_found", 
        message: "No account found with this email address" 
      });
    }

    // Check if email is verified
    if (!customer.isEmailVerified) {
      return res.json({ 
        status: "not_verified", 
        message: "Please verify your email first before resetting password" 
      });
    }

    // Generate new OTP for password reset
    const otp = generateOtp();
    
    // Store OTP in customer document
    customer.resetPasswordOtp = otp;
    customer.resetPasswordOtpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    await customer.save();

    // Send OTP email
    await sendPasswordResetEmail(email, otp);

    return res.json({ 
      status: "otp_sent", 
      message: "Password reset code sent to your email" 
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ 
      status: "error",
      message: "Server error during password reset request" 
    });
  }
};

// ---------------------- RESET PASSWORD ----------------------
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ 
        status: "error",
        message: "Email, OTP, and new password are required" 
      });
    }

    // Validate password length
    if (newPassword.length < 6) {
      return res.json({ 
        status: "error",
        message: "Password must be at least 6 characters long" 
      });
    }

    // Find customer
    const customer = await Customer.findOne({ email });

    if (!customer) {
      return res.status(404).json({ 
        status: "error",
        message: "Customer not found" 
      });
    }

    // Check if OTP exists
    if (!customer.resetPasswordOtp || !customer.resetPasswordOtpExpiry) {
      return res.json({ 
        status: "invalid_otp", 
        message: "No reset code found. Please request a new one." 
      });
    }

    // Verify OTP
    if (customer.resetPasswordOtp !== otp) {
      return res.json({ 
        status: "invalid_otp", 
        message: "Invalid reset code. Please check and try again." 
      });
    }

    // Check if OTP expired
    if (customer.resetPasswordOtpExpiry < Date.now()) {
      return res.json({ 
        status: "invalid_otp", 
        message: "Reset code expired. Please request a new one." 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP fields
    customer.password = hashedPassword;
    customer.resetPasswordOtp = undefined;
    customer.resetPasswordOtpExpiry = undefined;
    await customer.save();

    return res.json({
      status: "success",
      message: "Password reset successfully. You can now sign in with your new password.",
    });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ 
      status: "error",
      message: "Server error during password reset" 
    });
  }
};

// ---------------------- SEND PASSWORD RESET EMAIL ----------------------
const sendPasswordResetEmail = async (email, otp) => {
  const msg = {
    to: email,
    from: process.env.SENDGRID_SENDER,
    subject: "Password Reset Code - PrimeBank",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;background:#f9f9f9;padding:20px;border-radius:8px;">
        <h2 style="color:#333;">Reset Your Password</h2>
        <p>You requested to reset your password. Use the following code to continue:</p>
        <h1 style="color:#2f54eb;">${otp}</h1>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p style="margin-top:20px;">If you didn't request a password reset, you can safely ignore this email.</p>
        <hr />
        <p style="font-size:12px;color:#888;">This is an automated email. Please do not reply.</p>
      </div>
    `,
  };

  await sgMail.send(msg);
};