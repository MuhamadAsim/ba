import jwt from "jsonwebtoken";
import crypto from "crypto";
import Admin from "../models/adminModel.js";
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js"
import Event from "../models/eventModel.js";
import VerificationRequest from "../models/updateProfileModel.js";
import { sendEmail } from "../utils/sendEmail.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import sgMail from "@sendgrid/mail";
import Stripe from "stripe";
import validator from "validator";
import Plan from "../models/planModel.js"


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ===== IN-MEMORY OTP STORE =====
// NOTE: For production, consider using Redis for scalability and persistence
const otpStore = {};

// ===== CONFIGURATION =====
const OTP_LENGTH = Number(process.env.OTP_LENGTH) || 6;
const OTP_EXPIRY_MS = Number(process.env.OTP_EXPIRY_MS) || 5 * 60 * 1000; // 5 minutes
const MAX_VERIFICATION_ATTEMPTS = 5;
const JWT_EXPIRY = process.env.JWT_EXPIRY || "1d";

// ===== CLEANUP OLD OTPs =====
setInterval(() => {
  const now = Date.now();
  Object.keys(otpStore).forEach((email) => {
    if (otpStore[email].expiresAt < now) {
      delete otpStore[email];
    }
  });
}, 60000);

// ===== UTILITY FUNCTIONS =====

/**
 * Generate a random numeric OTP
 * @param {number} length - Length of OTP
 * @returns {string} - Generated OTP
 */
function generateOtp(length = OTP_LENGTH) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/*
 * Hash OTP for secure storage
 * @param {string} otp - Plain text OTP
 * @returns {string} - Hashed OTP
 */


function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

// // ===== ADMIN INITIALIZATION =====
// // This ensures there's at least one admin in the database
// const initializeAdmin = async () => {
//   try {
//     // Check if any admin exists
//     const adminCount = await Admin.countDocuments();

//     if (adminCount <= 1) {
//       // Create initial admin from environment variables (for backward compatibility)
//       const defaultAdminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
//       const defaultAdminPassword = process.env.ADMIN_PASSWORD || "Admin@123";

//       await Admin.create({
//         email: defaultAdminEmail,
//         password: defaultAdminPassword,
//         isActive: true
//       });

//     }
//   } catch (error) {
//     console.error("Error initializing admin:", error);
//   }
// };

// // Initialize admin on startup
// initializeAdmin();

// ===== AUTHENTICATION ENDPOINTS =====

/**
 * POST /api/admin/login
 * Body: { email, password }
 * - Validates credentials against Admin model
 * - Generates and stores OTP
 * - Sends OTP via email
//  */
// export const adminLogin = async (req, res) => {
//   try {
//     const { email, password } = req.body || {};

//     // Validate input
//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Email and password are required",
//       });
//     }

//     // Find admin by email
//     const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

//     // Check if admin exists and is active
//     if (!admin) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     if (!admin.isActive) {
//       return res.status(403).json({
//         success: false,
//         message: "Admin account is disabled",
//       });
//     }

//     // Validate credentials
//     const isPasswordValid = await admin.comparePassword(password);
//     if (!isPasswordValid) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     // Generate OTP
//     const otp = generateOtp();
//     const hashedOtp = hashOtp(otp);
//     const expiresAt = Date.now() + OTP_EXPIRY_MS;

//     // Store OTP with metadata
//     otpStore[email] = {
//       otp: hashedOtp,
//       expiresAt,
//       attempts: 0,
//       createdAt: Date.now(),
//       adminId: admin._id, // Store admin ID for verification
//       purpose: "login", // Track OTP purpose
//     };

//     // Update last login time
//     admin.lastLogin = new Date();
//     await admin.save();

//     // Send OTP email
//     const subject = "Your Admin Login OTP Code";
//     const html = `
//       <div style="font-family: Arial, sans-serif; padding: 20px;">
//         <h2>Admin Login Verification</h2>
//         <p>Your OTP code for login is:</p>
//         <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
//         <p>This code will expire in <strong>${Math.floor(
//       OTP_EXPIRY_MS / 60000
//     )} minute(s)</strong>.</p>
//         <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
//       </div>
//     `;

//     // Call sendEmail with correct parameters (to, subject, html)
//     await sendEmail(email, subject, html);

//     return res.status(200).json({
//       success: true,
//       message: "OTP sent to your email",
//     });
//   } catch (error) {
//     console.error("adminLogin error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to send OTP. Please try again.",
//     });
//   }
// };

// /**
//  * POST /api/admin/verify-otp
//  * Body: { email, otp }
//  * - Validates OTP, expiry, and attempts
//  * - Returns JWT token on success
//  */
// export const verifyOtp = async (req, res) => {
//   try {
//     const { email, otp } = req.body || {};

//     // Validate input
//     if (!email || !otp) {
//       return res.status(400).json({
//         success: false,
//         message: "Email and OTP are required",
//       });
//     }

//     // Check if OTP exists
//     const record = otpStore[email];
//     if (!record) {
//       return res.status(400).json({
//         success: false,
//         message: "No OTP found. Please request a new one.",
//       });
//     }

//     // Check if OTP expired
//     if (Date.now() > record.expiresAt) {
//       delete otpStore[email];
//       return res.status(400).json({
//         success: false,
//         message: "OTP has expired. Please request a new one.",
//       });
//     }

//     // Check verification attempts
//     if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
//       delete otpStore[email];
//       return res.status(429).json({
//         success: false,
//         message: "Too many failed attempts. Please request a new OTP.",
//       });
//     }

//     // Verify OTP
//     const hashedInputOtp = hashOtp(String(otp).trim());
//     if (record.otp !== hashedInputOtp) {
//       otpStore[email].attempts = record.attempts + 1;
//       const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - otpStore[email].attempts;
//       return res.status(400).json({
//         success: false,
//         message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
//       });
//     }

//     // Get admin data from database
//     const admin = await Admin.findById(record.adminId);
//     if (!admin) {
//       delete otpStore[email];
//       return res.status(404).json({
//         success: false,
//         message: "Admin account not found",
//       });
//     }

//     // Success: Remove OTP and generate JWT
//     delete otpStore[email];

//     const token = jwt.sign(
//       {
//         email,
//         role: "admin",
//         adminId: admin._id,
//         isActive: admin.isActive
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: JWT_EXPIRY }
//     );

//     const adminInfo = {
//       id: admin._id,
//       email,
//       role: "admin",
//       isActive: admin.isActive,
//       lastLogin: admin.lastLogin,
//       createdAt: admin.createdAt,
//     };

//     return res.status(200).json({
//       success: true,
//       message: "Login successful",
//       token,
//       admin: adminInfo,
//     });
//   } catch (error) {
//     console.error("verifyOtp error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Verification failed. Please try again.",
//     });
//   }
// };






export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find admin by email
    const admin = await Admin.findOne({ email: normalizedEmail });

    // Check if admin exists and is active
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been disabled. Please contact a super admin.",
      });
    }

    // Validate credentials
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate OTP
    const otp = generateOtp();
    const hashedOtp = hashOtp(otp);
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    // Store OTP with metadata
    otpStore[normalizedEmail] = {
      otp: hashedOtp,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
      adminId: admin._id, // Store admin ID for verification
      purpose: "login", // Track OTP purpose
      role: admin.role, // Store role for token generation
    };

    // Update last login time
    admin.lastLogin = new Date();
    await admin.save();

    // Send OTP email
    const subject = "Your Admin Login OTP Code";
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Admin Login Verification</h2>
        <p>Your OTP code for login is:</p>
        <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>This code will expire in <strong>${Math.floor(
      OTP_EXPIRY_MS / 60000
    )} minute(s)</strong>.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `;

    await sendEmail(normalizedEmail, subject, html);

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email",
      expiresIn: OTP_EXPIRY_MS / 1000, // Return in seconds for frontend
    });
  } catch (error) {
    console.error("adminLogin error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP. Please try again.",
    });
  }
};






export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};

    // Validate input
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if OTP exists
    const record = otpStore[normalizedEmail];
    if (!record) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please request a new one.",
      });
    }

    // Check if OTP expired
    if (Date.now() > record.expiresAt) {
      delete otpStore[normalizedEmail];
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Check verification attempts
    if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      delete otpStore[normalizedEmail];
      return res.status(429).json({
        success: false,
        message: "Too many failed attempts. Please request a new OTP.",
      });
    }

    // Verify OTP
    const hashedInputOtp = hashOtp(String(otp).trim());
    if (record.otp !== hashedInputOtp) {
      otpStore[normalizedEmail].attempts = record.attempts + 1;
      const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - otpStore[normalizedEmail].attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
      });
    }

    // Get admin data from database
    const admin = await Admin.findById(record.adminId);
    if (!admin) {
      delete otpStore[normalizedEmail];
      return res.status(404).json({
        success: false,
        message: "Admin account not found",
      });
    }

    // Check if admin is still active
    if (!admin.isActive) {
      delete otpStore[normalizedEmail];
      return res.status(403).json({
        success: false,
        message: "Your account has been disabled. Please contact a super admin.",
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token with admin data
    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: admin.role, // Use actual role from database
        isActive: admin.isActive
      },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Prepare admin info for response
    const adminInfo = {
      id: admin._id,
      email: admin.email,
      role: admin.role, // Include actual role
      isActive: admin.isActive,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt,
    };

    // Clean up OTP store
    delete otpStore[normalizedEmail];

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      admin: adminInfo,
    });
  } catch (error) {
    console.error("verifyOtp error:", error);
    return res.status(500).json({
      success: false,
      message: "Verification failed. Please try again.",
    });
  }
};


















/**
 * POST /api/admin/resend-otp
 * Body: { email }
 * - Generates new OTP and sends via email
 */
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body || {};

    // Validate input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if admin exists
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Admin account is disabled",
      });
    }

    // Get OTP purpose from existing record or default to "login"
    const existingRecord = otpStore[email];
    const purpose = existingRecord?.purpose || "login";

    // Generate new OTP
    const otp = generateOtp();
    const hashedOtp = hashOtp(otp);
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    // Store new OTP
    otpStore[email] = {
      otp: hashedOtp,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
      adminId: admin._id,
      purpose: purpose,
    };

    // Determine email subject based on purpose
    const subject = purpose === "password_change"
      ? "Your Admin Password Change OTP Code"
      : "Your New Admin Login OTP Code";

    const actionText = purpose === "password_change"
      ? "password change"
      : "login";

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Admin ${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Verification</h2>
        <p>Your new OTP code for ${actionText} is:</p>
        <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>This code will expire in <strong>${Math.floor(
      OTP_EXPIRY_MS / 60000
    )} minute(s)</strong>.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `;

    await sendEmail(email, subject, html);

    return res.status(200).json({
      success: true,
      message: `New OTP sent to your email for ${actionText}`,
      purpose: purpose,
    });
  } catch (error) {
    console.error("resendOtp error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP. Please try again.",
    });
  }
};

/**
 * GET /api/admin/verify-token
 * Middleware-friendly endpoint to verify JWT token validity
 */
export const verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify admin still exists and is active
    const admin = await Admin.findOne({
      email: decoded.email,
      isActive: true
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin account not found or disabled",
      });
    }

    return res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        email: decoded.email,
        role: decoded.role,
        isActive: admin.isActive,
        lastLogin: admin.lastLogin,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// ===== PASSWORD CHANGE ENDPOINTS =====

/**
 * POST /api/admin/request-password-change
 * Body: { email }
 * - Initiates password change process by sending OTP to email
 * - Requires the admin to be logged in (authenticated)
 */
