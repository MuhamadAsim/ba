
import bcrypt from "bcryptjs";
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js"
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import VerificationRequest from "../models/updateProfileModel.js";
import Stripe from 'stripe';


dotenv.config();

// Helper: generate 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper: send OTP email
const sendOtpEmail = async (email, otp) => {
  const msg = {
    to: email,
    from: process.env.SENDGRID_SENDER,
    subject: "Your Verification Code ",
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
export const registerShop = async (req, res) => {
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    // ✅ Check if email exists in Customer collection
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(400).json({
        status: "customer_exists",
        message: "This email is already registered as a customer. Please use a different email for shop registration."
      });
    }

    // Check if shop already exists
    const existingShop = await Shop.findOne({ email });

    if (existingShop) {
      if (existingShop.isEmailVerified) {
        return res.json({
          status: "exists",
          message: "Account already exists. Please sign in instead."
        });
      } else {
        // Update the registration method if needed
        if (existingShop.registrationMethod !== "email_password") {
          existingShop.registrationMethod = "email_password";
        }

        const otp = generateOtp();
        existingShop.otp = otp;
        existingShop.otpExpiry = Date.now() + 10 * 60 * 1000;
        await existingShop.save();
        await sendOtpEmail(email, otp);

        return res.json({
          status: "otp_sent",
          message: "OTP sent to your email. Please verify your account."
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const EXPIRY_TIME = 2 * 60 * 60 * 1000; // 2 hours

    const newShop = new Shop({
      email,
      password: hashedPassword,
      registrationMethod: "email_password",

      // 👇 NEW
      createdAt: new Date(),
      registrationExpiresAt: new Date(Date.now() + EXPIRY_TIME),

      phone: "000000000",
      ownerPhone: "00000000",
      businessName: "Business Name (Pending)",
      legalEntityName: "Legal Entity (Pending)",
      ownerName: "Owner Name (Pending)",
      address: "Business Address (Pending)",
      country: "US (Pending)",
      startDate: new Date(),
      insuranceCarrier: "Insurance Carrier (Pending)",
      policyNumber: "Policy Number (Pending)",
      policyExpiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      insuranceCertificate: "Pending",
      storeFrontPhoto: "Pending",
      workSpacePhoto: "Pending",
      certificateFiles: [],
      zipCode: "00000",
      plan: "basic",
      isEmailVerified: false,
      otp,
      otpExpiry: Date.now() + 10 * 60 * 1000,
    });

    await newShop.save();
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
    const shop = await Shop.findOne({ email });

    if (!shop)
      return res.status(404).json({
        status: "error",
        message: "Shop not found"
      });

    if (!shop.otp || !shop.otpExpiry)
      return res.json({
        status: "invalid",
        message: "No OTP found. Please request a new one."
      });

    if (shop.otp !== otp)
      return res.json({
        status: "invalid",
        message: "Invalid OTP. Please check and try again."
      });

    if (shop.otpExpiry < Date.now())
      return res.json({
        status: "expired",
        message: "OTP expired. Please request a new one."
      });

    // Verify shop email
    shop.isEmailVerified = true;
    shop.otp = undefined;
    shop.otpExpiry = undefined;
    await shop.save();

    res.json({
      status: "verified",
      message: "Email verified successfully"
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error during OTP verification"
    });
  }
};


// // ============================================
// // FIXED: signin with shop.isVerified check
// // ============================================
// export const signin = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const shop = await Shop.findOne({ email });
//     if (!shop)
//       return res.json({
//         status: "invalid_credentials",
//         message: "Invalid email or password",
//       });

//     if (shop.registrationMethod === "google") {
//       return res.json({
//         status: "google_auth_required",
//         message: "This account was created with Google. Please sign in with Google.",
//         redirectToGoogle: true
//       });
//     }

//     const isMatch = await bcrypt.compare(password, shop.password);
//     if (!isMatch)
//       return res.json({
//         status: "invalid_credentials",
//         message: "Invalid email or password",
//       });

//     // ============================
//     // STEP 1: Check if shop is blocked
//     // ============================
//     if (shop.isBlocked === true || shop.status === "blocked") {
//       return res.json({
//         status: "blocked",
//         message: "Your shop account has been blocked. Please contact support.",
//         blockedAt: shop.blockedAt,
//         blockedReason: shop.blockedReason || "Account suspended"
//       });
//     }

//     // ============================
//     // STEP 2: Email must be verified
//     // ============================
//     if (!shop.isEmailVerified) {
//       const otp = generateOtp();
//       shop.otp = otp;
//       shop.otpExpiry = Date.now() + 10 * 60 * 1000;
//       await shop.save();

//       await sendOtpEmail(email, otp);

//       return res.json({
//         status: "not_verified",
//         message: "Email not verified. OTP sent to your email.",
//       });
//     }

//     // ============================
//     // STEP 3: Admin approval required
//     // ============================
//     if (!shop.isVerified) {
//       return res.json({
//         status: "not_approved",
//         message: "Your shop account is pending admin approval.",
//       });
//     }

//     // ============================
//     // STEP 4: Check if shop is active (not suspended/cancelled)
//     // ============================
//     if (shop.status !== "active") {
//       return res.json({
//         status: "inactive",
//         message: `Your shop account is ${shop.status}. Please contact support.`,
//       });
//     }

//     // ============================
//     // STEP 5: Everything OK → login
//     // ============================
//     const token = jwt.sign(
//       {
//         shopId: shop._id,
//         email: shop.email,
//         role: "shop",
//         isBlocked: shop.isBlocked,
//         status: shop.status
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     res.json({
//       status: "success",
//       message: "Login successful",
//       token,
//       shop: {
//         id: shop._id,
//         email: shop.email,
//         businessName: shop.businessName,
//         ownerName: shop.ownerName,
//         plan: shop.plan,
//         avatar: shop.profilePic || "",

//         // Contact
//         countryCode: shop.countryCode,
//         phone: shop.phone,
//         ownerPhone: shop.ownerPhone, // Added
//         website: shop.website,
//         country: shop.country,
//         zipCode: shop.zipCode,
//         latitude: shop.latitude,
//         longitude: shop.longitude,
//         address: shop.address,

//         // Services
//         services: shop.services,
//         vinylFilms: shop.vinylFilms,
//         certificates: shop.certificates,
//         certificateFiles: shop.certificateFiles,
//         startDate: shop.startDate?.toISOString?.() || shop.startDate,
//         bio: shop.additionalInfo || "",

//         // Photos
//         workSpacePhoto: shop.workSpacePhoto,
//         storeFrontPhoto: shop.storeFrontPhoto,

//         // Legal
//         legalEntityName: shop.legalEntityName,
//         insuranceCarrier: shop.insuranceCarrier,
//         policyNumber: shop.policyNumber,
//         policyExpiration: shop.policyExpiration,
//         insuranceCertificate: shop.insuranceCertificate,

//         // Social media
//         instagramLink: shop.socialMedia?.instagram || "",
//         facebookLink: shop.socialMedia?.facebook || "",
//         linkedinLink: shop.socialMedia?.linkedin || "",

//         // New fields from registration
//         financingOffered: shop.financingOffered || false,
//         acceptedPayments: shop.acceptedPayments || [],
//         yearsExperience: shop.yearsExperience || "",
//         businessHours: shop.businessHours || {
//           monday: { open: "", close: "", closed: false },
//           tuesday: { open: "", close: "", closed: false },
//           wednesday: { open: "", close: "", closed: false },
//           thursday: { open: "", close: "", closed: false },
//           friday: { open: "", close: "", closed: false },
//           saturday: { open: "", close: "", closed: false },
//           sunday: { open: "", close: "", closed: false },
//         },

//         // Payment info
//         paymentInfo: shop.paymentInfo || {},

//         rating: shop.rating || 0,
//         reviewCount: shop.reviewCount || 0,
//         isEmailVerified: shop.isEmailVerified,
//         isVerified: shop.isVerified,
//         verifiedAt: shop.verifiedAt?.toISOString?.() || null,
//         acceptedPolicy: shop.acceptedPolicy,
//         policyAcceptedAt: shop.policyAcceptedAt?.toISOString?.() || null,
//         status: shop.status,
//         isBlocked: shop.isBlocked,
//         blockedAt: shop.blockedAt,
//         blockedReason: shop.blockedReason,

//         // Additional fields if they exist
//         ownerPhone: shop.ownerPhone, // Alias for ownerPhone
//         additionalInfo: shop.additionalInfo || "",
//         storeFrontPhoto: shop.storeFrontPhoto,
//         workSpacePhoto: shop.workSpacePhoto,
//       },
//     });

//   } catch (error) {
//     console.error("Signin error:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Server error during signin",
//     });
//   }
// };











// ============================================
// FIXED: signin with shop.isVerified check + Subscription Data
// ============================================
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const shop = await Shop.findOne({ email });
    if (!shop)
      return res.json({
        status: "invalid_credentials",
        message: "Invalid email or password",
      });

    if (shop.registrationMethod === "google") {
      return res.json({
        status: "google_auth_required",
        message: "This account was created with Google. Please sign in with Google.",
        redirectToGoogle: true
      });
    }

    const isMatch = await bcrypt.compare(password, shop.password);
    if (!isMatch)
      return res.json({
        status: "invalid_credentials",
        message: "Invalid email or password",
      });

    // ============================
    // STEP 1: Check if shop is blocked
    // ============================
    if (shop.isBlocked === true || shop.status === "blocked") {
      return res.json({
        status: "blocked",
        message: "Your shop account has been blocked. Please contact support.",
        blockedAt: shop.blockedAt,
        blockedReason: shop.blockedReason || "Account suspended"
      });
    }

    // ============================
    // STEP 2: Email must be verified
    // ============================
    if (!shop.isEmailVerified) {
      const otp = generateOtp();
      shop.otp = otp;
      shop.otpExpiry = Date.now() + 10 * 60 * 1000;
      await shop.save();

      await sendOtpEmail(email, otp);

      return res.json({
        status: "not_verified",
        message: "Email not verified. OTP sent to your email.",
      });
    }

    // ============================
    // STEP 3: Admin approval required
    // ============================
    if (!shop.isVerified) {
      return res.json({
        status: "not_approved",
        message: "Your shop account is pending admin approval.",
      });
    }

    // ============================
    // STEP 4: Check if shop is active (not suspended/cancelled)
    // ============================
    if (shop.status !== "active") {
      return res.json({
        status: "inactive",
        message: `Your shop account is ${shop.status}. Please contact support.`,
      });
    }

    // ============================
    // STEP 5: Check subscription status
    // ============================
    const subscriptionStatus = shop.subscriptionStatus;
    const isInTrial = shop.isInTrial;
    const hasActiveSubscription = shop.hasActiveSubscription;
    const trialDaysRemaining = shop.trialDaysRemaining || 0;
    const trialInfo = shop.trialInfo || {};

    // Define subscription access rules
    let shouldBlockAccess = false;
    let subscriptionMessage = "";
    let requiresPlanSelection = false;

    // Check subscription scenarios
    if (subscriptionStatus === "inactive" || subscriptionStatus === "incomplete") {
      // New shop - needs to select a plan
      requiresPlanSelection = true;
      subscriptionMessage = "Please select a subscription plan to continue";
    } else if (subscriptionStatus === "trialing") {
      // In trial period
      if (trialDaysRemaining <= 0) {
        shouldBlockAccess = true;
        subscriptionMessage = "Your trial has ended. Please select a plan to continue";
      } else {
        subscriptionMessage = `You have ${trialDaysRemaining} days left in your trial`;
      }
    } else if (subscriptionStatus === "past_due" || subscriptionStatus === "unpaid") {
      // Payment failed
      shouldBlockAccess = true;
      subscriptionMessage = "Your payment is past due. Please update your payment method";
    } else if (subscriptionStatus === "cancelled" || subscriptionStatus === "incomplete_expired") {
      // Subscription cancelled or expired
      shouldBlockAccess = true;
      subscriptionMessage = "Your subscription has been cancelled. Please select a new plan";
    } else if (subscriptionStatus === "paused") {
      // Subscription paused
      shouldBlockAccess = true;
      subscriptionMessage = "Your subscription is paused. Please contact support";
    }

    // Block access if subscription check fails
    if (shouldBlockAccess) {
      return res.json({
        status: "subscription_required",
        message: subscriptionMessage,
        subscriptionStatus: subscriptionStatus,
        requiresPlanSelection: true,
        trialInfo: trialInfo
      });
    }

    // ============================
    // STEP 6: Everything OK → login
    // ============================
    const token = jwt.sign(
      {
        shopId: shop._id,
        email: shop.email,
        role: "shop",
        isBlocked: shop.isBlocked,
        status: shop.status,
        subscriptionStatus: shop.subscriptionStatus,
        hasActiveSubscription: shop.hasActiveSubscription
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Prepare subscription data for frontend
    const subscriptionData = {
      status: subscriptionStatus,
      isInTrial: isInTrial,
      hasActiveSubscription: hasActiveSubscription,
      trialDaysRemaining: trialDaysRemaining,
      trialInfo: trialInfo,
      requiresPlanSelection: requiresPlanSelection,

      // Current subscription details
      currentSubscription: shop.currentSubscription ? {
        planName: shop.currentSubscription.planName,
        amount: shop.currentSubscription.amount,
        currency: shop.currentSubscription.currency,
        interval: shop.currentSubscription.interval,
        currentPeriodStart: shop.currentSubscription.currentPeriodStart,
        currentPeriodEnd: shop.currentSubscription.currentPeriodEnd,
        trialStart: shop.currentSubscription.trialStart,
        trialEnd: shop.currentSubscription.trialEnd,
        trialDays: shop.currentSubscription.trialDays,
        cancelAtPeriodEnd: shop.currentSubscription.cancelAtPeriodEnd,
        trialExtended: shop.currentSubscription.trialExtended,
        stripeSubscriptionId: shop.stripeSubscriptionId
      } : null,

      // Plan information
      plan: shop.plan,
      planDisplay: shop.planDisplay,
      planPrice: shop.planPrice,
      stripePriceId: shop.stripePriceId
    };

    res.json({
      status: "success",
      message: "Login successful",
      token,
      subscription: subscriptionData,
      shop: {
        id: shop._id,
        email: shop.email,
        businessName: shop.businessName,
        ownerName: shop.ownerName,
        plan: shop.plan,
        avatar: shop.profilePic || "",

        // Contact
        countryCode: shop.countryCode,
        phone: shop.phone,
        ownerPhone: shop.ownerPhone,
        website: shop.website,
        country: shop.country,
        zipCode: shop.zipCode,
        latitude: shop.latitude,
        longitude: shop.longitude,
        address: shop.address,

        // Services
        services: shop.services,
        vinylFilms: shop.vinylFilms,
        certificates: shop.certificates,
        certificateFiles: shop.certificateFiles,
        startDate: shop.startDate?.toISOString?.() || shop.startDate,
        bio: shop.additionalInfo || "",

        // Photos
        workSpacePhoto: shop.workSpacePhoto,
        storeFrontPhoto: shop.storeFrontPhoto,

        // Legal
        legalEntityName: shop.legalEntityName,
        insuranceCarrier: shop.insuranceCarrier,
        policyNumber: shop.policyNumber,
        policyExpiration: shop.policyExpiration,
        insuranceCertificate: shop.insuranceCertificate,

        // Social media
        instagramLink: shop.socialMedia?.instagram || "",
        facebookLink: shop.socialMedia?.facebook || "",
        linkedinLink: shop.socialMedia?.linkedin || "",

        // New fields from registration
        financingOffered: shop.financingOffered || false,
        acceptedPayments: shop.acceptedPayments || [],
        yearsExperience: shop.yearsExperience || "",
        businessHours: shop.businessHours || {
          monday: { open: "", close: "", closed: false },
          tuesday: { open: "", close: "", closed: false },
          wednesday: { open: "", close: "", closed: false },
          thursday: { open: "", close: "", closed: false },
          friday: { open: "", close: "", closed: false },
          saturday: { open: "", close: "", closed: false },
          sunday: { open: "", close: "", closed: false },
        },

        rating: shop.rating || 0,
        reviewCount: shop.reviewCount || 0,
        isEmailVerified: shop.isEmailVerified,
        isVerified: shop.isVerified,
        verifiedAt: shop.verifiedAt?.toISOString?.() || null,
        acceptedPolicy: shop.acceptedPolicy,
        policyAcceptedAt: shop.policyAcceptedAt?.toISOString?.() || null,
        status: shop.status,
        isBlocked: shop.isBlocked,
        blockedAt: shop.blockedAt,
        blockedReason: shop.blockedReason,

        // Subscription fields
        subscriptionStatus: shop.subscriptionStatus,
        stripeCustomerId: shop.stripeCustomerId,
        stripeSubscriptionId: shop.stripeSubscriptionId,
        hasActiveSubscription: shop.hasActiveSubscription,
        isInTrial: shop.isInTrial,
        trialDaysRemaining: shop.trialDaysRemaining,

        // Additional fields if they exist
        additionalInfo: shop.additionalInfo || "",
      },
    });

  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error during signin",
    });
  }
};












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

    // Find shop by email
    const shop = await Shop.findOne({ email });

    if (shop.registrationMethod === "google") {
      return res.json({
        status: "not_Allowed",
        message: "This is logged in through Google not email"
      });
    }

    if (!shop) {
      return res.json({
        status: "not_found",
        message: "No account found with this email address"
      });
    }

    // Check if email is verified
    if (!shop.isEmailVerified) {
      return res.json({
        status: "not_verified",
        message: "Please verify your email first before resetting password"
      });
    }

    // Generate new OTP for password reset
    const otp = generateOtp();

    // Store OTP in shop document
    shop.resetPasswordOtp = otp;
    shop.resetPasswordOtpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    await shop.save();

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

    // Find shop
    const shop = await Shop.findOne({ email });

    if (!shop) {
      return res.status(404).json({
        status: "error",
        message: "shop not found"
      });
    }

    // Check if OTP exists
    if (!shop.resetPasswordOtp || !shop.resetPasswordOtpExpiry) {
      return res.json({
        status: "invalid_otp",
        message: "No reset code found. Please request a new one."
      });
    }

    // Verify OTP
    if (shop.resetPasswordOtp !== otp) {
      return res.json({
        status: "invalid_otp",
        message: "Invalid reset code. Please check and try again."
      });
    }

    // Check if OTP expired
    if (shop.resetPasswordOtpExpiry < Date.now()) {
      return res.json({
        status: "invalid_otp",
        message: "Reset code expired. Please request a new one."
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP fields
    shop.password = hashedPassword;
    shop.resetPasswordOtp = undefined;
    shop.resetPasswordOtpExpiry = undefined;
    await shop.save();

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






// ============================================
// CHANGE PASSWORD (Authenticated User)
// ============================================
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1️⃣ Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: "error",
        message: "Both current and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        status: "error",
        message: "New password must be at least 6 characters long",
      });
    }

    const shopId = req.shopId;

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        status: "error",
        message: "Shop not found",
      });
    }

    // 2️⃣ Blocked check
    if (shop.isBlocked === true || shop.status === "blocked") {
      return res.status(403).json({
        status: "blocked",
        message: "Your shop account has been blocked. Please contact support.",
      });
    }

    // 3️⃣ Verify current password
    const isMatch = await bcrypt.compare(currentPassword, shop.password);
    if (!isMatch) {
      return res.status(401).json({
        status: "invalid_password",
        message: "Current password is incorrect",
      });
    }

    // 4️⃣ Prevent password reuse
    const isSameAsOld = await bcrypt.compare(newPassword, shop.password);
    if (isSameAsOld) {
      return res.status(400).json({
        status: "error",
        message: "New password must be different from the current password",
      });
    }

    // 5️⃣ Hash & update
    shop.password = await bcrypt.hash(newPassword, 10);
    shop.passwordChangedAt = new Date(); // optional
    await shop.save();

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });

  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error during password change",
    });
  }
};







