
import bcrypt from "bcryptjs";
import Shop from "../models/shopModel.js";
import ShopUser from "../models/shopUserModel.js";
import Customer from "../models/customerModel.js"
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import VerificationRequest from "../models/updateProfileModel.js";
import Plan from "../models/planModel.js";
import Stripe from 'stripe';
import mongoose from 'mongoose'


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

    // Create new shop with minimal required fields
    const newShop = new Shop({
      email,
      password: hashedPassword,
      registrationMethod: "email_password",

      // Required fields with placeholder values
      phone: "000000000",
      ownerPhone: "00000000",
      businessName: "Business Name (Pending)",
      legalEntityName: "Legal Entity (Pending)",
      ownerName: "Owner Name (Pending)",
      address: "Business Address (Pending)",
      country: "US",
      countryCode: "+1",
      zipCode: "00000",
      
      // Date fields
      startDate: new Date(),
      
      // Insurance fields (required)
      insuranceCarrier: "Insurance Carrier (Pending)",
      policyNumber: "Policy Number (Pending)",
      policyExpiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      insuranceCertificate: "Pending",
      
      // Photo fields (required)
      storeFrontPhoto: "Pending",
      workSpacePhoto: "Pending",
      
      // Optional fields
      certificateFiles: [],
      services: [],
      
      // Location defaults
      location: {
        type: "Point",
        coordinates: [0, 0],
      },
      latitude: null,
      longitude: null,
      
      // Subscription fields - all new shops start without a plan (will be selected during registration)
      plan: null, // Will be set during completeRegistration
      subscriptionStatus: "inactive", // Will become "trialing" after plan selection
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentSubscription: null,
      
      // Status fields
      status: "pending",
      isEmailVerified: false,
      isVerified: false,
      
      // OTP for email verification
      otp,
      otpExpiry: Date.now() + 10 * 60 * 1000, // 10 minutes
      
      // Policy acceptance
      acceptedPolicy: false,
    });

    await newShop.save();
    await sendOtpEmail(email, otp);

    console.log("✅ New shop registration initiated:", {
      email,
      shopId: newShop._id,
      otpSent: true,
    });

    return res.json({
      status: "otp_sent",
      message: "OTP sent to your email"
    });

  } catch (error) {
    console.error("❌ Signup error:", error);
    res.status(500).json({ 
      status: "error",
      message: "Server error during signup",
      error: error.message 
    });
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





















// ============================================
// UNIFIED SIGNIN: Shop Owner + Staff/Manager
// ============================================
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ============================
    // STEP 1: Try to find user in ShopUser (Staff/Manager) first
    // ============================
    const shopUser = await ShopUser.findOne({ email }).populate({
      path: 'shop',
      populate: {
        path: 'plan', // Populate the plan details
        model: 'Plan'
      }
    });
    
    if (shopUser) {
      // This is a staff/manager login
      return await handleStaffLogin(shopUser, password, req, res);
    }

    // ============================
    // STEP 2: If not found in ShopUser, try Shop (Owner)
    // ============================
    const shop = await Shop.findOne({ email }).populate('plan');
    
    if (shop) {
      // This is an owner login
      return await handleOwnerLogin(shop, password, req, res);
    }

    // ============================
    // STEP 3: User not found in either model
    // ============================
    return res.json({
      status: "invalid_credentials",
      message: "Invalid email or password",
    });

  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error during signin",
    });
  }
};