export const requestPasswordChange = async (req, res) => {
  try {
    const { email } = req.body || {};

    // Validate input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if admin exists
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Admin account is disabled",
      });
    }

    // Generate OTP for password change
    const otp = generateOtp();
    const hashedOtp = hashOtp(otp);
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    // Store OTP with password change purpose
    otpStore[email] = {
      otp: hashedOtp,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
      adminId: admin._id,
      purpose: "password_change",
    };

    // Send OTP email for password change
    const subject = "Your Admin Password Change OTP Code";
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Admin Password Change Verification</h2>
        <p>Your OTP code for password change is:</p>
        <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>This code will expire in <strong>${Math.floor(
      OTP_EXPIRY_MS / 60000
    )} minute(s)</strong>.</p>
        <p style="color: #ff6b6b; font-weight: bold;">Do not share this OTP with anyone.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request a password change, please secure your account immediately.</p>
      </div>
    `;

    await sendEmail(email, subject, html);

    return res.status(200).json({
      success: true,
      message: "Password change OTP sent to your email",
    });
  } catch (error) {
    console.error("requestPasswordChange error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send password change OTP. Please try again.",
    });
  }
};

/**
 * POST /api/admin/verify-password-change-otp
 * Body: { email, otp, newPassword }
 * - Verifies OTP for password change
 * - Changes password if OTP is valid
 */
export const verifyPasswordChangeOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};

    // Validate input
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required",
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Check if OTP exists
    const record = otpStore[email];
    if (!record) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please request a new one.",
      });
    }

    // Check if OTP is for password change
    if (record.purpose !== "password_change") {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP purpose",
      });
    }

    // Check if OTP expired
    if (Date.now() > record.expiresAt) {
      delete otpStore[email];
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Check verification attempts
    if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      delete otpStore[email];
      return res.status(429).json({
        success: false,
        message: "Too many failed attempts. Please request a new OTP.",
      });
    }

    // Verify OTP
    const hashedInputOtp = hashOtp(String(otp).trim());
    if (record.otp !== hashedInputOtp) {
      otpStore[email].attempts = record.attempts + 1;
      const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - otpStore[email].attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
      });
    }

    // Get admin
    const admin = await Admin.findById(record.adminId);
    if (!admin) {
      delete otpStore[email];
      return res.status(404).json({
        success: false,
        message: "Admin account not found",
      });
    }

    // Check if new password is same as old password
    const isSamePassword = await admin.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Update password
    admin.password = newPassword; // This will be hashed by the pre-save hook
    await admin.save();

    // Remove OTP after successful password change
    delete otpStore[email];

    // Send confirmation email
    const subject = "Admin Password Changed Successfully";
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Admin Password Changed</h2>
        <p style="color: #4CAF50; font-weight: bold;">Your password has been changed successfully.</p>
        <p>If you did not make this change, please contact support immediately.</p>
        <p style="color: #666; font-size: 12px;">Time: ${new Date().toLocaleString()}</p>
      </div>
    `;

    await sendEmail(email, subject, html);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("verifyPasswordChangeOtp error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to change password. Please try again.",
    });
  }
};

/**
 * PUT /api/admin/change-password
 * Body: { currentPassword, newPassword }
 * - Changes password while logged in (requires current password)
 * - Requires authentication via JWT token
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const adminId = req.admin?.id; // Assuming admin ID is attached by authentication middleware

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    // Get admin
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin account not found",
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Admin account is disabled",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await admin.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Check if new password is same as current password
    const isSamePassword = await admin.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Update password
    admin.password = newPassword; // This will be hashed by the pre-save hook
    await admin.save();

    // Send confirmation email
    const subject = "Admin Password Changed Successfully";
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Admin Password Changed</h2>
        <p style="color: #4CAF50; font-weight: bold;">Your password has been changed successfully.</p>
        <p>If you did not make this change, please contact support immediately.</p>
        <p style="color: #666; font-size: 12px;">Time: ${new Date().toLocaleString()}</p>
      </div>
    `;

    await sendEmail(admin.email, subject, html);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to change password. Please try again.",
    });
  }
};

/**
 * Optional: Admin management endpoints
 */

/**
 * POST /api/admin/create
 * Create a new admin (protected endpoint)
 */
export const createAdmin = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin with this email already exists",
      });
    }

    const admin = await Admin.create({
      email: email.toLowerCase().trim(),
      password,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      admin: {
        id: admin._id,
        email: admin.email,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    console.error("createAdmin error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create admin",
    });
  }
};

/**
 * PUT /api/admin/:id/toggle-status
 * Toggle admin active status (protected endpoint)
 */