// ---------------------- SEND PASSWORD RESET EMAIL ----------------------
const sendPasswordResetEmail = async (email, otp) => {
  const msg = {
    to: email,
    from: process.env.SENDGRID_SENDER,
    subject: "Password Reset Code ",
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




















// // ---------------------- COMPLETE REGISTRATION ----------------------
// export const completeRegistration = async (req, res) => {
//   console.log(req.body);
//   try {

//     const {
//       businessName,
//       legalEntityName,
//       ownerName,
//       email,
//       countryCode,
//       zipCode,
//       latitude,
//       longitude,
//       phone,
//       ownerPhone,
//       website,
//       address,
//       country,
//       services,
//       vinylFilms,
//       certificates,
//       startDate,
//       insuranceCarrier,
//       policyNumber,
//       policyExpiration,
//       instagramLink,
//       facebookLink,
//       linkedinLink,
//       additionalInfo,
//       plan,
//       paymentData,

//       // New fields from frontend
//       financingOffered,
//       acceptedPayments,
//       yearsExperience,
//       businessHours,
//       websiteInput,
//       instagramInput,
//       facebookInput,
//       linkedinInput,
//       acceptPolicy,
//     } = req.body;

//     // Find shop by email
//     const shop = await Shop.findOne({ email });
//     if (!shop) {
//       return res.status(404).json({
//         status: "error",
//         message: "Shop not found",
//       });
//     }

//     // Require email verification before proceeding
//     if (!shop.isEmailVerified) {
//       return res.status(403).json({
//         status: "error",
//         message: "Email not verified",
//       });
//     }

//     // Handle uploaded files (if any)
//     const uploadedFiles = req.files || {};
//     const insuranceCertificate =
//       uploadedFiles.insuranceCertificate?.[0]?.path || shop.insuranceCertificate;
//     const storeFrontPhoto =
//       uploadedFiles.storeFrontPhoto?.[0]?.path || shop.storeFrontPhoto;
//     const workSpacePhoto =
//       uploadedFiles.workSpacePhoto?.[0]?.path || shop.workSpacePhoto;

//     // Multiple certificates (if any)
//     const certificateFiles = uploadedFiles.certificateFiles
//       ? uploadedFiles.certificateFiles.map((f) => f.path)
//       : shop.certificateFiles || [];

//     // Parse JSON fields safely
//     let parsedServices = [];
//     if (Array.isArray(services)) parsedServices = services;
//     else if (typeof services === "string") {
//       try {
//         parsedServices = JSON.parse(services);
//       } catch (e) {
//         parsedServices = [];
//       }
//     }

//     let parsedPayment = {};
//     if (typeof paymentData === "string") {
//       try {
//         parsedPayment = JSON.parse(paymentData);
//       } catch (e) {
//         parsedPayment = {};
//       }
//     } else if (typeof paymentData === "object" && paymentData !== null) {
//       parsedPayment = paymentData;
//     }

//     // Validate Stripe payment method ID
//     if (!parsedPayment.stripePaymentMethodId) {
//       return res.status(400).json({
//         status: "error",
//         message: "Payment method ID is required",
//       });
//     }

//     let parsedAcceptedPayments = [];
//     if (typeof acceptedPayments === "string") {
//       try {
//         parsedAcceptedPayments = JSON.parse(acceptedPayments);
//       } catch (e) {
//         parsedAcceptedPayments = [];
//       }
//     } else if (Array.isArray(acceptedPayments)) {
//       parsedAcceptedPayments = acceptedPayments;
//     }

//     let parsedBusinessHours = {};
//     if (typeof businessHours === "string") {
//       try {
//         parsedBusinessHours = JSON.parse(businessHours);
//       } catch (e) {
//         parsedBusinessHours = {};
//       }
//     } else if (typeof businessHours === "object" && businessHours !== null) {
//       parsedBusinessHours = businessHours;
//     }

//     // ✅ Parse financingOffered correctly (FormData sends it as string)
//     let parsedFinancingOffered = false;
//     if (financingOffered !== undefined) {
//       if (typeof financingOffered === 'string') {
//         parsedFinancingOffered = financingOffered.toLowerCase() === 'true';
//       } else if (typeof financingOffered === 'boolean') {
//         parsedFinancingOffered = financingOffered;
//       }
//     }

//     // Parse location coordinates
//     const parsedLatitude = latitude ? parseFloat(latitude) : null;
//     const parsedLongitude = longitude ? parseFloat(longitude) : null;

//     // Update shop fields
//     shop.businessName = businessName || shop.businessName;
//     shop.legalEntityName = legalEntityName || shop.legalEntityName;
//     shop.ownerName = ownerName || shop.ownerName;
//     shop.countryCode = countryCode || shop.countryCode;
//     shop.phone = phone || shop.phone;

//     // ✅ FIX: Capital 'O' to match model schema
//     shop.ownerPhone = ownerPhone || shop.ownerPhone;

//     // Use websiteInput if provided, otherwise use website
//     shop.website = websiteInput || website || shop.website;

//     shop.address = address || shop.address;
//     shop.zipCode = zipCode || shop.zipCode;
//     shop.country = country || shop.country;

//     // ✅ FIX: Use parsed financingOffered value
//     shop.financingOffered = parsedFinancingOffered;
//     shop.acceptedPayments = parsedAcceptedPayments.length ? parsedAcceptedPayments : shop.acceptedPayments || [];
//     shop.yearsExperience = yearsExperience || shop.yearsExperience;

//     // Business hours
//     if (Object.keys(parsedBusinessHours).length) {
//       shop.businessHours = parsedBusinessHours;
//     } else if (!shop.businessHours) {
//       // Set default empty business hours if none exist
//       shop.businessHours = {
//         monday: { open: "", close: "", closed: false },
//         tuesday: { open: "", close: "", closed: false },
//         wednesday: { open: "", close: "", closed: false },
//         thursday: { open: "", close: "", closed: false },
//         friday: { open: "", close: "", closed: false },
//         saturday: { open: "", close: "", closed: true }, // Default closed on weekends
//         sunday: { open: "", close: "", closed: true },
//       };
//     }

//     // Location coordinates
//     if (parsedLatitude !== null && parsedLongitude !== null) {
//       shop.location = {
//         type: "Point",
//         coordinates: [parsedLongitude, parsedLatitude], // [lng, lat]
//       };
//       shop.latitude = parsedLatitude;
//       shop.longitude = parsedLongitude;
//     }

//     shop.services = parsedServices.length ? parsedServices : shop.services;
//     shop.vinylFilms = vinylFilms || shop.vinylFilms;
//     shop.certificates = certificates || shop.certificates;
//     shop.startDate = startDate || shop.startDate;
//     shop.insuranceCarrier = insuranceCarrier || shop.insuranceCarrier;
//     shop.policyNumber = policyNumber || shop.policyNumber;
//     shop.policyExpiration = policyExpiration || shop.policyExpiration;
//     shop.insuranceCertificate = insuranceCertificate || shop.insuranceCertificate;

//     // Social media - use input fields if provided, otherwise use direct links
//     shop.socialMedia = {
//       instagram: instagramInput || instagramLink || shop.socialMedia?.instagram || "",
//       facebook: facebookInput || facebookLink || shop.socialMedia?.facebook || "",
//       linkedin: linkedinInput || linkedinLink || shop.socialMedia?.linkedin || "",
//     };

//     shop.additionalInfo = additionalInfo || shop.additionalInfo;
//     shop.storeFrontPhoto = storeFrontPhoto || shop.storeFrontPhoto;
//     shop.workSpacePhoto = workSpacePhoto || shop.workSpacePhoto;
//     shop.certificateFiles = certificateFiles.length ? certificateFiles : shop.certificateFiles || [];
//     shop.plan = plan || shop.plan;

//     // Save payment method info (for reference, not used for billing directly)
//     shop.paymentInfo = {
//       stripePaymentMethodId: parsedPayment.stripePaymentMethodId,
//       plan: parsedPayment.plan || plan,
//       stripePriceId: parsedPayment.stripePriceId,
//       lastUpdated: new Date()
//     };

//     shop.acceptedPolicy = acceptPolicy || shop.acceptedPolicy;
//     shop.policyAcceptedAt = new Date();

//     // Update shop status to pending verification
//     shop.status = "pending";
//     shop.isVerified = false;
//     shop.registrationExpiresAt = null;


//     // ✅ STRIPE INTEGRATION
//     // =======================
//     try {
//       const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

//       // 1️⃣ Create or retrieve Stripe customer
//       let stripeCustomerId = shop.stripeCustomerId;
//       if (!stripeCustomerId) {
//         const customer = await stripe.customers.create({
//           email: shop.email,
//           name: shop.businessName,
//           phone: shop.phone,
//           metadata: {
//             shopId: shop._id.toString(),
//             businessName: shop.businessName
//           }
//         });
//         stripeCustomerId = customer.id;
//         shop.stripeCustomerId = stripeCustomerId;
//       }

//       // 2️⃣ Attach payment method
//       await stripe.paymentMethods.attach(parsedPayment.stripePaymentMethodId, {
//         customer: stripeCustomerId,
//       });

//       // 3️⃣ Set default payment method
//       await stripe.customers.update(stripeCustomerId, {
//         invoice_settings: {
//           default_payment_method: parsedPayment.stripePaymentMethodId,
//         },
//       });

//       // 4️⃣ Determine price ID
//       const planDetails = Shop.getPlanDetails(plan || "basic");
//       const stripePriceId = parsedPayment.stripePriceId || planDetails?.stripePriceId;
//       if (!stripePriceId) throw new Error(`No Stripe price ID found for plan: ${plan}`);

//       // 5️⃣ Create subscription with guaranteed 30-day trial, no immediate charge
//       const now = Math.floor(Date.now() / 1000);
//       const trialDays = 30;
//       const subscription = await stripe.subscriptions.create({
//         customer: stripeCustomerId,
//         items: [{ price: stripePriceId }],
//         trial_end: now + trialDays * 24 * 60 * 60, // 30-day trial
//         payment_behavior: "default_incomplete",    // prevents immediate charge
//         expand: ["latest_invoice.payment_intent"],
//         metadata: {
//           shopId: shop._id.toString(),
//           plan: plan
//         }
//       });

//       // 6️⃣ Update shop with subscription info
//       shop.stripeSubscriptionId = subscription.id;
//       shop.subscriptionStatus = subscription.status; // usually "trialing"

//       const price = subscription.items.data[0]?.price;
//       const safeStripeDate = (timestamp) => timestamp ? new Date(timestamp * 1000) : null;

//       shop.currentSubscription = {
//         priceId: price?.id || null,
//         productId: price?.product || null,
//         planName: plan || "basic",
//         amount: price?.unit_amount || 0,
//         currency: price?.currency || "usd",
//         interval: price?.recurring?.interval || "month",

//         currentPeriodStart: safeStripeDate(subscription.current_period_start),
//         currentPeriodEnd: safeStripeDate(subscription.current_period_end),
//         trialStart: safeStripeDate(subscription.trial_start),
//         trialEnd: safeStripeDate(subscription.trial_end),

//         trialDays: trialDays,
//         cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
//         trialExtended: false,
//         trialExtensions: [],
//         daysRemaining: trialDays,
//         isTrial: true
//       };

//       console.log(`✅ Stripe subscription created: ${subscription.id} for shop: ${shop._id}`);

//     } catch (stripeError) {
//       console.error("❌ Stripe integration error:", stripeError);

//       // Keep registration going even if Stripe fails
//       shop.stripeCustomerId = shop.stripeCustomerId || null;
//       shop.stripeSubscriptionId = null;
//       shop.subscriptionStatus = "inactive";
//       shop.currentSubscription = null;
//     }


//     // Save the shop with all updates
//     await shop.save();

//     // IMPORTANT: This endpoint intentionally does NOT return a JWT or shop data.
//     // It only acknowledges submission and instructs the user to wait for verification.
//     return res.status(202).json({
//       status: "pending_verification",
//       message:
//         "Your registration has been submitted successfully. Verification will take up to 48 hours. You will be notified when verification is complete.",
//       stripeInfo: {
//         hasSubscription: !!shop.stripeSubscriptionId,
//         trialEnd: shop.currentSubscription?.trialEnd,
//         trialDaysRemaining: shop.trialDaysRemaining
//       }
//     });
//   } catch (error) {
//     console.error("Registration error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: "Failed to complete registration",
//       error: error.message,
//     });
//   }
// };








// ---------------------- COMPLETE REGISTRATION ----------------------
export const completeRegistration = async (req, res) => {
  console.log(req.body);

  try {
    const {
      businessName,
      legalEntityName,
      ownerName,
      email,
      countryCode,
      zipCode,
      latitude,
      longitude,
      phone,
      ownerPhone,
      website,
      address,
      country,
      services,
      vinylFilms,
      certificates,
      startDate,
      insuranceCarrier,
      policyNumber,
      policyExpiration,
      instagramLink,
      facebookLink,
      linkedinLink,
      additionalInfo,
      plan,
      paymentData,

      financingOffered,
      acceptedPayments,
      yearsExperience,
      businessHours,
      websiteInput,
      instagramInput,
      facebookInput,
      linkedinInput,
      acceptPolicy,
    } = req.body;

    // 1️⃣ Find shop
    const shop = await Shop.findOne({ email });
    if (!shop) {
      return res.status(404).json({ status: "error", message: "Shop not found" });
    }

    if (!shop.isEmailVerified) {
      return res.status(403).json({ status: "error", message: "Email not verified" });
    }

    // 2️⃣ Files
    const uploadedFiles = req.files || {};
    const insuranceCertificate =
      uploadedFiles.insuranceCertificate?.[0]?.path || shop.insuranceCertificate;
    const storeFrontPhoto =
      uploadedFiles.storeFrontPhoto?.[0]?.path || shop.storeFrontPhoto;
    const workSpacePhoto =
      uploadedFiles.workSpacePhoto?.[0]?.path || shop.workSpacePhoto;

    const certificateFiles = uploadedFiles.certificateFiles
      ? uploadedFiles.certificateFiles.map(f => f.path)
      : shop.certificateFiles || [];

    // 3️⃣ Parse JSON fields
    const safeParse = (val, fallback) => {
      try {
        return typeof val === "string" ? JSON.parse(val) : val ?? fallback;
      } catch {
        return fallback;
      }
    };

    const parsedServices = safeParse(services, []);
    const parsedAcceptedPayments = safeParse(acceptedPayments, []);
    const parsedBusinessHours = safeParse(businessHours, {});
    const parsedPayment = safeParse(paymentData, {});

    if (!parsedPayment.stripePaymentMethodId) {
      return res.status(400).json({
        status: "error",
        message: "Payment method ID is required",
      });
    }

    const parsedFinancingOffered =
      typeof financingOffered === "string"
        ? financingOffered.toLowerCase() === "true"
        : !!financingOffered;

    // 4️⃣ Update shop fields
    shop.businessName = businessName || shop.businessName;
    shop.legalEntityName = legalEntityName || shop.legalEntityName;
    shop.ownerName = ownerName || shop.ownerName;
    shop.countryCode = countryCode || shop.countryCode;
    shop.phone = phone || shop.phone;
    shop.ownerPhone = ownerPhone || shop.ownerPhone;
    shop.website = websiteInput || website || shop.website;
    shop.address = address || shop.address;
    shop.zipCode = zipCode || shop.zipCode;
    shop.country = country || shop.country;

    shop.financingOffered = parsedFinancingOffered;
    shop.acceptedPayments = parsedAcceptedPayments.length
      ? parsedAcceptedPayments
      : shop.acceptedPayments;

    shop.yearsExperience = yearsExperience || shop.yearsExperience;

    if (Object.keys(parsedBusinessHours).length) {
      shop.businessHours = parsedBusinessHours;
    }

    if (latitude && longitude) {
      shop.location = {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      };
      shop.latitude = parseFloat(latitude);
      shop.longitude = parseFloat(longitude);
    }

    shop.services = parsedServices.length ? parsedServices : shop.services;
    shop.vinylFilms = vinylFilms || shop.vinylFilms;
    shop.certificates = certificates || shop.certificates;
    shop.startDate = startDate || shop.startDate;
    shop.insuranceCarrier = insuranceCarrier || shop.insuranceCarrier;
    shop.policyNumber = policyNumber || shop.policyNumber;
    shop.policyExpiration = policyExpiration || shop.policyExpiration;
    shop.insuranceCertificate = insuranceCertificate;

    shop.socialMedia = {
      instagram: instagramInput || instagramLink || shop.socialMedia?.instagram || "",
      facebook: facebookInput || facebookLink || shop.socialMedia?.facebook || "",
      linkedin: linkedinInput || linkedinLink || shop.socialMedia?.linkedin || "",
    };

    shop.additionalInfo = additionalInfo || shop.additionalInfo;
    shop.storeFrontPhoto = storeFrontPhoto;
    shop.workSpacePhoto = workSpacePhoto;
    shop.certificateFiles = certificateFiles;
    shop.plan = plan || shop.plan;

    shop.paymentInfo = {
      stripePaymentMethodId: parsedPayment.stripePaymentMethodId,
      plan: plan,
      stripePriceId: parsedPayment.stripePriceId,
      lastUpdated: new Date(),
    };

    shop.acceptedPolicy = acceptPolicy || shop.acceptedPolicy;
    shop.policyAcceptedAt = new Date();
    shop.status = "pending";
    shop.isVerified = false;
    shop.registrationExpiresAt = null;

    // =========================
    // 💳 STRIPE INTEGRATION
    // =========================
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      // Trial duration from ENV (minutes)
      const trialMinutes = parseInt(process.env.STRIPE_TEST_TRIAL_MINUTES || "60", 10);
      const trialSeconds = trialMinutes * 60;
      const now = Math.floor(Date.now() / 1000);

      // Customer
      if (!shop.stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: shop.email,
          name: shop.businessName,
          phone: shop.phone,
          metadata: { shopId: shop._id.toString() },
        });
        shop.stripeCustomerId = customer.id;
      }

      // Attach payment method
      await stripe.paymentMethods.attach(parsedPayment.stripePaymentMethodId, {
        customer: shop.stripeCustomerId,
      });

      await stripe.customers.update(shop.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: parsedPayment.stripePaymentMethodId,
        },
      });

      const planDetails = Shop.getPlanDetails(plan || "basic");
      const stripePriceId = parsedPayment.stripePriceId || planDetails?.stripePriceId;
      if (!stripePriceId) throw new Error("Stripe price ID missing");

      const subscription = await stripe.subscriptions.create({
        customer: shop.stripeCustomerId,
        items: [{ price: stripePriceId }],
        trial_end: now + trialSeconds,
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          shopId: shop._id.toString(),
          plan: plan || "basic",
        },
      });

      const toDate = (ts) => (ts ? new Date(ts * 1000) : null);
      const trialEndDate = toDate(subscription.trial_end);

      shop.stripeSubscriptionId = subscription.id;
      shop.subscriptionStatus = subscription.status;

      shop.currentSubscription = {
        priceId: subscription.items.data[0]?.price?.id || null,
        productId: subscription.items.data[0]?.price?.product || null,
        planName: plan || "basic",
        amount: subscription.items.data[0]?.price?.unit_amount || 0,
        currency: subscription.items.data[0]?.price?.currency || "usd",
        interval: subscription.items.data[0]?.price?.recurring?.interval || "month",

        currentPeriodStart: toDate(subscription.current_period_start),
        currentPeriodEnd: toDate(subscription.current_period_end),
        trialStart: toDate(subscription.trial_start),
        trialEnd: trialEndDate,

        trialMinutes,
        isTrial: true,
        cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
        daysRemaining: Math.max(
          0,
          Math.ceil((trialEndDate - new Date()) / (1000 * 60 * 60 * 24))
        ),
      };

      console.log("✅ Stripe subscription created:", subscription.id);
    } catch (stripeError) {
      console.error("❌ Stripe error:", stripeError);
      shop.subscriptionStatus = "inactive";
      shop.currentSubscription = null;
    }

    await shop.save();

    return res.status(202).json({
      status: "pending_verification",
      message:
        "Registration submitted. Verification will take up to 48 hours.",
      stripeInfo: {
        hasSubscription: !!shop.stripeSubscriptionId,
        trialEnd: shop.currentSubscription?.trialEnd,
        trialMinutes: shop.currentSubscription?.trialMinutes,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to complete registration",
      error: error.message,
    });
  }
};






