// ============================================
// HANDLE STAFF/MANAGER LOGIN
// ============================================
const handleStaffLogin = async (shopUser, password, req, res) => {
  try {
    // Verify password
    const isMatch = await shopUser.comparePassword(password);
    if (!isMatch) {
      return res.json({
        status: "invalid_credentials",
        message: "Invalid email or password",
      });
    }

    // Check if account is active
    if (!shopUser.isActive) {
      return res.json({
        status: "inactive",
        message: "Your account has been disabled. Please contact the shop owner.",
      });
    }

    // Check if parent shop exists and is active
    if (!shopUser.shop) {
      return res.json({
        status: "error",
        message: "Associated shop not found. Please contact support.",
      });
    }

    const parentShop = shopUser.shop;

    // Check if parent shop is blocked
    if (parentShop.isBlocked === true || parentShop.status === "blocked") {
      return res.json({
        status: "blocked",
        message: "The shop account has been blocked. Please contact the shop owner.",
      });
    }

    // Check if parent shop is verified
    if (!parentShop.isVerified) {
      return res.json({
        status: "not_approved",
        message: "The shop account is pending admin approval.",
      });
    }

    // Check if parent shop has active subscription (for staff access)
    // Using the new subscription system with virtuals
    if (!parentShop.hasActiveSubscription) {
      return res.json({
        status: "subscription_required",
        message: "The shop's subscription is inactive. Please contact the shop owner.",
      });
    }

    // Update last login
    shopUser.lastLogin = new Date();
    await shopUser.save();

    // Generate JWT token for staff/manager
    const token = jwt.sign(
      {
        userId: shopUser._id,
        shopId: parentShop._id,
        email: shopUser.email,
        role: shopUser.role, // "staff" or "manager"
        userType: "staff", // Identifier to distinguish from owner
        permissions: shopUser.permissions,
        isActive: shopUser.isActive,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // NEW: Check if plan allows sub-account creation
    const canCreateSubAccounts = parentShop.plan && 
                                 parentShop.plan.features && 
                                 parentShop.plan.features.subAccounts > 0;

    // Get plan display name and price from populated plan
    const planDisplay = parentShop.plan ? parentShop.plan.name : "";
    const planPrice = parentShop.plan ? parentShop.plan.price : 0;
    const stripePriceId = parentShop.plan ? parentShop.plan.stripePriceId : "";

    // Return staff/manager data (NO subscription details)
    res.json({
      status: "success",
      message: "Login successful",
      token,
      userType: "staff",
      user: {
        id: shopUser._id,
        email: shopUser.email,
        role: shopUser.role,
        permissions: shopUser.permissions,
        isActive: shopUser.isActive,
        lastLogin: shopUser.lastLogin,
        createdAt: shopUser.createdAt,
      },
      shop: {
        // Make sure this matches the owner structure exactly
        id: parentShop._id,
        email: parentShop.email,
        businessName: parentShop.businessName,
        ownerName: parentShop.ownerName,
        plan: parentShop.plan ? parentShop.plan._id.toString() : "", // Keep as string ID for compatibility
        planDisplay: planDisplay,
        planPrice: planPrice,
        stripePriceId: stripePriceId,
        avatar: parentShop.profilePic || "",

        // Contact - same fields as owner
        countryCode: parentShop.countryCode,
        phone: parentShop.phone,
        ownerPhone: parentShop.ownerPhone,
        website: parentShop.website,
        country: parentShop.country,
        zipCode: parentShop.zipCode,
        latitude: parentShop.latitude,
        longitude: parentShop.longitude,
        address: parentShop.address,

        // Services - same fields as owner
        services: parentShop.services,
        vinylFilms: parentShop.vinylFilms,
        certificates: parentShop.certificates,
        certificateFiles: parentShop.certificateFiles,
        startDate: parentShop.startDate?.toISOString?.() || parentShop.startDate,
        bio: parentShop.additionalInfo || "",

        // Photos - same fields as owner
        workSpacePhoto: parentShop.workSpacePhoto,
        storeFrontPhoto: parentShop.storeFrontPhoto,

        // Legal - same fields as owner
        legalEntityName: parentShop.legalEntityName,
        insuranceCarrier: parentShop.insuranceCarrier,
        policyNumber: parentShop.policyNumber,
        policyExpiration: parentShop.policyExpiration,
        insuranceCertificate: parentShop.insuranceCertificate,

        // Social media - same fields as owner
        instagramLink: parentShop.socialMedia?.instagram || "",
        facebookLink: parentShop.socialMedia?.facebook || "",
        linkedinLink: parentShop.socialMedia?.linkedin || "",

        // New fields from registration - same fields as owner
        financingOffered: parentShop.financingOffered || false,
        acceptedPayments: parentShop.acceptedPayments || [],
        yearsExperience: parentShop.yearsExperience || "",
        businessHours: parentShop.businessHours || {
          monday: { open: "", close: "", closed: false },
          tuesday: { open: "", close: "", closed: false },
          wednesday: { open: "", close: "", closed: false },
          thursday: { open: "", close: "", closed: false },
          friday: { open: "", close: "", closed: false },
          saturday: { open: "", close: "", closed: false },
          sunday: { open: "", close: "", closed: false },
        },

        // Ratings - same fields as owner
        rating: parentShop.rating || 0,
        reviewCount: parentShop.reviewCount || 0,
        
        // Verification - same fields as owner
        isEmailVerified: parentShop.isEmailVerified,
        isVerified: parentShop.isVerified,
        verifiedAt: parentShop.verifiedAt?.toISOString?.() || null,
        acceptedPolicy: parentShop.acceptedPolicy,
        policyAcceptedAt: parentShop.policyAcceptedAt?.toISOString?.() || null,
        status: parentShop.status,
        isBlocked: parentShop.isBlocked,
        blockedAt: parentShop.blockedAt,
        blockedReason: parentShop.blockedReason,

        // Subscription fields - same fields as owner (but with parent shop's data)
        subscriptionStatus: parentShop.subscriptionStatus,
        stripeCustomerId: parentShop.stripeCustomerId,
        stripeSubscriptionId: parentShop.stripeSubscriptionId,
        hasActiveSubscription: parentShop.hasActiveSubscription,
        isInTrial: parentShop.isInTrial,
        trialDaysRemaining: parentShop.trialDaysRemaining,

        // Current subscription details
        currentSubscription: parentShop.currentSubscription ? {
          planName: parentShop.plan?.name || "",
          amount: parentShop.plan?.price || 0,
          currency: parentShop.plan?.currency || "USD",
          interval: parentShop.plan?.interval || "month",
          currentPeriodStart: parentShop.currentSubscription.currentPeriodStart,
          currentPeriodEnd: parentShop.currentSubscription.currentPeriodEnd,
          trialStart: parentShop.currentSubscription.trialStart,
          trialEnd: parentShop.currentSubscription.trialEnd,
          cancelAtPeriodEnd: parentShop.currentSubscription.cancelAtPeriodEnd,
          stripeSubscriptionId: parentShop.stripeSubscriptionId
        } : null,

        // NEW: Sub-account permission flag
        canCreateSubAccounts: canCreateSubAccounts,

        // Additional fields if they exist
        additionalInfo: parentShop.additionalInfo || "",
      },
    });

  } catch (error) {
    console.error("Staff login error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error during staff login",
    });
  }
};

// ============================================
// HANDLE OWNER LOGIN (UPDATED FOR NEW MODEL)
// ============================================
const handleOwnerLogin = async (shop, password, req, res) => {
  try {
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

      await sendOtpEmail(shop.email, otp);

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
    // STEP 5: Check subscription status using new model structure
    // ============================
    const subscriptionStatus = shop.subscriptionStatus;
    const isInTrial = shop.isInTrial;
    const hasActiveSubscription = shop.hasActiveSubscription;
    const trialDaysRemaining = shop.trialDaysRemaining || 0;

    // Define subscription access rules
    let shouldBlockAccess = false;
    let subscriptionMessage = "";
    let requiresPlanSelection = false;

    // Check subscription scenarios
    if (subscriptionStatus === "inactive") {
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
    } else if (subscriptionStatus === "past_due") {
      // Payment failed
      shouldBlockAccess = true;
      subscriptionMessage = "Your payment is past due. Please update your payment method";
    } else if (subscriptionStatus === "canceled") {
      // Subscription cancelled or expired
      shouldBlockAccess = true;
      subscriptionMessage = "Your subscription has been cancelled. Please select a new plan";
    }

    // Block access if subscription check fails
    if (shouldBlockAccess) {
      return res.json({
        status: "subscription_required",
        message: subscriptionMessage,
        subscriptionStatus: subscriptionStatus,
        requiresPlanSelection: true,
        trialDaysRemaining: trialDaysRemaining
      });
    }

    // ============================
    // STEP 6: Everything OK → login
    // ============================
    const token = jwt.sign(
      {
        shopId: shop._id,
        email: shop.email,
        role: "owner",
        userType: "owner", // to distinguish from staff
        isBlocked: shop.isBlocked,
        status: shop.status,
        subscriptionStatus: shop.subscriptionStatus,
        hasActiveSubscription: shop.hasActiveSubscription
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Get plan details from populated plan
    const planDisplay = shop.plan ? shop.plan.name : "";
    const planPrice = shop.plan ? shop.plan.price : 0;
    const stripePriceId = shop.plan ? shop.plan.stripePriceId : "";

    // Check if plan allows sub-account creation
    const canCreateSubAccounts = shop.plan && 
                                 shop.plan.features && 
                                 shop.plan.features.subAccounts > 0;

    // Prepare subscription data for frontend
    const subscriptionData = {
      status: subscriptionStatus,
      isInTrial: isInTrial,
      hasActiveSubscription: hasActiveSubscription,
      trialDaysRemaining: trialDaysRemaining,
      requiresPlanSelection: requiresPlanSelection,

      // Current subscription details
      currentSubscription: shop.currentSubscription ? {
        planName: shop.plan?.name || "",
        amount: shop.plan?.price || 0,
        currency: shop.plan?.currency || "USD",
        interval: shop.plan?.interval || "month",
        currentPeriodStart: shop.currentSubscription.currentPeriodStart,
        currentPeriodEnd: shop.currentSubscription.currentPeriodEnd,
        trialStart: shop.currentSubscription.trialStart,
        trialEnd: shop.currentSubscription.trialEnd,
        cancelAtPeriodEnd: shop.currentSubscription.cancelAtPeriodEnd,
        stripeSubscriptionId: shop.stripeSubscriptionId
      } : null,

      // Plan information (compatible with existing frontend)
      plan: shop.plan ? shop.plan._id.toString() : "",
      planDisplay: planDisplay,
      planPrice: planPrice,
      stripePriceId: stripePriceId
    };

    // Return response with consistent structure
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
        plan: shop.plan ? shop.plan._id.toString() : "", // Keep as string ID for compatibility
        planDisplay: planDisplay,
        planPrice: planPrice,
        stripePriceId: stripePriceId,
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

        // Current subscription details
        currentSubscription: shop.currentSubscription ? {
          planName: shop.plan?.name || "",
          amount: shop.plan?.price || 0,
          currency: shop.plan?.currency || "USD",
          interval: shop.plan?.interval || "month",
          currentPeriodStart: shop.currentSubscription.currentPeriodStart,
          currentPeriodEnd: shop.currentSubscription.currentPeriodEnd,
          trialStart: shop.currentSubscription.trialStart,
          trialEnd: shop.currentSubscription.trialEnd,
          cancelAtPeriodEnd: shop.currentSubscription.cancelAtPeriodEnd,
          stripeSubscriptionId: shop.stripeSubscriptionId
        } : null,

        // NEW: Sub-account permission flag
        canCreateSubAccounts: canCreateSubAccounts,

        // Additional fields if they exist
        additionalInfo: shop.additionalInfo || "",
      },
    });

  } catch (error) {
    console.error("Owner login error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error during owner login",
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




















// ---------------------- COMPLETE REGISTRATION (CLEAN TRIAL FLOW) ----------------------
export const completeRegistration = async (req, res) => {

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
      plan, // Plan ObjectId
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

    console.log("📊 Current shop status:", {
      isVerified: shop.isVerified,
      status: shop.status
    });

    // 2️⃣ Validate plan
    if (!plan) {
      return res.status(400).json({
        status: "error",
        message: "Plan selection is required",
      });
    }

    const selectedPlan = await Plan.findOne({
      _id: plan,
      isActive: true,
      isDeleted: false,
    });

    if (!selectedPlan) {
      return res.status(404).json({
        status: "error",
        message: "Selected plan not found or inactive",
      });
    }


    // 3️⃣ Helpers
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

    // 4️⃣ Update shop info
    
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
    shop.services = parsedServices.length ? parsedServices : shop.services;

    shop.financingOffered =
      typeof financingOffered === "string"
        ? financingOffered === "true"
        : !!financingOffered;

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
        coordinates: [Number(longitude), Number(latitude)],
      };
      shop.latitude = Number(latitude);
      shop.longitude = Number(longitude);
    }

    shop.insuranceCarrier = insuranceCarrier || shop.insuranceCarrier;
    shop.policyNumber = policyNumber || shop.policyNumber;
    shop.policyExpiration = policyExpiration || shop.policyExpiration;

    shop.socialMedia = {
      instagram: instagramInput || instagramLink || "",
      facebook: facebookInput || facebookLink || "",
      linkedin: linkedinInput || linkedinLink || "",
    };

    shop.additionalInfo = additionalInfo || shop.additionalInfo;

    // ✅ ADD FILE UPLOAD HANDLING HERE
    if (req.files) {
      // Handle insurance certificate
      if (req.files.insuranceCertificate && req.files.insuranceCertificate[0]) {
        shop.insuranceCertificate = req.files.insuranceCertificate[0].path;
      } 
      // Handle store front photo
      if (req.files.storeFrontPhoto && req.files.storeFrontPhoto[0]) {
        shop.storeFrontPhoto = req.files.storeFrontPhoto[0].path;
      } 

      // Handle workspace photo
      if (req.files.workSpacePhoto && req.files.workSpacePhoto[0]) {
        shop.workSpacePhoto = req.files.workSpacePhoto[0].path;
      } 

      // Handle certificate files
      if (req.files.certificateFiles && req.files.certificateFiles.length > 0) {
        shop.certificateFiles = req.files.certificateFiles.map(file => file.path);
      } 
    } 
 
    // 5️⃣ Assign plan
    shop.plan = selectedPlan._id;

    // 6️⃣ Start TRIAL (NO STRIPE)
    const trialDays = selectedPlan.trialDays || 30;
    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + trialDays);

    shop.subscriptionStatus = "trialing";

    shop.currentSubscription = {
      plan: selectedPlan._id,
      trialStart,
      trialEnd,
      stripeProductId: selectedPlan.stripeProductId,
      stripePriceId: selectedPlan.stripePriceId,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };

    // 7️⃣ Initialize bid usage for TRIAL
    shop.bidUsage = {
      usedThisPeriod: 0,
      periodStart: trialStart,
      periodEnd: trialEnd,
    };

    
    shop.status = "pending";
    shop.isVerified = false;
    shop.acceptedPolicy = acceptPolicy ?? shop.acceptedPolicy;
    shop.policyAcceptedAt = new Date();
   
    // Save the shop
    await shop.save();
    
   

    const daysRemaining = Math.ceil(
      (trialEnd - new Date()) / (1000 * 60 * 60 * 24)
    );

    return res.status(200).json({
      status: "pending_verification",
      message: "Registration successful. Free trial started.",
      data: {
        shopId: shop._id,
        plan: {
          id: selectedPlan._id,
          name: selectedPlan.name,
          price: selectedPlan.price,
          currency: selectedPlan.currency,
        },
        subscription: {
          status: shop.subscriptionStatus,
          trialStart,
          trialEnd,
          daysRemaining,
        },
        verificationStatus: {
          isVerified: shop.isVerified,
          status: shop.status
        }
      },
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    console.error("❌ Error details:", {
      message: error.message,
      stack: error.stack
    });
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
// GOOGLE CALLBACK - UPDATED TO MATCH REGULAR LOGIN STRUCTURE
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
    // FIND SHOP (Owner only - no staff check needed)
    // =====================================
    let shop = await Shop.findOne({ email }).populate('plan');

    // =====================================
    // DELETE EXPIRED INCOMPLETE ACCOUNTS
    // =====================================
    if (
      shop &&
      !shop.isVerified &&
      shop.registrationExpiresAt &&
      new Date() > shop.registrationExpiresAt
    ) {
      await Shop.deleteOne({ _id: shop._id });
      shop = null;
    }

    // =====================================
    // CREATE NEW SHOP (GOOGLE SIGNUP)
    // =====================================
    if (!shop) {
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

        // Subscription defaults - consistent with regular signin
        subscriptionStatus: "inactive",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        hasActiveSubscription: false,
        isInTrial: false,
        trialDaysRemaining: 0,

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
        status: "pending",
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
    if (shop.registrationMethod !== "google") {
      shop.registrationMethod = "google";
      shop.password = "";
      shop.googleId = googleUser.sub;
      await shop.save();
    }

    // =====================================
    // INCOMPLETE PROFILE → REDIRECT
    // =====================================
    const isIncomplete =
      shop.businessName.includes("(Pending)") ||
      shop.legalEntityName.includes("(Pending)") ||
      shop.ownerName.includes("(Pending)") ||
      shop.address.includes("(Pending)");

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
    if (!shop.isEmailVerified) {
      shop.isEmailVerified = true;
      await shop.save();
    }

    // =====================================
    // ADMIN VERIFICATION CHECK
    // =====================================
    if (!shop.isVerified) {
      return res.redirect(
        `https://bidawrap.com/google-status?status=not_approved`
      );
    }

    // =====================================
    // BLOCKED CHECK
    // =====================================
    if (shop.isBlocked === true || shop.status === "blocked") {
      return res.redirect(
        `https://bidawrap.com/google-status?status=blocked&blockedAt=${shop.blockedAt}&blockedReason=${encodeURIComponent(
          shop.blockedReason || "Account suspended"
        )}`
      );
    }

    // =====================================
    // STATUS CHECK (match regular login check)
    // =====================================
    if (shop.status !== "active") {
      return res.redirect(
        `https://bidawrap.com/google-status?status=inactive&shopStatus=${shop.status}`
      );
    }

    // =====================================
    // SUBSCRIPTION CHECK (EXACTLY matching regular signin logic)
    // =====================================
    const subscriptionStatus = shop.subscriptionStatus;
    const isInTrial = shop.isInTrial;
    const hasActiveSubscription = shop.hasActiveSubscription;
    const trialDaysRemaining = shop.trialDaysRemaining || 0;

    // Define subscription access rules - EXACT same logic as handleOwnerLogin
    let shouldBlockAccess = false;
    let subscriptionMessage = "";
    let requiresPlanSelection = false;

    // Check subscription scenarios - EXACT same checks as handleOwnerLogin
    if (subscriptionStatus === "inactive") {
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
    } else if (subscriptionStatus === "past_due") {
      // Payment failed
      shouldBlockAccess = true;
      subscriptionMessage = "Your payment is past due. Please update your payment method";
    } else if (subscriptionStatus === "canceled") {
      // Subscription cancelled or expired
      shouldBlockAccess = true;
      subscriptionMessage = "Your subscription has been cancelled. Please select a new plan";
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
    // Get plan details from populated plan (same as regular login)
    // =====================================
    const planDisplay = shop.plan ? shop.plan.name : "";
    const planPrice = shop.plan ? shop.plan.price : 0;
    const stripePriceId = shop.plan ? shop.plan.stripePriceId : "";

    // Check if plan allows sub-account creation (same as regular login)
    const canCreateSubAccounts = shop.plan && 
                                 shop.plan.features && 
                                 shop.plan.features.subAccounts > 0;

    // =====================================
    // JWT TOKEN - EXACT same structure as handleOwnerLogin
    // =====================================
    const token = jwt.sign(
      {
        shopId: shop._id,
        email: shop.email,
        role: "owner",
        userType: "owner", // to distinguish from staff
        isBlocked: shop.isBlocked,
        status: shop.status,
        subscriptionStatus: shop.subscriptionStatus,
        hasActiveSubscription: shop.hasActiveSubscription
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // =====================================
    // RESPONSE DATA - EXACT same structure as handleOwnerLogin
    // =====================================
    const shopData = {
      id: shop._id,
      email: shop.email,
      businessName: shop.businessName,
      ownerName: shop.ownerName,
      plan: shop.plan ? shop.plan._id.toString() : "", // Keep as string ID for compatibility
      planDisplay: planDisplay,
      planPrice: planPrice,
      stripePriceId: stripePriceId,
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
      
      // Verification
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

      // Current subscription details (same structure as handleOwnerLogin)
      currentSubscription: shop.currentSubscription ? {
        planName: shop.plan?.name || "",
        amount: shop.plan?.price || 0,
        currency: shop.plan?.currency || "USD",
        interval: shop.plan?.interval || "month",
        currentPeriodStart: shop.currentSubscription.currentPeriodStart,
        currentPeriodEnd: shop.currentSubscription.currentPeriodEnd,
        trialStart: shop.currentSubscription.trialStart,
        trialEnd: shop.currentSubscription.trialEnd,
        cancelAtPeriodEnd: shop.currentSubscription.cancelAtPeriodEnd,
        stripeSubscriptionId: shop.stripeSubscriptionId
      } : null,

      // NEW: Sub-account permission flag (same as handleOwnerLogin)
      canCreateSubAccounts: canCreateSubAccounts,

      // Additional fields
      additionalInfo: shop.additionalInfo || "",
      
      // Google-specific fields (keep these separate from core structure)
      registrationMethod: shop.registrationMethod,
      googleId: shop.googleId,
    };

    // Prepare subscription data for frontend (same structure as handleOwnerLogin)
    const subscriptionData = {
      status: subscriptionStatus,
      isInTrial: isInTrial,
      hasActiveSubscription: hasActiveSubscription,
      trialDaysRemaining: trialDaysRemaining,
      requiresPlanSelection: requiresPlanSelection,

      // Current subscription details
      currentSubscription: shop.currentSubscription ? {
        planName: shop.plan?.name || "",
        amount: shop.plan?.price || 0,
        currency: shop.plan?.currency || "USD",
        interval: shop.plan?.interval || "month",
        currentPeriodStart: shop.currentSubscription.currentPeriodStart,
        currentPeriodEnd: shop.currentSubscription.currentPeriodEnd,
        trialStart: shop.currentSubscription.trialStart,
        trialEnd: shop.currentSubscription.trialEnd,
        cancelAtPeriodEnd: shop.currentSubscription.cancelAtPeriodEnd,
        stripeSubscriptionId: shop.stripeSubscriptionId
      } : null,

      // Plan information (compatible with existing frontend)
      plan: shop.plan ? shop.plan._id.toString() : "",
      planDisplay: planDisplay,
      planPrice: planPrice,
      stripePriceId: stripePriceId
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