export const toggleAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean",
      });
    }

    const admin = await Admin.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Admin ${isActive ? 'activated' : 'deactivated'} successfully`,
      admin: {
        id: admin._id,
        email: admin.email,
        isActive: admin.isActive,
      },
    });
  } catch (error) {
    console.error("toggleAdminStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update admin status",
    });
  }
};

































export const getDashboardStats = async (req, res) => {
  try {
    // Run all queries in parallel for better performance
    const [totalShops, totalUsers, completedBids, activeBids] = await Promise.all([
      Shop.countDocuments({
        isEmailVerified: true,
        isVerified: true  // Only count admin-approved shops
      }),
      Customer.countDocuments({ isEmailVerified: true }),
      Bid.countDocuments({ status: "completed" }),
      Bid.countDocuments({ status: "active" }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalShops,
        totalUsers,
        completedBids,
        activeBids,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message,
    });
  }
};


/**
 * GET /api/admin/dashboard/overview
 * Returns recent activities and top shops
 */
export const getDashboardOverview = async (req, res) => {
  try {
    // ===== TOP SHOPS BY COMPLETED BIDS =====
    const topShops = await Shop.aggregate([
      {
        $match: {
          isEmailVerified: true,
          isVerified: true, // Only verified shops
          businessName: { $exists: true, $ne: "" }
        }
      },
      {
        $lookup: {
          from: "bids",
          localField: "_id",
          foreignField: "shopId",
          as: "bids",
        },
      },
      {
        $addFields: {
          completedBids: {
            $size: {
              $filter: {
                input: "$bids",
                as: "bid",
                cond: { $eq: ["$$bid.status", "completed"] },
              },
            },
          },
        },
      },
      {
        $project: {
          businessName: 1,
          ownerName: 1,
          completedBids: 1,
          plan: 1,
        },
      },
      { $sort: { completedBids: -1 } },
      { $limit: 5 },
    ]);

    // Format shops for frontend
    const formattedShops = topShops.map((shop) => ({
      id: shop._id.toString(),
      name: shop.businessName,
      owner: shop.ownerName || "Unknown Owner",
      completedBids: shop.completedBids,
      subscription: {
        plan: shop.plan || "basic",
      },
    }));

    return res.status(200).json({
      success: true,
      data: {
        shops: formattedShops,
        // Activities are now fetched separately via /api/admin/activities
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard overview:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard overview",
      error: error.message,
    });
  }
};






export const getAdminActivities = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    // Optional filters
    const { type, startDate, endDate, search } = req.query;

    // Build query
    const query = {};

    // Filter by activity type
    if (type && type !== 'all') {
      query.type = type;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Search in message or title
    if (search) {
      query.$or = [
        { message: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { 'metadata.customerName': { $regex: search, $options: 'i' } },
        { 'metadata.shopName': { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const totalEvents = await Event.countDocuments(query);

    // Fetch events with pagination
    const events = await Event.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customerId", "name email")
      .populate("shopId", "businessName email")
      .populate("bidId", "requestCategory amount status")
      .lean();

    // Format activities for frontend - MATCHING FRONTEND INTERFACE
    const formattedActivities = events.map((activity) => {
      // Get user information
      let userName = "Unknown User";
      let userEmail = "";
      let shopName = null;
      
      if (activity.customerId) {
        userName = activity.customerId.name || "Unknown Customer";
        userEmail = activity.customerId.email || "";
      } else if (activity.shopId) {
        userName = activity.shopId.businessName || "Unknown Shop";
        userEmail = activity.shopId.email || "";
        shopName = activity.shopId.businessName;
      }

      // Build metadata
      const metadata = {
        ...activity.metadata,
        // Ensure bidId is always included if available
        ...(activity.bidId && { 
          bidId: activity.bidId._id?.toString(),
          serviceType: activity.bidId.requestCategory,
          amount: activity.bidId.amount,
          bidStatus: activity.bidId.status
        })
      };

      // Add customer/shop info to metadata if available
      if (activity.customerId) {
        metadata.customerName = activity.customerId.name;
        metadata.email = activity.customerId.email;
      }
      
      if (activity.shopId) {
        metadata.shopName = activity.shopId.businessName;
        metadata.email = activity.shopId.email;
      }

      return {
        // Core fields matching frontend interface
        id: activity._id.toString(),
        type: activity.type,
        title: activity.title || activity.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        message: activity.message,
        
        // User information
        customerId: activity.customerId?._id?.toString(),
        shopId: activity.shopId?._id?.toString(),
        
        // Related IDs
        bidId: activity.bidId?._id?.toString(),
        offerId: activity.metadata?.offerId || null,
        
        // Timestamps - ensure proper ISO string format
        createdAt: activity.createdAt ? activity.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: activity.updatedAt ? activity.updatedAt.toISOString() : new Date().toISOString(),
        expiresAt: activity.expiresAt ? activity.expiresAt.toISOString() : null,
        
        // Metadata with all additional info
        metadata: metadata
      };
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalEvents / limit);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total: totalEvents,
      totalPages,
      hasMore: page < totalPages,
      activities: formattedActivities, // Must match frontend expectation
    });
  } catch (error) {
    console.error("Error fetching admin activities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch activities",
      error: error.message,
    });
  }
};






/**
 * GET /api/admin/activity-types
 * Returns list of all available activity types for filtering
 */
export const getActivityTypes = async (req, res) => {
  try {
    const activityTypes = await Event.distinct("type");

    // Map types to readable labels
    const typeMap = {
      'bid-created': 'Bid Created',
      'bid-accepted': 'Bid Accepted',
      'bid-rejected': 'Bid Rejected',
      'bid-canceled': 'Bid Canceled',
      'bid-completed': 'Bid Completed',
      'bid-expired': 'Bid Expired',
      'bid-reposted': 'Bid Reposted',
      'offer-received': 'Offer Received',
      'offer-accepted': 'Offer Accepted',
      'offer-rejected': 'Offer Rejected',
      'offer-submitted': 'Offer Submitted',
      'payment-received': 'Payment Received',
      'shop-registered': 'Shop Registered',
      'user-registered': 'User Registered',
      'verification-update': 'Verification Update',
      'customer-message': 'Customer Message',
      'shop-message': 'Shop Message',
      'rating-received': 'Rating Received',
      'reminder': 'Reminder',
      'deadline-approaching': 'Deadline Approaching',
      'status-updated': 'Status Updated',
    };

    const formattedTypes = activityTypes.map(type => ({
      value: type,
      label: typeMap[type] || type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    }));

    // Add "All" option at the beginning
    formattedTypes.unshift({ value: 'all', label: 'All Activities' });

    return res.status(200).json({
      success: true,
      data: formattedTypes,
    });
  } catch (error) {
    console.error("Error fetching activity types:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity types",
      error: error.message,
    });
  }
};









// Fetch all unverified shops
export const getUnverifiedShops = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = "pending" } = req.query;

    const query = {
      isVerified: false,
      status,

      // EXCLUDE dummy placeholder values
      businessName: { $nin: ["Business Name (Pending)"] },
      legalEntityName: { $nin: ["Legal Entity (Pending)"] },
      ownerName: { $nin: ["Owner Name (Pending)"] },
      address: { $nin: ["Business Address (Pending)"] },
      country: { $nin: ["US (Pending)"] },
      phone: { $nin: ["000000000"] },
      zipCode: { $nin: ["00000"] },

      // File-based fields
      insuranceCarrier: { $nin: ["Insurance Carrier (Pending)"] },
      policyNumber: { $nin: ["Policy Number (Pending)"] },
      insuranceCertificate: { $nin: ["Pending"] },
      storeFrontPhoto: { $nin: ["Pending"] },
      workSpacePhoto: { $nin: ["Pending"] },
    };

    const shops = await Shop.find(query)
      .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry -paymentInfo.paymentToken")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Shop.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Unverified shops fetched successfully",
      data: shops,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalShops: count,
    });
  } catch (error) {
    console.error("Error fetching unverified shops:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unverified shops",
      error: error.message,
    });
  }
};





// Generate random password
const generateRandomPassword = () => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
};




// Admin creates a shop directly
export const createShopByAdmin = async (req, res) => {
  try {
    const {
      businessName,
      legalEntityName,
      ownerName,
      email,
      countryCode,
      phone,
      website,
      address,
      country,
      zipCode,
      latitude,
      longitude,
      services,
      vinylFilms,
      certificates,
      certificateFiles, // Array of file URLs
      startDate,
      insuranceCarrier,
      policyNumber,
      policyExpiration,
      instagramLink,
      facebookLink,
      linkedinLink,
      additionalInfo,
    } = req.body;

    // Get uploaded file URLs from multer
    const insuranceCertificate = req.files?.insuranceCertificate?.[0]?.path;
    const storeFrontPhoto = req.files?.storeFrontPhoto?.[0]?.path;
    const workSpacePhoto = req.files?.workSpacePhoto?.[0]?.path;
    const profilePic = req.files?.profilePic?.[0]?.path;
    const uploadedCertificateFiles = req.files?.certificateFiles?.map(file => file.path) || [];

    // Validation
    if (!businessName || !legalEntityName || !ownerName || !email || !phone || !address || !country) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required fields'
      });
    }

    // Check if shop with this email already exists
    const existingShop = await Shop.findOne({ email });
    if (existingShop) {
      return res.status(400).json({
        success: false,
        message: 'A shop with this email already exists'
      });
    }

    // 🔍 Find the Founder Plan from the Plan collection
    const founderPlan = await Plan.findOne({ 
      name: { $regex: /^founder/i } // Case-insensitive search for "Founder" plan
    });

    if (!founderPlan) {
      return res.status(500).json({
        success: false,
        message: 'Founder Plan not found. Please create the Founder Plan in the system first.'
      });
    }


    // Generate random password
    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    // Set perpetual trial dates (year 2099 = unlimited access)
    const perpetualTrialStartDate = new Date();
    const perpetualTrialEndDate = new Date('2099-12-31T23:59:59.999Z');

    // Prepare shop data
    const shopData = {
      businessName,
      legalEntityName,
      ownerName,
      email,
      password: hashedPassword,
      countryCode: countryCode || '+1',
      phone,
      website: website || '',
      address,
      country,
      zipCode: zipCode || '',
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      location: {
        type: 'Point',
        coordinates: [longitude ? parseFloat(longitude) : 0, latitude ? parseFloat(latitude) : 0]
      },
      services: Array.isArray(services) ? services : (services ? services.split(',') : []),
      vinylFilms: vinylFilms || '',
      certificates: certificates || '',
      certificateFiles: [...uploadedCertificateFiles, ...(certificateFiles || [])],
      startDate: startDate ? new Date(startDate) : new Date(),
      insuranceCarrier,
      policyNumber,
      policyExpiration: policyExpiration ? new Date(policyExpiration) : null,
      insuranceCertificate: insuranceCertificate || '',
      socialMedia: {
        instagram: instagramLink || '',
        facebook: facebookLink || '',
        linkedin: linkedinLink || ''
      },
      additionalInfo: additionalInfo || '',
      storeFrontPhoto: storeFrontPhoto || '',
      workSpacePhoto: workSpacePhoto || '',
      profilePic: profilePic || '',

      // 🎯 Link to Founder Plan (ObjectId reference)
      plan: founderPlan._id,

      // 🔥 NO Stripe IDs for admin shops (they don't use Stripe)
      stripeCustomerId: null,
      stripeSubscriptionId: null,

      // Subscription status - perpetual trial for admin shops
      subscriptionStatus: 'trialing', // Always in trial (never converts to paid)

      // Current subscription details with perpetual trial
      currentSubscription: {
        // Link to the Founder Plan
        plan: founderPlan._id,

        // NO Stripe IDs (admin shops don't use Stripe)
        stripeProductId: null,
        stripePriceId: null,

        // Period information - perpetual trial (year 2099)
        currentPeriodStart: perpetualTrialStartDate,
        currentPeriodEnd: perpetualTrialEndDate,
        trialStart: perpetualTrialStartDate,
        trialEnd: perpetualTrialEndDate,

        // Never cancels
        cancelAtPeriodEnd: false,

        // Trial extension tracking
        trialExtended: true,
        trialExtensions: [{
          extendedBy: req.admin?._id || null, // Admin who created the shop
          previousEndDate: new Date(new Date().setDate(new Date().getDate() + 30)), // Original 30-day trial
          newEndDate: perpetualTrialEndDate,
          extendedDays: 36470, // ~100 years
          extendedAt: new Date(),
          reason: 'Admin-created Founder Plan shop with lifetime access'
        }]
      },

      // For admin-created shops, set them as automatically verified
      isEmailVerified: true,
      isVerified: true,
      verifiedAt: new Date(),
      status: 'active',

      // Since admin is creating, they accept policies on behalf
      acceptedPolicy: true,
      policyAcceptedAt: new Date(),

      // 🏆 Mark as admin shop (Founder)
      isAdminShop: true,

      // Billing information (optional for Founder shops)
      billingDetails: {
        billingEmail: email,
        companyName: businessName,
        address: {
          street: address,
          city: '',
          state: '',
          postalCode: zipCode || '',
          country: country
        }
      }
    };

    // Create the shop
    const shop = await Shop.create(shopData);


    // Send welcome email with login credentials
    const emailSubject = `🎉 Welcome to Our Platform - Your Founder Shop Account is Ready!`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5; margin-bottom: 10px;">🏆 Welcome, ${ownerName}!</h1>
          <p style="color: #666; font-size: 16px;">Your shop <strong>${businessName}</strong> has been created with <strong>Founder Plan</strong> access.</p>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <h2 style="color: #374151; margin-top: 0;">Your Login Credentials</h2>
          <p><strong>📧 Email:</strong> ${email}</p>
          <p><strong>🔐 Temporary Password:</strong> ${randomPassword}</p>
          <p style="color: #EF4444; font-weight: bold; background-color: #FEF2F2; padding: 10px; border-radius: 5px;">
            ⚠️ Important: Please change your password after your first login.
          </p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 25px; border: 2px solid #f59e0b;">
          <h2 style="color: #374151; margin-top: 0;">🏆 Your Founder Plan Benefits</h2>
          <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="background-color: #f59e0b; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin-right: 10px;">
              👑 FOUNDER PLAN
            </div>
            <div style="font-size: 24px; font-weight: bold; color: #059669;">
              LIFETIME ACCESS
            </div>
          </div>
          <p><strong>✅ Status:</strong> Active (Lifetime Founder Access)</p>
          <p><strong>⏰ Access Period:</strong> <span style="color: #059669; font-weight: bold;">UNLIMITED</span></p>
          <p><strong>💰 Monthly Cost:</strong> <span style="color: #059669; font-weight: bold;">$0 - Complimentary Forever</span></p>
          <p><strong>📅 Expiration:</strong> <span style="color: #059669; font-weight: bold;">Never</span></p>
          
          <h3 style="color: #374151; margin-top: 20px;">🌟 Exclusive Founder Features:</h3>
          <ul style="padding-left: 20px;">
            <li><strong>Unlimited Bids:</strong> ${founderPlan.features.unlimitedBids ? 'Yes ✅' : `${founderPlan.features.bidsPerMonth} per month`}</li>
            <li><strong>Sub-Accounts:</strong> ${founderPlan.features.subAccounts} team members</li>
            <li><strong>Premium Shop Listing:</strong> Featured placement in search results</li>
            <li><strong>Priority Support:</strong> Direct access to our team</li>
            <li><strong>Advanced Analytics:</strong> Complete business insights</li>
            <li><strong>Lifetime Updates:</strong> All future features included</li>
            <li><strong>Zero Fees:</strong> No hidden charges, ever</li>
          </ul>
          
          <p style="background-color: #fff; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #f59e0b;">
            <strong>🎁 Special Note:</strong> As a Founder member, you have lifetime access to all platform features. 
            This account will never expire and will never be charged.
          </p>
        </div>
        
        <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <h2 style="color: #374151; margin-top: 0;">📋 Next Steps</h2>
          <ol style="padding-left: 20px;">
            <li>Log in to your dashboard using the credentials above</li>
            <li>Change your password for security</li>
            <li>Complete your shop profile (add logo, description, etc.)</li>
            <li>Set up your service offerings</li>
            <li>Start receiving and bidding on projects!</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #666; margin-bottom: 10px;">
            <a href="${process.env.FRONTEND_URL}/partner/login" style="display: inline-block; background-color: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              👉 Log in to Your Dashboard
            </a>
          </p>
          <p style="color: #999; font-size: 14px;">
            Need help? Contact our support team at support@bidawrap.com
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>© ${new Date().getFullYear()} Your Platform Name. All rights reserved.</p>
        </div>
      </div>
    `;

    // Send email (wrap in try-catch to not fail the whole process if email fails)
    try {
      await sendEmail(email, emailSubject, emailBody);
    } catch (emailError) {
      console.error('❌ Failed to send welcome email:', emailError);
      // Don't fail the whole request if email fails
    }

    // Populate the plan before sending response
    await shop.populate('plan', 'name price currency interval features descriptionPoints tags');

    // Return success response (without password)
    const shopResponse = shop.toObject();
    delete shopResponse.password;

    res.status(201).json({
      success: true,
      message: 'Founder shop created successfully by admin',
      data: {
        shop: shopResponse,
        temporaryPassword: randomPassword, // Only returned in this response for admin reference
        credentialsSent: true,
        subscriptionDetails: {
          plan: founderPlan.name,
          planId: founderPlan._id,
          status: 'trialing',
          trialEndDate: perpetualTrialEndDate,
          amount: '$0/month (Founder - Lifetime Access)',
          nextBillingDate: 'Never',
          features: founderPlan.features,
          access: 'Unlimited Lifetime'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating shop by admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create shop',
      error: error.message
    });
  }
};










// Accept/Verify a shop
export const acceptShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { planId, trialDays = 30 } = req.body; // Get plan and trial days from request

    const shop = await Shop.findById(shopId);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    if (shop.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Shop is already verified",
      });
    }

    // Check if plan exists if provided
    let selectedPlan = null;
    if (planId) {
      selectedPlan = await Plan.findById(planId);
      if (!selectedPlan) {
        return res.status(404).json({
          success: false,
          message: "Selected plan not found",
        });
      }
    }

    // Update shop status
    shop.isVerified = true;
    shop.verifiedAt = new Date();
    shop.status = "active";

    // If plan is provided, assign it and start trial
    if (selectedPlan) {
      shop.plan = selectedPlan._id;
      shop.subscriptionStatus = "trialing";
      
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + trialDays);

      shop.currentSubscription = {
        plan: selectedPlan._id,
        trialStart: now,
        trialEnd: trialEnd,
        stripeProductId: selectedPlan.stripeProductId,
        stripePriceId: selectedPlan.stripePriceId,
      };
    }

    await shop.save();

    // Send approval email
    await sendEmail(
      shop.email,
      "Your Shop Registration Has Been Approved!",
      `
      <h2>🎉 Congratulations, ${shop.businessName}!</h2>
      <p>Your shop registration request has been successfully reviewed and <strong>approved</strong>.</p>
      
      ${selectedPlan ? `
      <p><strong>Plan Assigned:</strong> ${selectedPlan.name}</p>
      <p><strong>Trial Period:</strong> ${trialDays} days (until ${new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString()})</p>
      <p>During your trial period, you have access to all features of the ${selectedPlan.name} plan.</p>
      ` : `
      <p>No subscription plan has been assigned to your shop yet. Please contact support for plan assignment.</p>
      `}
      
      <p>You can now access all features available to your account.</p>
      <p>If you have any questions, feel free to reply to this email.</p>
      
      <br/>
      <p>Best regards,<br/>Support Team</p>
      `
    );

    res.status(200).json({
      success: true,
      message: "Shop verified and approved successfully",
      data: {
        shopId: shop._id,
        businessName: shop.businessName,
        isVerified: shop.isVerified,
        plan: shop.plan,
        planName: selectedPlan?.name || null,
        subscriptionStatus: shop.subscriptionStatus,
        status: shop.status,
        verifiedAt: shop.verifiedAt,
        trialDays: selectedPlan ? trialDays : null,
      },
    });
  } catch (error) {
    console.error("Error accepting shop:", error);
    res.status(500).json({
      success: false,
      message: "Failed to accept shop",
      error: error.message,
    });
  }
};