export const updateShopProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await Shop.findById(id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const files = req.files || {};

    // Normalize file uploads
    const profilePic = files.profilePic?.[0]?.path || shop.profilePic;
    const storeFrontPhoto = files.storeFrontPhoto?.[0]?.path || shop.storeFrontPhoto;
    const workSpacePhoto = files.workSpacePhoto?.[0]?.path || shop.workSpacePhoto;
    const insuranceCertificate =
      files.insuranceCertificate?.[0]?.path || shop.insuranceCertificate;
    const certificateFiles = files.certificateFiles
      ? files.certificateFiles.map((f) => f.path)
      : shop.certificateFiles || [];

    // Parse JSON fields safely
    let parsedServices = [];
    if (Array.isArray(req.body.services)) {
      parsedServices = req.body.services;
    } else if (typeof req.body.services === "string") {
      try {
        parsedServices = JSON.parse(req.body.services);
      } catch {
        parsedServices = [];
      }
    }

    // Parse businessHours
    let parsedBusinessHours = {};
    if (req.body.businessHours) {
      if (typeof req.body.businessHours === "string") {
        try {
          parsedBusinessHours = JSON.parse(req.body.businessHours);
        } catch {
          parsedBusinessHours = {};
        }
      } else if (typeof req.body.businessHours === "object") {
        parsedBusinessHours = req.body.businessHours;
      }
    }

    // Parse acceptedPayments
    let parsedAcceptedPayments = [];
    if (req.body.acceptedPayments) {
      if (Array.isArray(req.body.acceptedPayments)) {
        parsedAcceptedPayments = req.body.acceptedPayments;
      } else if (typeof req.body.acceptedPayments === "string") {
        try {
          parsedAcceptedPayments = JSON.parse(req.body.acceptedPayments);
        } catch {
          parsedAcceptedPayments = [];
        }
      }
    }

    // Parse financingOffered
    let financingOffered = shop.financingOffered;
    if (req.body.financingOffered !== undefined) {
      if (typeof req.body.financingOffered === "boolean") {
        financingOffered = req.body.financingOffered;
      } else if (typeof req.body.financingOffered === "string") {
        financingOffered = req.body.financingOffered.toLowerCase() === "true";
      }
    }

    // ✅ FIX: Handle social media links correctly (from flat fields to nested object)
    const socialMedia = {
      instagram: req.body.instagramLink || shop.socialMedia?.instagram || "",
      facebook: req.body.facebookLink || shop.socialMedia?.facebook || "",
      linkedin: req.body.linkedinLink || shop.socialMedia?.linkedin || "",
    };

    // Merge all updates
    const updatedData = {
      ...req.body,
      services: parsedServices,
      businessHours: parsedBusinessHours,
      acceptedPayments: parsedAcceptedPayments,
      financingOffered: financingOffered,
      // ✅ ADD: Proper social media structure
      socialMedia: socialMedia,
      profilePic,
      storeFrontPhoto,
      workSpacePhoto,
      insuranceCertificate,
      certificateFiles,
    };

    // ✅ Remove flat social media fields to avoid conflicts
    delete updatedData.instagramLink;
    delete updatedData.facebookLink;
    delete updatedData.linkedinLink;

    const updatedShop = await Shop.findByIdAndUpdate(id, { $set: updatedData }, { new: true });

    res.status(200).json({
      message: "Shop profile updated successfully",
      shop: {
        ...updatedShop._doc,
        // Add flat social media fields for frontend compatibility
        instagramLink: updatedShop.socialMedia?.instagram || "",
        facebookLink: updatedShop.socialMedia?.facebook || "",
        linkedinLink: updatedShop.socialMedia?.linkedin || "",
      },
    });
  } catch (error) {
    console.error("🔥 Update shop profile error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};







const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI_SHOP
);



// -------------------- STEP 1: SEND GOOGLE LOGIN URL --------------------
export const getGoogleAuthURLShop = async (req, res) => {
  try {
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "profile",
        "email"
      ]
    });

    res.json({ url });
  } catch (error) {
    console.error("Google URL error:", error);
    res.status(500).json({ message: "Error generating Google URL" });
  }
};