export const rejectShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { reason } = req.body;

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    if (shop.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Cannot reject an already verified shop",
      });
    }

    const {
      email,
      businessName,
      stripeSubscriptionId,
      stripeCustomerId,
    } = shop;

    // ================= STRIPE CLEANUP =================
    // Only cleanup if subscription exists in Stripe
    if (stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(stripeSubscriptionId);
      } catch (err) {
        console.warn(
          "⚠️ Subscription already cancelled or not found:",
          err.message
        );
      }
    }

    // ⚠️ Delete customer only if they have no other subscriptions
    if (stripeCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        if (customer && !customer.deleted) {
          // Check if customer has any active subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'active',
            limit: 1
          });
          
          // Only delete customer if they have no active subscriptions
          if (subscriptions.data.length === 0) {
            await stripe.customers.del(stripeCustomerId);
          }
        }
      } catch (err) {
        console.warn(
          "⚠️ Stripe customer already deleted or missing:",
          err.message
        );
      }
    }

    // ================= UPDATE SHOP STATUS (SOFT DELETE APPROACH) =================
    // Instead of deleting, mark as rejected/blocked
    shop.status = "blocked";
    shop.isBlocked = true;
    shop.blockedAt = new Date();
    shop.blockedReason = reason || "Registration rejected";
    shop.isVerified = false;
    
    // Clear subscription data
    shop.plan = null;
    shop.stripeSubscriptionId = null;
    shop.subscriptionStatus = "inactive";
    shop.currentSubscription = null;
    
    await shop.save();

    // ================= SEND EMAIL =================
    await sendEmail(
      email,
      "Your Shop Registration Was Rejected",
      `
        <h2>Hello ${businessName},</h2>

        <p>Thank you for registering your shop with us.</p>

        <p>Your registration has been <strong>rejected</strong>.</p>

        ${reason
        ? `<p><strong>Reason:</strong> ${reason}</p>`
        : `<p><strong>Reason:</strong> Information did not meet requirements.</p>`
      }

        <p>You may correct the issues and register again using the same email.</p>

        <p>If you believe this was a mistake, please contact our support team.</p>

        <p>Best regards,<br/>Support Team</p>
      `
    );

    return res.status(200).json({
      success: true,
      message: "Shop rejected successfully",
      data: {
        shopId: shop._id,
        businessName: shop.businessName,
        status: shop.status,
        blockedReason: shop.blockedReason,
        blockedAt: shop.blockedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error rejecting shop:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject shop",
      error: error.message,
    });
  }
};







// Get all shops with pagination and filtering (OPTIMIZED)
export const getShops = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      plan,
      subscriptionStatus,
      isVerified = "true",
      isBlocked = "false",
      country,
      fromDate,
      toDate,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // =========================
    // BUILD QUERY
    // =========================
    const query = {
      isVerified: isVerified === "true",
      isBlocked: isBlocked === "true",
    };

    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: "i" } },
        { ownerName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (status) query.status = status;
    if (plan) query.plan = plan;
    if (subscriptionStatus) query.subscriptionStatus = subscriptionStatus;
    if (country) query.country = country;

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    // =========================
    // SORT
    // =========================
    const sort = {
      [sortBy]: sortOrder === "desc" ? -1 : 1,
    };

    // =========================
    // FETCH DATA
    // =========================
    const [total, shops] = await Promise.all([
      Shop.countDocuments(query),

      Shop.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select({
          businessName: 1,
          ownerName: 1,
          email: 1,
          phone: 1,
          country: 1,

          plan: 1,
          subscriptionStatus: 1,
          currentSubscription: 1,

          status: 1,
          isVerified: 1,
          isBlocked: 1,

          rating: 1,
          reviewCount: 1,
          createdAt: 1,
        })
        .lean(),
    ]);

    // =========================
    // TRANSFORM RESPONSE
    // =========================
    const now = new Date();

    const transformedShops = shops.map((shop) => {
      const trialEnd = shop.currentSubscription?.trialEnd || null;

      const isInTrial =
        shop.subscriptionStatus === "trialing" &&
        trialEnd &&
        now < new Date(trialEnd);

      const trialDaysRemaining = isInTrial
        ? Math.ceil((new Date(trialEnd) - now) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        id: shop._id.toString(),
        name: shop.businessName || "Unnamed Shop",
        owner: shop.ownerName || "Unknown Owner",
        email: shop.email,
        phone: shop.phone,
        country: shop.country,

        plan: shop.plan || "basic",
        subscriptionStatus: shop.subscriptionStatus,
        hasActiveSubscription: ["active", "trialing"].includes(
          shop.subscriptionStatus
        ),
        isInTrial,
        trialDaysRemaining,

        status: shop.status,
        isVerified: shop.isVerified,
        isBlocked: shop.isBlocked,

        rating: shop.rating || 0,
        reviewCount: shop.reviewCount || 0,
        createdAt: shop.createdAt,
      };
    });

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      shops: transformedShops,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasMore: pageNum < totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching shops:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch shops",
    });
  }
};







// Get customer statistics (verified/unverified counts)
export const getCustomerStats = async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const verifiedCustomers = await Customer.countDocuments({ isEmailVerified: true });
    const unverifiedCustomers = await Customer.countDocuments({ isEmailVerified: false });

    res.status(200).json({
      success: true,
      data: {
        total: totalCustomers,
        verified: verifiedCustomers,
        unverified: unverifiedCustomers,
      },
    });
  } catch (error) {
    console.error("Error fetching customer stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer statistics",
      error: error.message,
    });
  }
};



// Get all customers with pagination and bid statistics
export const getAllCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 12, verified, search, status } = req.query;

    // Build query
    const query = {};
    
    // Verification filter
    if (verified === "true") {
      query.isEmailVerified = true;
    } else if (verified === "false") {
      query.isEmailVerified = false;
    }
    
    // Status filter (for blocked/unblocked)
    if (status === 'blocked') {
      query.isBlocked = true;
    } else if (status === 'unblocked') {
      query.isBlocked = false;
    }
    
    // Search filter (by name or email)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch customers with pagination
    const customers = await Customer.find(query)
      .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get bid statistics for each customer
    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        // Count total bids
        const totalBids = await Bid.countDocuments({ user_id: customer._id });

        // Count completed bids
        const completedBids = await Bid.countDocuments({
          user_id: customer._id,
          status: "completed",
        });

        // Count active bids
        const activeBids = await Bid.countDocuments({
          user_id: customer._id,
          status: "active",
        });

        return {
          ...customer,
          totalBids,
          completedBids,
          activeBids,
          successRate: totalBids > 0 ? Math.round((completedBids / totalBids) * 100) : 0,
          status: customer.isEmailVerified ? "active" : "pending",
          // Ensure isBlocked is included (default to false if not present)
          isBlocked: customer.isBlocked || false,
          // Include blockedAt and blockedReason if available
          blockedAt: customer.blockedAt || null,
          blockedReason: customer.blockedReason || ""
        };
      })
    );

    const count = await Customer.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Customers fetched successfully",
      data: customersWithStats,
      pagination: {
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        totalCustomers: count,
        limit: parseInt(limit),
        hasMore: page * limit < count,
      },
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
};






// Get single customer details for admin view
export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    // Find customer and exclude sensitive fields
    const customer = await Customer.findById(id)
      .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry")
      .lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Bid statistics
    const totalBids = await Bid.countDocuments({ user_id: id });

    const completedBids = await Bid.countDocuments({
      user_id: id,
      status: "completed",
    });

    const activeBids = await Bid.countDocuments({
      user_id: id,
      status: { $in: ["active", "in_progress"] },
    });

    const inProgressBids = await Bid.countDocuments({
      user_id: id,
      status: "in_progress",
    });

    const successRate =
      totalBids > 0 ? Math.round((completedBids / totalBids) * 100) : 0;

    // Combine response with blocked fields
    const customerData = {
      ...customer,
      totalBids,
      completedBids,
      activeBids,
      inProgressBids,
      successRate,
      status: customer.isEmailVerified ? "active" : "pending",
      // Ensure blocked fields are included
      isBlocked: customer.isBlocked || false,
      blockedAt: customer.blockedAt || null,
      blockedReason: customer.blockedReason || "",
      // Add account status based on block status
      accountStatus: customer.isBlocked ? "blocked" : (customer.isAuthenticated ? "active" : "inactive"),
    };

    return res.status(200).json({
      success: true,
      data: customerData,
    });
  } catch (error) {
    console.error("❌ Error fetching customer details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer details",
    });
  }
};























// Helper function to safely populate plan (handles both string and ObjectId)
const safePopulatePlan = async (query) => {
  try {
    return await query.populate('plan', 'name').lean();
  } catch (error) {
    // If populate fails (because plan is a string), just return without populating
    return await query.lean();
  }
};

// Get shop statistics
export const getShopStats = async (req, res) => {
  try {
    // Get all verified shops - use select to avoid populate issues
    const allVerifiedShops = await Shop.find({ isVerified: true })
      .select('plan rating reviewCount')
      .lean();
    
    // Manually populate plans for shops that have ObjectId plans
    const planIds = allVerifiedShops
      .filter(shop => shop.plan && mongoose.Types.ObjectId.isValid(shop.plan))
      .map(shop => shop.plan);
    
    const plans = await Plan.find({ _id: { $in: planIds } }).select('_id name').lean();
    const planMap = new Map(plans.map(p => [p._id.toString(), p]));
    
    // Enhance shops with plan data
    const shopsWithPlans = allVerifiedShops.map(shop => {
      if (typeof shop.plan === 'string' && !mongoose.Types.ObjectId.isValid(shop.plan)) {
        // Old format - plan is already a string
        return { ...shop, planName: shop.plan };
      } else if (shop.plan && mongoose.Types.ObjectId.isValid(shop.plan)) {
        // New format - get plan from map
        const planData = planMap.get(shop.plan.toString());
        return { ...shop, planName: planData?.name || 'Unknown' };
      }
      return { ...shop, planName: 'Founder Plan' };
    });
    
    const totalShops = shopsWithPlans.length;
    
    // Count shops by plan name
    const basicShops = shopsWithPlans.filter(shop => 
      shop.planName?.toLowerCase() === 'basic'
    ).length;
    
    const professionalShops = shopsWithPlans.filter(shop => 
      shop.planName?.toLowerCase() === 'professional'
    ).length;
    
    const pendingShops = await Shop.countDocuments({ isVerified: false });

    // Count blocked and active shops
    const activeShops = await Shop.countDocuments({
      isVerified: true,
      isBlocked: false
    });
    
    const blockedShops = await Shop.countDocuments({
      isVerified: true,
      isBlocked: true
    });

    // Get total completed bids across all shops
    const totalCompletedBids = await Bid.countDocuments({
      status: "completed"
    });

    // Get average rating across all shops
    const avgRating = shopsWithPlans.length > 0
      ? shopsWithPlans.reduce((sum, shop) => sum + (shop.rating || 0), 0) / shopsWithPlans.length
      : 0;

    res.status(200).json({
      success: true,
      data: {
        total: totalShops,
        basic: basicShops,
        professional: professionalShops,
        pending: pendingShops,
        active: activeShops,
        blocked: blockedShops,
        totalCompletedBids,
        averageRating: Math.round(avgRating * 10) / 10,
      },
    });
  } catch (error) {
    console.error("Error fetching shop stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shop statistics",
      error: error.message,
    });
  }
};

// Get all verified shops with pagination and bid statistics
export const getAllShops = async (req, res) => {
  try {
    const { page = 1, limit = 12, plan, verified = "true", status } = req.query;

    // Build query
    const query = {};

    // Filter by verification status
    if (verified === "true") {
      query.isVerified = true;
    } else if (verified === "false") {
      query.isVerified = false;
    }

    // Filter by block status
    if (status) {
      if (status === "active") {
        query.isBlocked = false;
      } else if (status === "blocked") {
        query.isBlocked = true;
      }
    }

    // Get total count before plan filtering
    const totalCount = await Shop.countDocuments(query);

    // Fetch shops with pagination (NO POPULATE YET)
    const shops = await Shop.find(query)
      .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry -paymentInfo.paymentToken")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Manually populate plans for shops that have ObjectId plans
    const planIds = shops
      .filter(shop => shop.plan && mongoose.Types.ObjectId.isValid(shop.plan))
      .map(shop => shop.plan);
    
    const plans = await Plan.find({ _id: { $in: planIds } }).select('_id name').lean();
    const planMap = new Map(plans.map(p => [p._id.toString(), p]));

    // Enhance shops with plan data
    const shopsWithPlans = shops.map(shop => {
      let planName = 'Founder Plan';
      
      if (typeof shop.plan === 'string' && !mongoose.Types.ObjectId.isValid(shop.plan)) {
        // Old format - plan is already a string
        planName = shop.plan;
      } else if (shop.plan && mongoose.Types.ObjectId.isValid(shop.plan)) {
        // New format - get plan from map
        const planData = planMap.get(shop.plan.toString());
        planName = planData?.name || 'Unknown';
      }
      
      return {
        ...shop,
        planName: planName
      };
    });

    // Filter by plan name if specified
    let filteredShops = shopsWithPlans;
    if (plan && (plan.toLowerCase() === "basic" || plan.toLowerCase() === "professional")) {
      filteredShops = shopsWithPlans.filter(shop => 
        shop.planName?.toLowerCase() === plan.toLowerCase()
      );
    }

    // Get bid statistics and reviews for each shop
    const shopsWithStats = await Promise.all(
      filteredShops.map(async (shop) => {
        // Count total bids received
        const totalBids = await Bid.countDocuments({
          currentShopId: shop._id
        });

        // Count completed bids
        const completedBids = await Bid.countDocuments({
          currentShopId: shop._id,
          status: "completed",
        });

        // Count active bids
        const activeBids = await Bid.countDocuments({
          currentShopId: shop._id,
          status: "active",
        });

        // Count in-progress bids
        const inProgressBids = await Bid.countDocuments({
          currentShopId: shop._id,
          status: "in_progress",
        });

        // Get review count and rating (already in shop model)
        const reviewCount = shop.reviewCount || 0;
        const rating = shop.rating || 0;

        return {
          ...shop,
          plan: shop.planName, // Return plan as string for backward compatibility
          status: shop.isBlocked ? "blocked" : "active",
          isBlocked: shop.isBlocked || false,
          statistics: {
            totalBids,
            completedBids,
            activeBids,
            inProgressBids,
            reviewCount,
            rating,
            successRate: totalBids > 0 ? Math.round((completedBids / totalBids) * 100) : 0,
          },
        };
      })
    );

    // Use filtered count if plan filter was applied
    const count = plan && (plan.toLowerCase() === "basic" || plan.toLowerCase() === "professional")
      ? filteredShops.length
      : totalCount;

    res.status(200).json({
      success: true,
      message: "Shops fetched successfully",
      data: shopsWithStats,
      pagination: {
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        totalShops: count,
        limit: parseInt(limit),
        hasMore: page * limit < count,
      },
    });
  } catch (error) {
    console.error("Error fetching shops:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shops",
      error: error.message,
    });
  }
};

// Get all shops for map view with location data
export const getShopsForMap = async (req, res) => {
  try {
    const { verified = "true" } = req.query;

    const query = {};

    if (verified === "true") {
      query.isVerified = true;
      query.status = "active";
    }

    // Fetch only necessary fields for map markers (NO POPULATE)
    const shops = await Shop.find(query)
      .select("businessName profilePic address country latitude longitude location rating reviewCount plan isAdminShop")
      .lean();

    // Manually populate plans for shops that have ObjectId plans
    const planIds = shops
      .filter(shop => shop.plan && mongoose.Types.ObjectId.isValid(shop.plan))
      .map(shop => shop.plan);
    
    const plans = await Plan.find({ _id: { $in: planIds } }).select('_id name').lean();
    const planMap = new Map(plans.map(p => [p._id.toString(), p]));

    // Filter shops that have valid coordinates
    const shopsWithLocation = shops.filter(
      shop =>
        (shop.latitude && shop.longitude) ||
        (shop.location?.coordinates &&
          shop.location.coordinates[0] !== 0 &&
          shop.location.coordinates[1] !== 0)
    );

    // Format data for map
    const mapData = shopsWithLocation.map(shop => {
      // Determine plan name as string
      let planName = "Founder Plan";
      
      if (typeof shop.plan === 'string' && !mongoose.Types.ObjectId.isValid(shop.plan)) {
        // Old format - plan is already a string
        planName = shop.plan;
      } else if (shop.plan && mongoose.Types.ObjectId.isValid(shop.plan)) {
        // New format - get plan from map
        const planData = planMap.get(shop.plan.toString());
        planName = planData?.name || 'Unknown';
      }

      return {
        id: shop._id,
        name: shop.businessName,
        profilePic: shop.profilePic,
        address: shop.address,
        country: shop.country,
        rating: shop.rating || 0,
        reviewCount: shop.reviewCount || 0,
        plan: planName, // Return plan as string
        coordinates: {
          lat: shop.latitude || shop.location.coordinates[1],
          lng: shop.longitude || shop.location.coordinates[0],
        },
      };
    });

    res.status(200).json({
      success: true,
      message: "Shop locations fetched successfully",
      data: mapData,
      total: mapData.length,
    });
  } catch (error) {
    console.error("Error fetching shop locations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shop locations",
      error: error.message,
    });
  }
};

// Get single shop details by ID
export const getShopById = async (req, res) => {
  try {
    const { shopId } = req.params;

    // Validate shop ID
    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shop ID",
      });
    }

    // Find shop by ID (NO POPULATE YET)
    const shop = await Shop.findById(shopId)
      .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry")
      .lean();

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Manually populate plan if it's an ObjectId
    let planData = null;
    let planName = "Founder Plan";
    
    if (typeof shop.plan === 'string' && !mongoose.Types.ObjectId.isValid(shop.plan)) {
      // Old format - plan is already a string
      planName = shop.plan;
    } else if (shop.plan && mongoose.Types.ObjectId.isValid(shop.plan)) {
      // New format - fetch plan
      planData = await Plan.findById(shop.plan).lean();
      planName = planData?.name || 'Unknown';
    }

    // Calculate statistics for this shop based on currentShopId
    const statistics = await Bid.aggregate([
      { $match: { currentShopId: new mongoose.Types.ObjectId(shopId) } },
      {
        $group: {
          _id: null,
          totalBids: { $sum: 1 },
          inProgressBids: {
            $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] },
          },
          completedBids: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          activeBids: {
            $sum: {
              $cond: [{
                $and: [
                  { $eq: ["$status", "active"] },
                  { $ne: ["$currentShopId", null] }
                ]
              }, 1, 0]
            },
          },
        },
      },
    ]);

    // Extract statistics
    const statsResult = statistics[0] || {
      totalBids: 0,
      inProgressBids: 0,
      completedBids: 0,
      activeBids: 0
    };

    // Calculate success rate
    const successRate = statsResult.totalBids > 0
      ? (statsResult.completedBids / statsResult.totalBids) * 100
      : 0;

    // Extract subscription information from currentSubscription
    const currentSub = shop.currentSubscription || {};

    // Determine if shop is in trial based on currentSubscription
    const now = new Date();
    const trialEnd = currentSub.trialEnd ? new Date(currentSub.trialEnd) : null;
    const isInTrial = currentSub.trialEnd &&
      !isNaN(trialEnd.getTime()) &&
      trialEnd > now;

    // Calculate trial days remaining
    let trialDaysRemaining = 0;
    if (isInTrial && trialEnd) {
      const diffTime = trialEnd.getTime() - now.getTime();
      trialDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Determine subscription status from currentSubscription
    let subscriptionStatus = shop.subscriptionStatus || "inactive";
    if (isInTrial) {
      subscriptionStatus = "trialing";
    } else if (currentSub.currentPeriodEnd) {
      const periodEnd = new Date(currentSub.currentPeriodEnd);
      if (!isNaN(periodEnd.getTime()) && periodEnd > now) {
        subscriptionStatus = "active";
      } else if (currentSub.cancelAtPeriodEnd) {
        subscriptionStatus = "cancelled";
      }
    }

    // Get plan details if available (only for new ObjectId format)
    let planDetails = null;
    if (planData) {
      planDetails = {
        name: planData.name,
        price: planData.price,
        currency: planData.currency,
        interval: planData.interval,
        features: planData.features,
        descriptionPoints: planData.descriptionPoints,
        tags: planData.tags
      };
    }

    // Transform data to match frontend expectations
    const shopData = {
      // Basic Information
      ...shop,
      plan: planName, // Return plan as string for backward compatibility

      // CRITICAL: Ensure subscriptionStatus is correct for frontend
      subscriptionStatus: subscriptionStatus,

      // CRITICAL: Ensure currentSubscription exists and has all needed fields
      currentSubscription: {
        ...currentSub,
        trialEnd: currentSub.trialEnd || null,
        trialStart: currentSub.trialStart || null,
        planName: planName, // Use the determined plan name
        currentPeriodStart: currentSub.currentPeriodStart || null,
        currentPeriodEnd: currentSub.currentPeriodEnd || null,
        cancelAtPeriodEnd: currentSub.cancelAtPeriodEnd || false,
        stripeProductId: currentSub.stripeProductId || null,
        stripePriceId: currentSub.stripePriceId || null,
      },

      // Plan details (separate object for detailed plan info if needed)
      planDetails: planDetails,

      // Plan Information
      planStartDate: currentSub.currentPeriodStart || shop.createdAt,
      trialEndDate: currentSub.trialEnd || null,
      status: shop.status,

      // Statistics
      statistics: {
        totalBids: statsResult.totalBids,
        completedBids: statsResult.completedBids,
        activeBids: statsResult.activeBids,
        inProgressBids: statsResult.inProgressBids,
        successRate: Math.round(successRate),
        rating: shop.rating || 0,
        reviewCount: shop.reviewCount || 0,
      },

      // Additional fields
      isBlocked: shop.isBlocked || false,
      blockedAt: shop.blockedAt,
      blockedReason: shop.blockedReason,

      // Virtual properties (calculated above)
      isInTrial: isInTrial,
      trialDaysRemaining: trialDaysRemaining,
      hasActiveSubscription: isInTrial || subscriptionStatus === "active"
    };

    // Remove any nested subscription object if it exists to avoid confusion
    if (shopData.subscription) {
      delete shopData.subscription;
    }

    return res.status(200).json({
      success: true,
      message: "Shop details retrieved successfully",
      data: shopData,
    });
  } catch (error) {
    console.error("Error fetching shop details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch shop details",
      error: error.message,
    });
  }
};



// Suspend or activate a shop
export const updateShopStatus = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { status } = req.body; // "active" or "suspended"

    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'active' or 'suspended'",
      });
    }

    const shop = await Shop.findById(shopId);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    shop.status = status;
    await shop.save();

    res.status(200).json({
      success: true,
      message: `Shop ${status === "active" ? "activated" : "suspended"} successfully`,
      data: {
        shopId: shop._id,
        businessName: shop.businessName,
        status: shop.status,
      },
    });
  } catch (error) {
    console.error("Error updating shop status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update shop status",
      error: error.message,
    });
  }
};



