// ============================================
// GOOGLE CALLBACK - COMPLETE & FIXED
// ============================================
export const googleCallbackPartner = async (req, res) => {
  try {
    const code = req.query.code;
    const { tokens } = await client.getToken(code);

    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const googleUser = ticket.getPayload();
    const email = googleUser.email;

    const EXPIRY_TIME = 2 * 60 * 60 * 1000; // 2 hours

    // =====================================
    // BLOCK CUSTOMER EMAILS
    // =====================================
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.redirect(
        `https://bidawrap.com/google-status?status=customer_exists&message=${encodeURIComponent(
          "This email is already registered as a customer. Please use a different email."
        )}`
      );
    }

    // =====================================
    // FIND SHOP
    // =====================================
    let user = await Shop.findOne({ email });

    // =====================================
    // DELETE EXPIRED INCOMPLETE ACCOUNTS
    // =====================================
    if (
      user &&
      !user.isVerified &&
      user.registrationExpiresAt &&
      new Date() > user.registrationExpiresAt
    ) {
      await Shop.deleteOne({ _id: user._id });
      user = null;
    }

    // =====================================
    // CREATE NEW SHOP (GOOGLE SIGNUP)
    // =====================================
    if (!user) {
      const newShop = new Shop({
        email,
        registrationMethod: "google",
        googleId: googleUser.sub,

        createdAt: new Date(),
        registrationExpiresAt: new Date(Date.now() + EXPIRY_TIME),

        phone: "000000000",
        businessName: "Business Name (Pending)",
        legalEntityName: "Legal Entity (Pending)",
        ownerName: "Owner Name (Pending)",
        address: "Business Address (Pending)",
        country: "US (Pending)",
        startDate: new Date(),

        insuranceCarrier: "Insurance Carrier (Pending)",
        policyNumber: "Policy Number (Pending)",
        policyExpiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),

        insuranceCertificate: "Pending",
        storeFrontPhoto: "Pending",
        workSpacePhoto: "Pending",
        certificateFiles: [],

        zipCode: "00000",
        plan: "basic",

        // Subscription defaults
        subscriptionStatus: "inactive",
        stripeCustomerId: null,
        stripeSubscriptionId: null,

        financingOffered: false,
        acceptedPayments: [],
        yearsExperience: "",
        businessHours: {
          monday: { open: "", close: "", closed: false },
          tuesday: { open: "", close: "", closed: false },
          wednesday: { open: "", close: "", closed: false },
          thursday: { open: "", close: "", closed: false },
          friday: { open: "", close: "", closed: false },
          saturday: { open: "", close: "", closed: false },
          sunday: { open: "", close: "", closed: false },
        },

        isEmailVerified: true,
        isVerified: false,
      });

      await newShop.save();

      return res.redirect(
        `https://bidawrap.com/google-success-partner?email=${encodeURIComponent(
          email
        )}&flow=signup`
      );
    }

    // =====================================
    // UPDATE REG METHOD IF NEEDED
    // =====================================
    if (user.registrationMethod !== "google") {
      user.registrationMethod = "google";
      user.password = "";
      user.googleId = googleUser.sub;
      await user.save();
    }

    // =====================================
    // INCOMPLETE PROFILE → REDIRECT
    // =====================================
    const isIncomplete =
      user.businessName.includes("(Pending)") ||
      user.legalEntityName.includes("(Pending)") ||
      user.ownerName.includes("(Pending)") ||
      user.address.includes("(Pending)");

    if (isIncomplete) {
      return res.redirect(
        `https://bidawrap.com/google-success-partner?email=${encodeURIComponent(
          email
        )}&flow=signup`
      );
    }

    // =====================================
    // VERIFY EMAIL (GOOGLE = TRUSTED)
    // =====================================
    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      await user.save();
    }

    // =====================================
    // ADMIN VERIFICATION CHECK
    // =====================================
    if (!user.isVerified) {
      return res.redirect(
        `https://bidawrap.com/google-status?status=not_approved`
      );
    }

    // =====================================
    // BLOCKED CHECK
    // =====================================
    if (user.isBlocked || user.status === "blocked") {
      return res.redirect(
        `https://bidawrap.com/google-status?status=blocked`
      );
    }

    // =====================================
    // STATUS CHECK
    // =====================================
    if (user.status !== "active") {
      return res.redirect(
        `https://bidawrap.com/google-status?status=inactive&shopStatus=${user.status}`
      );
    }

    // =====================================
    // SUBSCRIPTION CHECK (Matching regular signin logic)
    // =====================================
    const subscriptionStatus = user.subscriptionStatus;
    const isInTrial = user.isInTrial;
    const hasActiveSubscription = user.hasActiveSubscription;
    const trialDaysRemaining = user.trialDaysRemaining || 0;
    const trialInfo = user.trialInfo || {};

    // Define subscription access rules
    let shouldBlockAccess = false;
    let subscriptionMessage = "";
    let requiresPlanSelection = false;

    // Check subscription scenarios
    if (subscriptionStatus === "inactive" || subscriptionStatus === "incomplete") {
      // New shop - needs to select a plan
      requiresPlanSelection = true;
      subscriptionMessage = "Please select a subscription plan to continue";
    } else if (subscriptionStatus === "trialing") {
      // In trial period
      if (trialDaysRemaining <= 0) {
        shouldBlockAccess = true;
        subscriptionMessage = "Your trial has ended. Please select a plan to continue";
      } else {
        subscriptionMessage = `You have ${trialDaysRemaining} days left in your trial`;
      }
    } else if (subscriptionStatus === "past_due" || subscriptionStatus === "unpaid") {
      // Payment failed
      shouldBlockAccess = true;
      subscriptionMessage = "Your payment is past due. Please update your payment method";
    } else if (subscriptionStatus === "cancelled" || subscriptionStatus === "incomplete_expired") {
      // Subscription cancelled or expired
      shouldBlockAccess = true;
      subscriptionMessage = "Your subscription has been cancelled. Please select a new plan";
    } else if (subscriptionStatus === "paused") {
      // Subscription paused
      shouldBlockAccess = true;
      subscriptionMessage = "Your subscription is paused. Please contact support";
    }

    // Block access if subscription check fails
    if (shouldBlockAccess) {
      return res.redirect(
        `https://bidawrap.com/google-status?status=subscription_required&message=${encodeURIComponent(
          subscriptionMessage
        )}&requiresPlanSelection=true`
      );
    }

    // =====================================
    // JWT TOKEN
    // =====================================
    const token = jwt.sign(
      {
        shopId: user._id,
        email: user.email,
        role: "shop",
        status: user.status,
        isBlocked: user.isBlocked,
        registrationMethod: user.registrationMethod,
        subscriptionStatus: user.subscriptionStatus,
        hasActiveSubscription: user.hasActiveSubscription
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // =====================================
    // RESPONSE DATA (with subscription info like regular signin)
    // =====================================
    const shopData = {
      id: user._id,
      email: user.email,
      businessName: user.businessName,
      ownerName: user.ownerName,
      plan: user.plan,
      avatar: user.profilePic || "",

      countryCode: user.countryCode,
      phone: user.phone,
      ownerPhone: user.ownerPhone,
      website: user.website,
      country: user.country,
      zipCode: user.zipCode,
      latitude: user.latitude,
      longitude: user.longitude,
      address: user.address,

      services: user.services,
      vinylFilms: user.vinylFilms,
      certificates: user.certificates,
      certificateFiles: user.certificateFiles,

      startDate: user.startDate,
      bio: user.additionalInfo,

      workSpacePhoto: user.workSpacePhoto,
      storeFrontPhoto: user.storeFrontPhoto,

      legalEntityName: user.legalEntityName,
      insuranceCarrier: user.insuranceCarrier,
      policyNumber: user.policyNumber,
      policyExpiration: user.policyExpiration,
      insuranceCertificate: user.insuranceCertificate,

      instagramLink: user.socialMedia?.instagram || "",
      facebookLink: user.socialMedia?.facebook || "",
      linkedinLink: user.socialMedia?.linkedin || "",

      financingOffered: user.financingOffered,
      acceptedPayments: user.acceptedPayments,
      yearsExperience: user.yearsExperience,
      businessHours: user.businessHours,

      paymentInfo: user.paymentInfo,
      rating: user.rating,
      reviewCount: user.reviewCount,

      isEmailVerified: user.isEmailVerified,
      isVerified: user.isVerified,
      status: user.status,
      isBlocked: user.isBlocked,

      acceptedPolicy: user.acceptedPolicy,
      policyAcceptedAt: user.policyAcceptedAt,

      // Subscription fields (added like regular signin)
      subscriptionStatus: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      hasActiveSubscription: user.hasActiveSubscription,
      isInTrial: user.isInTrial,
      trialDaysRemaining: user.trialDaysRemaining,

      // Current subscription details
      currentSubscription: user.currentSubscription ? {
        planName: user.currentSubscription.planName,
        amount: user.currentSubscription.amount,
        currency: user.currentSubscription.currency,
        interval: user.currentSubscription.interval,
        currentPeriodStart: user.currentSubscription.currentPeriodStart,
        currentPeriodEnd: user.currentSubscription.currentPeriodEnd,
        trialStart: user.currentSubscription.trialStart,
        trialEnd: user.currentSubscription.trialEnd,
        trialDays: user.currentSubscription.trialDays,
        cancelAtPeriodEnd: user.currentSubscription.cancelAtPeriodEnd,
        trialExtended: user.currentSubscription.trialExtended,
        stripeSubscriptionId: user.stripeSubscriptionId
      } : null,

      // Plan information
      planDisplay: user.planDisplay,
      planPrice: user.planPrice,
      stripePriceId: user.stripePriceId,

      // Trial info
      trialInfo: trialInfo,
    };

    // Prepare subscription data object (like regular signin)
    const subscriptionData = {
      status: subscriptionStatus,
      isInTrial: isInTrial,
      hasActiveSubscription: hasActiveSubscription,
      trialDaysRemaining: trialDaysRemaining,
      trialInfo: trialInfo,
      requiresPlanSelection: requiresPlanSelection,

      // Current subscription details
      currentSubscription: user.currentSubscription ? {
        planName: user.currentSubscription.planName,
        amount: user.currentSubscription.amount,
        currency: user.currentSubscription.currency,
        interval: user.currentSubscription.interval,
        currentPeriodStart: user.currentSubscription.currentPeriodStart,
        currentPeriodEnd: user.currentSubscription.currentPeriodEnd,
        trialStart: user.currentSubscription.trialStart,
        trialEnd: user.currentSubscription.trialEnd,
        trialDays: user.currentSubscription.trialDays,
        cancelAtPeriodEnd: user.currentSubscription.cancelAtPeriodEnd,
        trialExtended: user.currentSubscription.trialExtended,
        stripeSubscriptionId: user.stripeSubscriptionId
      } : null,

      // Plan information
      plan: user.plan,
      planDisplay: user.planDisplay,
      planPrice: user.planPrice,
      stripePriceId: user.stripePriceId
    };

    return res.redirect(
      `https://bidawrap.com/google-success-partner?flow=signin&token=${token}&shopData=${encodeURIComponent(
        JSON.stringify(shopData)
      )}&subscriptionData=${encodeURIComponent(
        JSON.stringify(subscriptionData)
      )}&requiresPlanSelection=${requiresPlanSelection}`
    );
  } catch (error) {
    console.error("Google callback error:", error);
    return res.redirect(`https://bidawrap.com/google-failed`);
  }
};