// ============================================
// ADMIN: Get All Pending Verification Requests
// ============================================
export const getPendingVerificationRequests = async (req, res) => {
  try {
    const requests = await VerificationRequest.find({ status: "pending" })
      .populate("shopId", "businessName email ownerName phone")
      .sort({ createdAt: -1 })
      .select("-__v");

    res.json({
      status: "success",
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("Get pending requests error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch pending requests",
    });
  }
};

// ============================================
// ADMIN: Get All Verification Requests (with filters)
// ============================================
export const getAllVerificationRequests = async (req, res) => {
  try {
    const { status, shopId } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (shopId) filter.shopId = shopId;

    const requests = await VerificationRequest.find(filter)
      .populate("shopId", "businessName email ownerName phone")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .select("-__v");

    res.json({
      status: "success",
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("Get all requests error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch verification requests",
    });
  }
};




// ============================================
// ADMIN: Approve Verification Request
// ============================================
export const approveVerificationRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId = req.admin._id;
    const { adminNotes } = req.body;

    const request = await VerificationRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        status: "error",
        message: "Verification request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        status: "error",
        message: `Request has already been ${request.status}`,
      });
    }

    // Add admin notes
    if (adminNotes) {
      request.adminNotes = adminNotes;
    }

    // Approve and update shop
    await request.approveAndUpdateShop(adminId);

    // Fetch updated shop info to get email + name
    const shop = await Shop.findById(request.shopId);

    // --------------------------------------
    // 📧 SEND APPROVAL EMAIL TO THE SHOP OWNER
    // --------------------------------------
    await sendEmail(
      shop.email,
      "Your Profile Verification Update Has Been Approved",
      `
        <h2>🎉 Hello ${shop.businessName},</h2>
        <p>Good news! Your shop's profile verification update request has been <strong>approved</strong> after review.</p>

        <p>The updated details are now visible on your shop profile.</p>

        ${adminNotes
        ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>`
        : ""
      }

        <p>If you have more updates to request, you may submit them anytime.</p>

        <br/>
        <p>Best regards,<br/>Support Team</p>
      `
    );

    return res.json({
      status: "success",
      message: "Verification request approved and shop information updated",
      data: {
        requestId: request._id,
        status: request.status,
        reviewedAt: request.reviewedAt,
      },
    });
  } catch (error) {
    console.error("Approve verification request error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to approve verification request",
      error: error.message,
    });
  }
};




// ============================================
// ADMIN: Reject Verification Request
// ============================================
export const rejectVerificationRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId = req.admin._id;
    const { rejectionReason, adminNotes } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        status: "error",
        message: "Rejection reason is required",
      });
    }

    const request = await VerificationRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        status: "error",
        message: "Verification request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        status: "error",
        message: `Request has already been ${request.status}`,
      });
    }

    // Add admin notes
    if (adminNotes) {
      request.adminNotes = adminNotes;
    }

    // Reject the request
    await request.rejectRequest(adminId, rejectionReason);

    // Fetch shop information
    const shop = await Shop.findById(request.shopId);

    // --------------------------------------
    // 📧 SEND REJECTION EMAIL TO SHOP OWNER
    // --------------------------------------
    await sendEmail(
      shop.email,
      "Your Profile Verification Update Was Not Approved",
      `
        <h2>Hello ${shop.businessName},</h2>
        <p>We have reviewed your shop profile verification update request.</p>

        <p>Unfortunately, we could not approve it at this time.</p>

        <p><strong>Reason:</strong> ${rejectionReason}</p>

        ${adminNotes
        ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>`
        : ""
      }

        <p>You may correct the information and submit a new request whenever you're ready.</p>

        <br/>
        <p>Best regards,<br/>Support Team</p>
      `
    );

    return res.json({
      status: "success",
      message: "Verification request rejected",
      data: {
        requestId: request._id,
        status: request.status,
        rejectionReason: request.rejectionReason,
        reviewedAt: request.reviewedAt,
      },
    });
  } catch (error) {
    console.error("Reject verification request error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to reject verification request",
      error: error.message,
    });
  }
};





// ============================================
// ADMIN: Get Single Verification Request Details
// ============================================
export const getVerificationRequestDetails = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await VerificationRequest.findById(requestId)
      .populate("shopId", "businessName email ownerName phone address")
      .populate("reviewedBy", "name email")
      .select("-__v");

    if (!request) {
      return res.status(404).json({
        status: "error",
        message: "Verification request not found",
      });
    }

    res.json({
      status: "success",
      data: request,
    });
  } catch (error) {
    console.error("Get request details error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch request details",
    });
  }
};















/**
 * Get all active bids with full details
 */
export const getActiveBids = async (req, res) => {
  try {
    const activeBids = await Bid.find({ status: "active" })
      .populate({
        path: "user_id",
        select: "name email phone",
      })
      .populate({
        path: "offers",
        populate: [
          {
            path: "shopId",
            select: "name email phone address",
          },
          {
            path: "counterOffers.createdBy",
            select: "name email",
          },
        ],
      })
      .populate({
        path: "currentShopId",
        select: "name email phone",
      })
      .sort({ createdAt: -1 })
      .lean();

    const enrichedBids = activeBids.map((bid) => ({
      ...bid,
      totalOffers: bid.offers?.length || 0,
      isExpired: checkIfExpired(bid),
    }));

    res.status(200).json({
      success: true,
      count: enrichedBids.length,
      data: enrichedBids,
    });
  } catch (error) {
    console.error("Error fetching active bids:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active bids",
      error: error.message,
    });
  }
};

/**
 * Get all in-progress bids with full details
 */
export const getInProgressBids = async (req, res) => {
  try {
    const inProgressBids = await Bid.find({ status: "in_progress" })
      .populate({
        path: "user_id",
        select: "name email phone",
      })
      .populate({
        path: "offers",
        populate: [
          {
            path: "shopId",
            select: "name email phone address",
          },
          {
            path: "counterOffers.createdBy",
            select: "name email",
          },
        ],
      })
      .populate({
        path: "acceptedOffer",
        populate: {
          path: "shopId",
          select: "name email phone address",
        },
      })
      .populate({
        path: "currentShopId",
        select: "name email phone address",
      })
      .sort({ createdAt: -1 })
      .lean();

    const enrichedBids = inProgressBids.map((bid) => ({
      ...bid,
      totalOffers: bid.offers?.length || 0,
      acceptedPrice: bid.acceptedOffer?.price || null,
    }));

    res.status(200).json({
      success: true,
      count: enrichedBids.length,
      data: enrichedBids,
    });
  } catch (error) {
    console.error("Error fetching in-progress bids:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch in-progress bids",
      error: error.message,
    });
  }
};




/**
 * Get all completed bids with full details
 */
export const getCompletedBids = async (req, res) => {
  try {
    const completedBids = await Bid.find({ status: "completed" })
      .populate({
        path: "user_id",
        select: "name email phone",
      })
      .populate({
        path: "offers",
        populate: [
          {
            path: "shopId",
            select: "name email phone address",
          },
          {
            path: "counterOffers.createdBy",
            select: "name email",
          },
        ],
      })
      .populate({
        path: "acceptedOffer",
        populate: {
          path: "shopId",
          select: "name email phone address",
        },
      })
      .populate({
        path: "currentShopId",
        select: "name email phone address",
      })
      .sort({ updatedAt: -1 })
      .lean();

    const enrichedBids = completedBids.map((bid) => ({
      ...bid,
      totalOffers: bid.offers?.length || 0,
      acceptedPrice: bid.acceptedOffer?.price || null,
      completionTime: calculateCompletionTime(bid),
    }));

    res.status(200).json({
      success: true,
      count: enrichedBids.length,
      data: enrichedBids,
    });
  } catch (error) {
    console.error("Error fetching completed bids:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch completed bids",
      error: error.message,
    });
  }
};






/**
 * Get all bids (all statuses) with pagination and filters
 */
export const getAllBids = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [bids, totalCount] = await Promise.all([
      Bid.find(query)
        .populate({
          path: "user_id",
          select: "name email phone",
        })
        .populate({
          path: "offers",
          populate: [
            {
              path: "shopId",
              select: "name email phone address",
            },
            {
              path: "counterOffers.createdBy",
              select: "name email",
            },
          ],
        })
        .populate({
          path: "acceptedOffer",
          populate: {
            path: "shopId",
            select: "name email phone address",
          },
        })
        .populate({
          path: "currentShopId",
          select: "name email phone address",
        })
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Bid.countDocuments(query),
    ]);

    const enrichedBids = bids.map((bid) => ({
      ...bid,
      totalOffers: bid.offers?.length || 0,
      acceptedPrice: bid.acceptedOffer?.price || null,
      isExpired: bid.status === "active" ? checkIfExpired(bid) : false,
    }));

    res.status(200).json({
      success: true,
      count: enrichedBids.length,
      totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      data: enrichedBids,
    });
  } catch (error) {
    console.error("Error fetching all bids:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bids",
      error: error.message,
    });
  }
};







/**
 * Get single bid details by ID
 */
export const getBidDetails = async (req, res) => {
  try {
    const { bidId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(bidId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bid ID format",
      });
    }

    const bid = await Bid.findById(bidId)
      .populate({
        path: "user_id",
        select: "name email phone",
        model: "Customer",
      })
      .populate({
        path: "offers",
        populate: [
          {
            path: "shopId",
            select: "businessName email phone address",
            model: "Shop",
          },
          {
            path: "counterOffers.createdBy",
            select: "name email",
            model: "Customer",
          },
        ],
      })
      .populate({
        path: "acceptedOffer",
        populate: {
          path: "shopId",
          select: "businessName email phone address",
          model: "Shop",
        },
      })
      .populate({
        path: "currentShopId",
        select: "businessName email phone address profilePic",
        model: "Shop",
      })
      .lean();

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    // Helper function to check if bid is expired
    const checkIfExpired = (bid) => {
      const now = new Date();
      const createdAt = new Date(bid.createdAt);
      const dueDate = bid.dueDate ? new Date(bid.dueDate) : null;

      const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
      if (bid.status === "active" && hoursSinceCreation >= 48) return true;
      if (bid.status === "active" && dueDate && now > dueDate) return true;

      return false;
    };

    // Organize bid data by category for better structure
    const organizedBid = {
      // Basic bid info
      _id: bid._id,
      status: bid.status,
      reviewed: bid.reviewed,
      createdAt: bid.createdAt,
      updatedAt: bid.updatedAt,
      dueDate: bid.dueDate,

      // Vehicle Information
      vehicleInfo: {
        vehicleYear: bid.vehicleYear,
        vehicleMake: bid.vehicleMake,
        vehicleModel: bid.vehicleModel,
        vehicleTrim: bid.vehicleTrim,
        vehicleCondition: bid.vehicleCondition,
        vehicleImages: bid.vehicleImages || [],
      },

      // Request Information
      requestInfo: {
        requestCategory: bid.requestCategory,
        serviceDescription: bid.serviceDescription,
      },

      // Service-specific fields organized by category
      serviceDetails: {
        // Color Wrap & PPF
        colorWrapPPF: {
          desiredFinish: bid.desiredFinish,
          hasExistingWrap: bid.hasExistingWrap,
          wrapCoverage: bid.wrapCoverage,
          wrapType: bid.wrapType,
          desiredColor: bid.desiredColor,
        },

        // Business Wrap
        businessWrap: {
          brandingWrapCoverage: bid.brandingWrapCoverage,
          hasDesign: bid.hasDesign,
          hasLogo: bid.hasLogo,
          artworkFiles: bid.artworkFiles || [],
          exampleFiles: bid.exampleFiles || [],
        },

        // Window Tinting
        windowTinting: {
          hasExistingTint: bid.hasExistingTint,
          tintCoverage: bid.tintCoverage,
          tintType: bid.tintType,
        },

        // Ceramic Coating
        ceramicCoating: {
          paintFinish: bid.paintFinish,
          coatingPackage: bid.coatingPackage,
          coverageDetails: {
            exterior: bid.coverageExterior,
            interior: bid.coverageInterior,
            glassTrims: bid.coverageGlassTrims,
            wheelsBrakes: bid.coverageWheelsBrakes,
          },
          coatingPhotos: bid.coatingPhotos || [],
        },

        // PPF
        ppf: {
          ppfCoverage: bid.ppfCoverage,
          addCeramicCoating: bid.addCeramicCoating,
          ppfPhotos: bid.ppfPhotos || [],
        }
      },

      // Contact Information
      contactInfo: {
        firstName: bid.firstName,
        lastName: bid.lastName,
        email: bid.email,
        phone: bid.phone,
        address: bid.address,
        zipCode: bid.zipCode,
        country: bid.country,
        contactMethod: bid.contactMethod,
        latitude: bid.latitude,
        longitude: bid.longitude,
        location: bid.location,
      },

      // References
      user_id: bid.user_id,
      offers: bid.offers,
      acceptedOffer: bid.acceptedOffer,
      currentShopId: bid.currentShopId,

      // Statistics
      statistics: {
        totalOffers: bid.offers?.length || 0,
        acceptedPrice: bid.acceptedOffer?.price || null,
        isExpired: bid.status === "active" ? checkIfExpired(bid) : false,
        counterOffersCount: bid.offers?.reduce(
          (acc, offer) => acc + (offer.counterOffers?.length || 0),
          0
        ),
        averageOfferPrice: bid.offers?.length > 0
          ? Math.round(bid.offers.reduce((sum, offer) => sum + (offer.price || 0), 0) / bid.offers.length)
          : 0,
        highestOffer: bid.offers?.length > 0
          ? Math.max(...bid.offers.map(offer => offer.price || 0))
          : 0,
        lowestOffer: bid.offers?.length > 0
          ? Math.min(...bid.offers.map(offer => offer.price || 0))
          : 0,
      }
    };

    res.status(200).json({
      success: true,
      data: organizedBid,
    });
  } catch (error) {
    console.error("Error fetching bid details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bid details",
      error: error.message,
    });
  }
};




/**
 * Get bid statistics overview
 */
export const getBidStats = async (req, res) => {
  try {
    const [
      totalBids,
      activeBids,
      inProgressBids,
      completedBids,
      expiredBids,
      canceledBids,
      totalOffers,
      averageOffersPerBid,
    ] = await Promise.all([
      Bid.countDocuments(),
      Bid.countDocuments({ status: "active" }),
      Bid.countDocuments({ status: "in_progress" }),
      Bid.countDocuments({ status: "completed" }),
      Bid.countDocuments({ status: "expired" }),
      Bid.countDocuments({ status: "canceled" }),
      Offer.countDocuments(),
      Bid.aggregate([
        {
          $project: {
            offerCount: { $size: "$offers" },
          },
        },
        {
          $group: {
            _id: null,
            avgOffers: { $avg: "$offerCount" },
          },
        },
      ]),
    ]);

    // Get counter offers stats
    const counterOffersStats = await Offer.aggregate([
      {
        $project: {
          counterOfferCount: { $size: "$counterOffers" },
        },
      },
      {
        $group: {
          _id: null,
          totalCounterOffers: { $sum: "$counterOfferCount" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBids,
        activeBids,
        inProgressBids,
        completedBids,
        expiredBids,
        canceledBids,
        totalOffers,
        averageOffersPerBid: averageOffersPerBid[0]?.avgOffers || 0,
        totalCounterOffers: counterOffersStats[0]?.totalCounterOffers || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching bid stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bid statistics",
      error: error.message,
    });
  }
};

// Helper Functions
function checkIfExpired(bid) {
  const now = new Date();
  const createdAt = new Date(bid.createdAt);
  const dueDate = bid.dueDate ? new Date(bid.dueDate) : null;

  const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
  if (hoursSinceCreation >= 48) return true;
  if (dueDate && now > dueDate) return true;

  return false;
}

function calculateCompletionTime(bid) {
  if (!bid.createdAt || !bid.updatedAt) return null;

  const created = new Date(bid.createdAt);
  const completed = new Date(bid.updatedAt);
  const diffMs = completed - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );

  return { days: diffDays, hours: diffHours };
}








export const toggleBlockShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { blocked, reason } = req.body;

    if (typeof blocked !== "boolean") {
      return res.status(400).json({
        success: false,
        message: '"blocked" must be true or false',
      });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    if (!shop.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: "Shop does not have a Stripe subscription",
      });
    }

    const subscriptionId = shop.stripeSubscriptionId;

    // ================= BLOCK SHOP =================
    if (blocked === true) {
      if (shop.isBlocked) {
        return res.status(400).json({
          success: false,
          message: "Shop is already blocked",
        });
      }

      // Pause billing in Stripe (no future charges)
      await stripe.subscriptions.update(subscriptionId, {
        pause_collection: {
          behavior: "void", // cleaner than mark_uncollectible
        },
      });

      // Update local shop state
      await shop.blockShop(req.admin?._id, reason);
      shop.subscriptionStatus = "paused";
      await shop.save();

      return res.status(200).json({
        success: true,
        message:
          "Shop blocked successfully. Subscription paused and future charges stopped.",
      });
    }

    // ================= UNBLOCK SHOP =================
    if (blocked === false) {
      if (!shop.isBlocked) {
        return res.status(400).json({
          success: false,
          message: "Shop is not blocked",
        });
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      // Resume billing if paused
      if (subscription.pause_collection) {
        await stripe.subscriptions.update(subscriptionId, {
          pause_collection: null,
        });

        const currentPeriodEnd =
          subscription.current_period_end * 1000;

        // If billing period ended while blocked → start fresh
        if (Date.now() > currentPeriodEnd) {
          await stripe.subscriptions.update(subscriptionId, {
            billing_cycle_anchor: "now",
            proration_behavior: "none",
          });
        }
      }

      // Update local shop state
      await shop.unblockShop();
      shop.subscriptionStatus = "active";
      await shop.save();

      return res.status(200).json({
        success: true,
        message:
          "Shop unblocked successfully. Subscription resumed from unblock date.",
      });
    }
  } catch (error) {
    console.error("❌ Error toggling shop block:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update shop block status",
    });
  }
};












// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send email controller
 */
export const sendEmail_To_User = async (req, res) => {
  try {
    const { recipientEmail, subject, message } = req.body;

    // Validate required fields
    if (!recipientEmail || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: recipientEmail, subject, and message are required'
      });
    }

    // Validate email format
    if (!validator.isEmail(recipientEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format'
      });
    }

    // Prepare email data
    const msg = {
      to: recipientEmail,
      from: process.env.SENDGRID_SENDER || process.env.ADMIN_EMAIL || "admin@yourplatform.com",
      subject: subject,
      html: message,
    };


    // Send email using SendGrid
    await sgMail.send(msg);


    // Return success response
    res.json({
      success: true,
      message: 'Email sent successfully',
      data: {
        recipientEmail,
        subject,
        sentAt: new Date()
      }
    });

  } catch (error) {
    console.error("❌ Email send error:", error.response?.body || error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to send email. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};







export const extendShopTrial = async (req, res) => {
  try {
    const { shopId } = req.params;
    const days = Number(req.body.days);

    // Validate days input
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        message: "Days must be between 1 and 365"
      });
    }

    // Find shop
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found"
      });
    }

    // Check if shop is currently in trial
    if (shop.subscriptionStatus !== 'trialing') {
      return res.status(400).json({
        success: false,
        message: "Shop is not in trial period. Only shops with active trials can be extended."
      });
    }

    // Check if trial end date exists
    const trialEnd = shop.currentSubscription?.trialEnd;
    if (!trialEnd) {
      return res.status(400).json({
        success: false,
        message: "Trial end date not found"
      });
    }

    // Check if trial has already ended
    const now = new Date();
    const currentTrialEnd = new Date(trialEnd);
    if (now >= currentTrialEnd) {
      return res.status(400).json({
        success: false,
        message: "Trial has already ended"
      });
    }

    // Calculate new trial end date
    const previousTrialEnd = new Date(currentTrialEnd);
    const newTrialEnd = new Date(previousTrialEnd.getTime() + days * 24 * 60 * 60 * 1000);

    // Ensure currentSubscription exists
    if (!shop.currentSubscription) {
      shop.currentSubscription = {};
    }

    // Initialize trialExtensions array if it doesn't exist
    if (!shop.currentSubscription.trialExtensions) {
      shop.currentSubscription.trialExtensions = [];
    }

    // Update trial information
    shop.currentSubscription.trialEnd = newTrialEnd;
    shop.currentSubscription.trialExtended = true;
    
    // Add extension record
    shop.currentSubscription.trialExtensions.push({
      extendedBy: req.admin?._id || null,
      previousEndDate: previousTrialEnd,
      newEndDate: newTrialEnd,
      extendedDays: days,
      extendedAt: now,
      reason: "Admin extension"
    });

    // Save the shop
    await shop.save();


    return res.json({
      success: true,
      message: `Free trial extended by ${days} days`,
      data: {
        shopId: shop._id,
        shopName: shop.businessName,
        previousTrialEnd: previousTrialEnd,
        newTrialEnd: newTrialEnd,
        extendedDays: days,
        totalExtensions: shop.currentSubscription.trialExtensions.length,
        trialDaysRemaining: Math.ceil((newTrialEnd - now) / (1000 * 60 * 60 * 24))
      }
    });

  } catch (err) {
    console.error("❌ Trial extension failed:", err);
    res.status(500).json({
      success: false,
      message: "Failed to extend trial",
      error: err.message
    });
  }
};