export const submitVerificationRequest = async (req, res) => {
  try {
    const shopId = req.shop._id; // From authenticateShop middleware

    const {
      legalEntityName,
      address,
      country,
      zipCode,
      latitude,
      longitude,
      insuranceCarrier,
      policyNumber,
      policyExpiration,
      certificates,
      shopNotes,
    } = req.body;

    // Get uploaded file URLs from Cloudinary
    const certificateFiles = req.files?.certificateFiles
      ? req.files.certificateFiles.map((file) => file.path)
      : [];

    const insuranceCertificate = req.files?.insuranceCertificate
      ? req.files.insuranceCertificate[0].path
      : undefined;

    // Validate: at least one field must be provided
    if (
      !legalEntityName &&
      !address &&
      !country &&
      !zipCode &&
      !latitude &&
      !longitude &&
      !insuranceCarrier &&
      !policyNumber &&
      !policyExpiration &&
      !certificates &&
      certificateFiles.length === 0 &&
      !insuranceCertificate
    ) {
      return res.status(400).json({
        status: "error",
        message: "At least one field must be updated",
      });
    }

    // Validate certificate names match file count
    if (certificateFiles.length > 0 && certificates) {
      const certNames = certificates.split(',').map(n => n.trim()).filter(Boolean);
      if (certNames.length !== certificateFiles.length) {
        return res.status(400).json({
          status: "error",
          message: `Certificate names count (${certNames.length}) must match uploaded files count (${certificateFiles.length})`,
        });
      }
    }

    // Validate latitude and longitude if provided
    if (latitude || longitude) {
      // Both should be provided together
      if (!latitude || !longitude) {
        return res.status(400).json({
          status: "error",
          message: "Both latitude and longitude must be provided together",
        });
      }

      // Validate latitude range (-90 to 90)
      const lat = parseFloat(latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({
          status: "error",
          message: "Latitude must be a number between -90 and 90",
        });
      }

      // Validate longitude range (-180 to 180)
      const lng = parseFloat(longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({
          status: "error",
          message: "Longitude must be a number between -180 and 180",
        });
      }
    }

    // Check if shop has a pending request - only block if status is "pending"
    const existingPendingRequest = await VerificationRequest.findOne({
      shopId,
      status: "pending",
    });

    if (existingPendingRequest) {
      return res.status(400).json({
        status: "error",
        message: "You already have a pending verification request. Please wait for admin review before submitting a new request.",
        data: {
          pendingRequestId: existingPendingRequest._id,
          submittedAt: existingPendingRequest.createdAt,
        },
      });
    }

    // Shop can submit a new request if:
    // 1. They have no previous requests, OR
    // 2. Their previous request was approved/rejected (not pending)

    // Create new verification request
    const verificationRequest = new VerificationRequest({
      shopId,
      legalEntityName: legalEntityName || undefined,
      address: address || undefined,
      country: country || undefined,
      zipCode: zipCode || undefined,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
      insuranceCarrier: insuranceCarrier || undefined,
      policyNumber: policyNumber || undefined,
      policyExpiration: policyExpiration ? new Date(policyExpiration) : undefined,
      certificates: certificates || undefined,
      certificateFiles: certificateFiles.length > 0 ? certificateFiles : undefined,
      insuranceCertificate: insuranceCertificate || undefined,
      shopNotes: shopNotes || undefined,
    });

    await verificationRequest.save();

    res.status(201).json({
      status: "success",
      message: "Verification request submitted successfully. Admin will review your changes.",
      data: {
        requestId: verificationRequest._id,
        status: verificationRequest.status,
        createdAt: verificationRequest.createdAt,
      },
    });
  } catch (error) {
    console.error("Submit verification request error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to submit verification request",
      error: error.message,
    });
  }
};




// ============================================
// SHOP: Get Own Verification Requests
// ============================================
export const getMyVerificationRequests = async (req, res) => {
  try {
    const shopId = req.shop._id;

    const requests = await VerificationRequest.find({ shopId })
      .sort({ createdAt: -1 })
      .select("-__v");

    res.json({
      status: "success",
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("Get verification requests error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch verification requests",
    });
  }
};