export const updateShopByAdmin = async (req, res) => {
  try {
 
    // Get ID from body._id OR body.shopId (frontend sends shopId)
    const id = req.body._id || req.body.shopId;

    if (!id) {
      console.error("❌ No shop ID provided");
      return res.status(400).json({
        success: false,
        message: "Shop ID is required"
      });
    }

    const shop = await Shop.findById(id);
    if (!shop) {
      console.error(`❌ Shop not found: ${id}`);
      return res.status(404).json({ message: "Shop not found" });
    }

    // Check if rating is being manually updated by admin
    const isRatingManuallyUpdated = req.body.rating !== undefined && req.body.rating !== shop.rating;
    const isReviewCountManuallyUpdated = req.body.reviewCount !== undefined && req.body.reviewCount !== shop.reviewCount;

    // If admin is trying to manually set both rating and reviewCount, validate them
    if (isRatingManuallyUpdated || isReviewCountManuallyUpdated) {
      const newRating = parseFloat(req.body.rating);
      const newReviewCount = parseInt(req.body.reviewCount, 10);

      // Validate that rating is between 0 and 5
      if (newRating < 0 || newRating > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 0 and 5"
        });
      }

      // Validate that reviewCount is not negative
      if (newReviewCount < 0) {
        return res.status(400).json({
          success: false,
          message: "Review count cannot be negative"
        });
      }

      // If reviewCount is 0, rating should be 0
      if (newReviewCount === 0 && newRating !== 0) {
        console.warn(`⚠️ Warning: Setting rating to 0 because reviewCount is 0`);
        req.body.rating = 0;
      }
    }

    // 🔍 DEBUG: Log received files in detail
    if (req.files) {
      Object.keys(req.files).forEach(fieldName => {
        console.log(`📁 ${fieldName}:`, req.files[fieldName].map(f => ({
          originalname: f.originalname,
          size: f.size,
          mimetype: f.mimetype,
          path: f.path
        })));
      });
    }

    // Helper function to parse values from FormData
    const parseField = (field) => {
      if (field === undefined || field === null || field === 'undefined' || field === 'null') {
        return undefined;
      }

      if (typeof field === 'string' && field.trim() === '') {
        return undefined;
      }

      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch (e) {
          // If it's not valid JSON, return the string
          return field;
        }
      }

      return field;
    };

    // Helper to convert string or array to proper array
    const toArray = (value) => {
      if (value === undefined || value === null) return undefined;
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          // Try to parse as JSON first
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
          return [value];
        } catch {
          // If not JSON, try splitting by comma
          return value.split(',').map(item => item.trim()).filter(item => item);
        }
      }
      return [value];
    };

    // Helper to parse boolean values
    const parseBoolean = (value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
        if (value === '1') return true;
        if (value === '0') return false;
      }
      if (typeof value === 'number') return Boolean(value);
      return undefined;
    };

    // Helper to parse date values
    const parseDate = (value) => {
      if (!value) return undefined;
      try {
        const date = new Date(value);
        return isNaN(date.getTime()) ? undefined : date;
      } catch {
        return undefined;
      }
    };

    // Handle file uploads - only update if new file is uploaded
    const updates = {};

    // Single file fields
    const singleFileFields = [
      'profilePic',
      'storeFrontPhoto',
      'workSpacePhoto',
      'insuranceCertificate'
    ];

    singleFileFields.forEach(field => {
      if (req.files && req.files[field] && req.files[field][0]) {
        updates[field] = req.files[field][0].path;
      }
    });

    // Handle multiple certificate files
    if (req.files && req.files.certificateFiles) {
      const newCertificateFiles = req.files.certificateFiles.map(f => f.path);
      const existingFiles = shop.certificateFiles || [];
      // Combine existing and new files, limit to 5
      updates.certificateFiles = [...existingFiles, ...newCertificateFiles].slice(0, 5);
    }

    // Parse and add text fields (REMOVED 'plan' - not editable on frontend)
    const textFields = [
      'businessName', 'legalEntityName', 'ownerName', 'email',
      'countryCode', 'phone', 'ownerPhone', 'website',
      'address', 'country', 'zipCode',
      'vinylFilms', 'certificates', 'yearsExperience',
      'insuranceCarrier', 'policyNumber',
      'additionalInfo', 'status',
      'blockedReason'
    ];

    textFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Parse numeric fields
    if (req.body.latitude !== undefined) {
      updates.latitude = parseFloat(req.body.latitude);
    }
    if (req.body.longitude !== undefined) {
      updates.longitude = parseFloat(req.body.longitude);
    }

    // Handle rating update
    if (req.body.rating !== undefined) {
      const newRating = parseFloat(req.body.rating);

      const reviewCountToUse = req.body.reviewCount !== undefined
        ? parseInt(req.body.reviewCount, 10)
        : shop.reviewCount;

      // Validate consistency: if reviewCount is 0, rating should be 0
      if (reviewCountToUse === 0 && newRating !== 0) {
        console.warn(`⚠️ Setting rating to 0 because reviewCount is ${reviewCountToUse}`);
        updates.rating = 0;
      } else {
        updates.rating = newRating;
      }
    }

    if (req.body.reviewCount !== undefined) {
      updates.reviewCount = parseInt(req.body.reviewCount, 10);

      // If reviewCount is set to 0, ensure rating is also 0
      if (updates.reviewCount === 0 && (!req.body.rating || req.body.rating !== 0)) {
        console.warn(`⚠️ Setting rating to 0 because reviewCount is being set to 0`);
        updates.rating = 0;
      }
    }

    // Parse date fields
    if (req.body.policyExpiration !== undefined) {
      updates.policyExpiration = parseDate(req.body.policyExpiration);
    }
    if (req.body.startDate !== undefined) {
      updates.startDate = parseDate(req.body.startDate);
    }
    if (req.body.planStartDate !== undefined) {
      updates.planStartDate = parseDate(req.body.planStartDate);
    }
    if (req.body.trialEndDate !== undefined) {
      updates.trialEndDate = parseDate(req.body.trialEndDate);
    }
    if (req.body.policyAcceptedAt !== undefined) {
      updates.policyAcceptedAt = parseDate(req.body.policyAcceptedAt);
    }

    // Parse array fields
    if (req.body.services !== undefined) {
      updates.services = toArray(req.body.services);
    }

    if (req.body.acceptedPayments !== undefined) {
      updates.acceptedPayments = toArray(req.body.acceptedPayments);
    }

    // Parse object fields
    if (req.body.businessHours !== undefined) {
      const parsedHours = parseField(req.body.businessHours);
      if (parsedHours && typeof parsedHours === 'object') {
        updates.businessHours = parsedHours;
      }
    }

    // Parse social media
    if (req.body.socialMedia !== undefined) {
      const parsedSocial = parseField(req.body.socialMedia);
      if (parsedSocial && typeof parsedSocial === 'object') {
        updates.socialMedia = {
          instagram: parsedSocial.instagram || shop.socialMedia?.instagram || "",
          facebook: parsedSocial.facebook || shop.socialMedia?.facebook || "",
          linkedin: parsedSocial.linkedin || shop.socialMedia?.linkedin || "",
        };
      }
    }

    // Parse boolean fields
    if (req.body.financingOffered !== undefined) {
      updates.financingOffered = parseBoolean(req.body.financingOffered);
    }
    if (req.body.isVerified !== undefined) {
      updates.isVerified = parseBoolean(req.body.isVerified);
    }
    if (req.body.isBlocked !== undefined) {
      updates.isBlocked = parseBoolean(req.body.isBlocked);
    }
    if (req.body.isEmailVerified !== undefined) {
      updates.isEmailVerified = parseBoolean(req.body.isEmailVerified);
    }
    if (req.body.acceptedPolicy !== undefined) {
      updates.acceptedPolicy = parseBoolean(req.body.acceptedPolicy);
    }

    // Log what we're updating
    Object.keys(updates).forEach(key => {
      console.log(`  ${key}:`, updates[key]);
    });

    // Filter out undefined values
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    });

    // Apply updates
    const updatedShop = await Shop.findByIdAndUpdate(
      id,
      { $set: filteredUpdates },
      { new: true, runValidators: true }
    );

    if (!updatedShop) {
      console.error(`❌ Failed to update shop: ${id}`);
      return res.status(500).json({
        success: false,
        message: "Failed to update shop in database"
      });
    }

    res.status(200).json({
      success: true,
      message: "Shop updated successfully by admin",
      data: updatedShop,
    });

  } catch (error) {
    console.error("❌ Admin update shop error:", error);

    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors).forEach(key => {
        errors[key] = error.errors[key].message;
      });

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update shop",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};










/**
 * @desc    Block or unblock a customer with email notification
 * @route   POST /api/admin/customers/:id/block
 * @access  Private/Admin
 */
export const blockCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    // Validate action
    if (!action || !['block', 'unblock'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action is required and must be either 'block' or 'unblock'"
      });
    }

    // Find customer
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    // Prepare update data
    const updateData = {
      isBlocked: action === 'block' ? true : false,
      blockedAt: action === 'block' ? new Date() : null,
      blockedReason: action === 'block' ? (reason || "Blocked by administrator") : "",
      updatedAt: new Date()
    };

    // Update customer
    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry');

    // Send email notification for blocking action only
    if (action === 'block') {
      try {
        const blockReason = reason || "Violation of terms of service";
        const subject = "Account Access Restricted - Action Required";
        
        const html = `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #e74c3c; margin-bottom: 10px;">⚠️ Account Restricted</h1>
              <div style="height: 2px; background: #e74c3c; width: 100px; margin: 0 auto;"></div>
            </div>
            
            <div style="margin-bottom: 25px;">
              <p style="font-size: 16px; line-height: 1.6; color: #333;">
                Dear <strong>${customer.name}</strong>,
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #333;">
                We regret to inform you that your account has been temporarily restricted from accessing our platform.
              </p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 25px 0; border-left: 4px solid #e74c3c;">
              <h3 style="color: #e74c3c; margin-top: 0;">Account Restriction Details:</h3>
              <ul style="color: #555; line-height: 1.8;">
                <li><strong>Account Email:</strong> ${customer.email}</li>
                <li><strong>Restriction Date:</strong> ${new Date().toLocaleDateString()}</li>
                <li><strong>Reason:</strong> ${blockReason}</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 25px;">
              <h3 style="color: #333; margin-bottom: 15px;">What This Means:</h3>
              <ul style="color: #555; line-height: 1.8; padding-left: 20px;">
                <li>You will not be able to log into your account</li>
                <li>Any active sessions have been terminated</li>
                <li>You cannot make purchases or place orders</li>
                <li>Your account data remains secure and preserved</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 25px;">
              <h3 style="color: #333; margin-bottom: 15px;">Next Steps:</h3>
              <ol style="color: #555; line-height: 1.8; padding-left: 20px;">
                <li>Review our Terms of Service and Community Guidelines</li>
                <li>If you believe this is an error, please contact our support team</li>
                <li>Include your account email in all communications</li>
                <li>Allow 24-48 hours for review of appeal requests</li>
              </ol>
            </div>
            
            <div style="background: #e8f4fd; padding: 15px; border-radius: 6px; margin: 25px 0; border-left: 4px solid #3498db;">
              <p style="margin: 0; color: #2c3e50;">
                <strong>Need Help?</strong><br>
                Contact our support team at: 
                <a href="mailto:support@bidawrap.com" style="color: #3498db; text-decoration: none;">
                  support@bidawrap.com
                </a>
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #7f8c8d; font-size: 14px; margin-bottom: 5px;">
                This is an automated notification. Please do not reply to this email.
              </p>
              <p style="color: #7f8c8d; font-size: 12px;">
                © ${new Date().getFullYear()} Your Company Name. All rights reserved.
              </p>
            </div>
          </div>
        `;

        // Send the email
        await sendEmail(customer.email, subject, html);
        
      } catch (emailError) {
        // Log email error but don't fail the whole operation
        console.error('❌ Failed to send block notification email:', emailError);
        // Continue with the response - the block action was successful
      }
    } else if (action === 'unblock') {
      // Optional: Send unblock notification email
      try {
        const subject = "Account Access Restored";
        
        const html = `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #27ae60; text-align: center;">✅ Account Restored</h1>
            
            <p>Dear ${customer.name},</p>
            
            <p>We are pleased to inform you that your account has been restored and you can now access our platform again.</p>
            
            <div style="background: #f0f8f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Account:</strong> ${customer.email}</p>
              <p><strong>Status:</strong> Active</p>
              <p><strong>Restored on:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <p>You may now log in to your account and resume using our services.</p>
            
            <p>If you have any questions, please contact our support team.</p>
            
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              This is an automated message.
            </p>
          </div>
        `;

        await sendEmail(customer.email, subject, html);
      } catch (emailError) {
        console.error('❌ Failed to send unblock notification email:', emailError);
        // Continue with response
      }
    }

    // Log the action
    console.log(`Customer ${action}ed:`, {
      customerId: id,
      customerEmail: customer.email,
      action,
      reason,
      timestamp: new Date().toISOString(),
      emailSent: action === 'block' ? 'attempted' : 'none'
    });

    res.status(200).json({
      success: true,
      message: `Customer ${action === 'block' ? 'blocked' : 'unblocked'} successfully`,
      data: {
        _id: updatedCustomer._id,
        name: updatedCustomer.name,
        email: updatedCustomer.email,
        isBlocked: updatedCustomer.isBlocked,
        blockedAt: updatedCustomer.blockedAt,
        blockedReason: updatedCustomer.blockedReason
      },
      notification: {
        emailSent: true,
        recipient: customer.email
      }
    });

  } catch (error) {
    console.error(`❌ Error ${req.body.action || 'block/unblock'}ing customer:`, error);
    res.status(500).json({
      success: false,
      message: "Server error while processing request",
      error: error.message
    });
  }
};

/**
 * @desc    Get blocked customers list
 * @route   GET /api/admin/customers/blocked
 * @access  Private/Admin
 */
export const getBlockedCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get blocked customers
    const blockedCustomers = await Customer.find({ isBlocked: true })
      .select('-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry')
      .sort({ blockedAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const totalBlocked = await Customer.countDocuments({ isBlocked: true });
    const totalCustomers = await Customer.countDocuments();

    res.status(200).json({
      success: true,
      data: blockedCustomers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalBlocked / limit),
        totalBlocked,
        totalCustomers,
        hasMore: skip + blockedCustomers.length < totalBlocked
      }
    });

  } catch (error) {
    console.error("❌ Error fetching blocked customers:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching blocked customers",
      error: error.message
    });
  }
};

/**
 * @desc    Check if customer is blocked
 * @route   GET /api/admin/customers/:id/block-status
 * @access  Private/Admin
 */
export const getCustomerBlockStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id)
      .select('_id name email isBlocked blockedAt blockedReason');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        isBlocked: customer.isBlocked,
        blockedAt: customer.blockedAt,
        blockedReason: customer.blockedReason
      }
    });

  } catch (error) {
    console.error("❌ Error fetching customer block status:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching block status",
      error: error.message
    });
  }
};