
import bcrypt from "bcryptjs";
import Shop from "../models/shopModel.js";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import VerificationRequest from "../models/updateProfileModel.js";


dotenv.config();

// Helper: generate 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper: send OTP email
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
export const registerShop = async (req, res) => {
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    // Check if shop already exists
    const existing = await Shop.findOne({ email });

    if (existing) {
      if (existing.isEmailVerified) {
        return res.json({
          status: "exists",
          message: "Account already exists. Please sign in instead."
        });
      } else {
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();

    // ✅ FIX 1: Remove duplicate country field
    // ✅ FIX 2: Use consistent "US (Pending)" format
    const newShop = new Shop({
      email,
      password: hashedPassword,
      phone: "000000000",
      businessName: "Business Name (Pending)",
      legalEntityName: "Legal Entity (Pending)",
      ownerName: "Owner Name (Pending)",
      address: "Business Address (Pending)",
      country: "US (Pending)", // ✅ FIXED: Consistent format, no duplicate
      startDate: new Date(),
      insuranceCarrier: "Insurance Carrier (Pending)",
      policyNumber: "Policy Number (Pending)",
      policyExpiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      insuranceCertificate: "Pending",
      storeFrontPhoto: "Pending",
      workSpacePhoto: "Pending",
      certificateFiles: [],
      zipCode: "00000", // ✅ FIXED: Include zipCode for consistency
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

//     const isMatch = await bcrypt.compare(password, shop.password);
//     if (!isMatch)
//       return res.json({
//         status: "invalid_credentials",
//         message: "Invalid email or password",
//       });

//     // ============================
//     // STEP 1: Email must be verified
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
//     // STEP 2: Admin approval required
//     // ============================
//     if (!shop.isVerified) {
//       return res.json({
//         status: "not_approved",
//         message: "Your shop account is pending admin approval.",
//       });
//     }

//     // ============================
//     // STEP 3: Everything OK → login
//     // ============================
//     const token = jwt.sign(
//       { shopId: shop._id, email: shop.email, role: "shop" },
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
//         website: shop.website,
//         country: shop.country,
//         zipCode: shop.zipCode,
//         latitude: shop.latitude,
//         longitude: shop.longitude,

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
//         address: shop.address,
//         insuranceCarrier: shop.insuranceCarrier,
//         policyNumber: shop.policyNumber,
//         policyExpiration: shop.policyExpiration,
//         insuranceCertificate: shop.insuranceCertificate,

//         // Social media
//         instagramLink: shop.socialMedia?.instagram || "",
//         facebookLink: shop.socialMedia?.facebook || "",
//         linkedinLink: shop.socialMedia?.linkedin || "",

//         rating: shop.rating || 0,
//         reviewCount: shop.reviewCount || 0,
//         isEmailVerified: shop.isEmailVerified,
//         isVerified: shop.isVerified,
//         verifiedAt: shop.verifiedAt?.toISOString?.() || null,
//         acceptedPolicy: shop.acceptedPolicy,
//         policyAcceptedAt: shop.policyAcceptedAt?.toISOString?.() || null,
//         status: shop.status,
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
// FIXED: signin with shop.isVerified check
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
    // STEP 5: Everything OK → login
    // ============================
    const token = jwt.sign(
      { 
        shopId: shop._id, 
        email: shop.email, 
        role: "shop",
        isBlocked: shop.isBlocked, // Include in token for other middleware
        status: shop.status
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      status: "success",
      message: "Login successful",
      token,
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
        website: shop.website,
        country: shop.country,
        zipCode: shop.zipCode,
        latitude: shop.latitude,
        longitude: shop.longitude,

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
        address: shop.address,
        insuranceCarrier: shop.insuranceCarrier,
        policyNumber: shop.policyNumber,
        policyExpiration: shop.policyExpiration,
        insuranceCertificate: shop.insuranceCertificate,

        // Social media
        instagramLink: shop.socialMedia?.instagram || "",
        facebookLink: shop.socialMedia?.facebook || "",
        linkedinLink: shop.socialMedia?.linkedin || "",

        rating: shop.rating || 0,
        reviewCount: shop.reviewCount || 0,
        isEmailVerified: shop.isEmailVerified,
        isVerified: shop.isVerified,
        verifiedAt: shop.verifiedAt?.toISOString?.() || null,
        acceptedPolicy: shop.acceptedPolicy,
        policyAcceptedAt: shop.policyAcceptedAt?.toISOString?.() || null,
        status: shop.status,
        isBlocked: shop.isBlocked, // Added to response
        blockedAt: shop.blockedAt, // Added to response
        blockedReason: shop.blockedReason // Added to response
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














// ---------------------- COMPLETE REGISTRATION ----------------------
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
    } = req.body;

    console.log("completeRegistration body:", req.body);

    // Find shop by email
    const shop = await Shop.findOne({ email });
    if (!shop) {
      return res.status(404).json({
        status: "error",
        message: "Shop not found",
      });
    }

    // Require email verification before proceeding (keeps existing security check)
    if (!shop.isEmailVerified) {
      return res.status(403).json({
        status: "error",
        message: "Email not verified",
      });
    }

    // Handle uploaded files (if any)
    const uploadedFiles = req.files || {};
    const insuranceCertificate =
      uploadedFiles.insuranceCertificate?.[0]?.path || shop.insuranceCertificate;
    const storeFrontPhoto =
      uploadedFiles.storeFrontPhoto?.[0]?.path || shop.storeFrontPhoto;
    const workSpacePhoto =
      uploadedFiles.workSpacePhoto?.[0]?.path || shop.workSpacePhoto;

    // Multiple certificates (if any)
    const certificateFiles = uploadedFiles.certificateFiles
      ? uploadedFiles.certificateFiles.map((f) => f.path)
      : shop.certificateFiles || [];

    // Parse JSON fields safely
    let parsedServices = [];
    if (Array.isArray(services)) parsedServices = services;
    else if (typeof services === "string") {
      try {
        parsedServices = JSON.parse(services);
      } catch (e) {
        parsedServices = [];
      }
    }

    let parsedPayment = {};
    if (typeof paymentData === "string") {
      try {
        parsedPayment = JSON.parse(paymentData);
      } catch (e) {
        parsedPayment = {};
      }
    } else if (typeof paymentData === "object" && paymentData !== null) {
      parsedPayment = paymentData;
    }

    // Parse location coordinates
    const parsedLatitude = latitude ? parseFloat(latitude) : null;
    const parsedLongitude = longitude ? parseFloat(longitude) : null;

    // Update shop fields (we still update the document, but DO NOT return token/data)
    shop.businessName = businessName || shop.businessName;
    shop.legalEntityName = legalEntityName || shop.legalEntityName;
    shop.ownerName = ownerName || shop.ownerName;
    shop.countryCode = countryCode || shop.countryCode;
    shop.phone = phone || shop.phone;
    shop.website = website || shop.website;
    shop.address = address || shop.address;
    shop.zipCode = zipCode || shop.zipCode;
    shop.country = country || shop.country;

    if (parsedLatitude !== null && parsedLongitude !== null) {
      shop.location = {
        type: "Point",
        coordinates: [parsedLongitude, parsedLatitude], // [lng, lat]
      };
      shop.latitude = parsedLatitude;
      shop.longitude = parsedLongitude;
    }

    shop.services = parsedServices.length ? parsedServices : shop.services;
    shop.vinylFilms = vinylFilms || shop.vinylFilms;
    shop.certificates = certificates || shop.certificates;
    shop.startDate = startDate || shop.startDate;
    shop.insuranceCarrier = insuranceCarrier || shop.insuranceCarrier;
    shop.policyNumber = policyNumber || shop.policyNumber;
    shop.policyExpiration = policyExpiration || shop.policyExpiration;
    shop.insuranceCertificate = insuranceCertificate || shop.insuranceCertificate;

    shop.socialMedia = {
      instagram: instagramLink || shop.socialMedia?.instagram || "",
      facebook: facebookLink || shop.socialMedia?.facebook || "",
      linkedin: linkedinLink || shop.socialMedia?.linkedin || "",
    };

    shop.additionalInfo = additionalInfo || shop.additionalInfo;
    shop.storeFrontPhoto = storeFrontPhoto || shop.storeFrontPhoto;
    shop.workSpacePhoto = workSpacePhoto || shop.workSpacePhoto;
    shop.certificateFiles = certificateFiles.length ? certificateFiles : shop.certificateFiles || [];
    shop.plan = plan || shop.plan;
    shop.paymentInfo = Object.keys(parsedPayment).length ? parsedPayment : shop.paymentInfo || {};

    shop.acceptedPolicy = true;
    shop.policyAcceptedAt = new Date();

    // Keep registration in pending status & mark as not verified so admin review can happen
    shop.status = "pending";
    shop.isVerified = false;
    // Do NOT set verifiedAt (it should only be set after admin verifies)
    // shop.verifiedAt = new Date(); // <- DON'T set this here

    await shop.save();

    // IMPORTANT: This endpoint intentionally does NOT return a JWT or shop data.
    // It only acknowledges submission and instructs the user to wait for verification.
    return res.status(202).json({
      status: "pending_verification",
      message:
        "Your registration has been submitted successfully. Verification will take up to 48 hours. You will be notified when verification is complete.",
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

    // Merge all updates
    const updatedData = {
      ...req.body,
      services: parsedServices,
      profilePic,
      storeFrontPhoto,
      workSpacePhoto,
      insuranceCertificate,
      certificateFiles,
    };

    const updatedShop = await Shop.findByIdAndUpdate(id, { $set: updatedData }, { new: true });

    res.status(200).json({
      message: "Shop profile updated successfully",
      shop: updatedShop,
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





// // ============================================
// // FIXED: googleCallbackPartner
// // ============================================
// export const googleCallbackPartner = async (req, res) => {
//   try {
//     const code = req.query.code;
//     const { tokens } = await client.getToken(code);

//     client.setCredentials(tokens);

//     const ticket = await client.verifyIdToken({
//       idToken: tokens.id_token,
//       audience: process.env.GOOGLE_CLIENT_ID,
//     });

//     const googleUser = ticket.getPayload();
//     const email = googleUser.email;

//     let user = await Shop.findOne({ email });

//     // =====================================
//     // CASE 1: USER DOES NOT EXIST → SIGNUP
//     // =====================================
//     if (!user) {
//       const newShop = new Shop({
//         email,
//         password: "Google_Auth_password",
//         phone: "000000000",
//         businessName: "Business Name (Pending)",
//         legalEntityName: "Legal Entity (Pending)",
//         ownerName: "Owner Name (Pending)",
//         address: "Business Address (Pending)",
//         country: "US (Pending)",
//         startDate: new Date(),
//         insuranceCarrier: "Insurance Carrier (Pending)",
//         policyNumber: "Policy Number (Pending)",
//         policyExpiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
//         insuranceCertificate: "Pending",
//         storeFrontPhoto: "Pending",
//         workSpacePhoto: "Pending",
//         certificateFiles: [],
//         zipCode: "00000",
//         plan: "basic",
//         isEmailVerified: true, // Google already verified
//       });

//       user = await newShop.save();

//       return res.redirect(
//         `https://bidawrap1.netlify.app/google-success-partner?` +
//         `email=${encodeURIComponent(email)}&flow=signup`
//       );
//     }

//     // =========================================
//     // CASE 2: USER EXISTS BUT PROFILE INCOMPLETE
//     // =========================================
//     const isIncomplete =
//       user.businessName.includes("(Pending)") ||
//       user.legalEntityName.includes("(Pending)") ||
//       user.ownerName.includes("(Pending)") ||
//       user.address.includes("(Pending)");

//     if (isIncomplete) {
//       return res.redirect(
//         `https://bidawrap1.netlify.app/google-success-partner?` +
//         `email=${encodeURIComponent(email)}&flow=signup`
//       );
//     }

//     // ===============================================
//     // CASE 3: EXISTING USER WITH COMPLETE DATA → SIGNIN
//     // ===============================================
//     const token = jwt.sign(
//       { shopId: user._id, email: user.email, role: "shop" },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     // ✅ FIXED: Return complete data structure matching signin
//     const shopData = {
//       id: user._id,
//       email: user.email,
//       businessName: user.businessName,
//       ownerName: user.ownerName,
//       plan: user.plan,
//       avatar: user.profilePic || "",

//       // Contact
//       countryCode: user.countryCode,
//       phone: user.phone,
//       website: user.website,
//       country: user.country,
//       zipCode: user.zipCode,
//       latitude: user.latitude,
//       longitude: user.longitude,

//       // Services & general info
//       services: user.services,
//       vinylFilms: user.vinylFilms,
//       certificates: user.certificates,
//       certificateFiles: user.certificateFiles,
//       startDate: user.startDate?.toISOString?.() || user.startDate,
//       bio: user.additionalInfo || "",

//       // Photos
//       workSpacePhoto: user.workSpacePhoto,
//       storeFrontPhoto: user.storeFrontPhoto,

//       // Legal + insurance
//       legalEntityName: user.legalEntityName,
//       address: user.address,
//       insuranceCarrier: user.insuranceCarrier,
//       policyNumber: user.policyNumber,
//       policyExpiration: user.policyExpiration,
//       insuranceCertificate: user.insuranceCertificate,

//       // Social media
//       instagramLink: user.socialMedia?.instagram || "",
//       facebookLink: user.socialMedia?.facebook || "",
//       linkedinLink: user.socialMedia?.linkedin || "",

//       // Payment info
//       paymentInfo: user.paymentInfo,

//       // ✅ Additional fields to match signin
//       rating: user.rating || 0,
//       reviewCount: user.reviewCount || 0,
//       isEmailVerified: user.isEmailVerified,
//       isVerified: user.isVerified,
//       verifiedAt: user.verifiedAt?.toISOString?.() || null,
//       acceptedPolicy: user.acceptedPolicy,
//       policyAcceptedAt: user.policyAcceptedAt?.toISOString?.() || null,
//       status: user.status,
//     };

//     const shopDataEncoded = encodeURIComponent(JSON.stringify(shopData));

//     return res.redirect(
//       `https://bidawrap1.netlify.app/google-success-partner?` +
//       `flow=signin&` +
//       `token=${token}&` +
//       `shopData=${shopDataEncoded}`
//     );

//   } catch (error) {
//     console.error("Google callback error:", error);
//     return res.redirect(`https://bidawrap1.netlify.app/google-failed`);
//   }
// };







// // ============================================
// // FIXED: googleCallbackPartner WITH VERIFICATION FILTERS
// // ============================================
// export const googleCallbackPartner = async (req, res) => {
//   try {
//     const code = req.query.code;
//     const { tokens } = await client.getToken(code);

//     client.setCredentials(tokens);

//     const ticket = await client.verifyIdToken({
//       idToken: tokens.id_token,
//       audience: process.env.GOOGLE_CLIENT_ID,
//     });

//     const googleUser = ticket.getPayload();
//     const email = googleUser.email;

//     let user = await Shop.findOne({ email });

//     // =====================================
//     // CASE 1: USER DOES NOT EXIST → SIGNUP
//     // =====================================
//     if (!user) {
//       const newShop = new Shop({
//         email,
//         password: "Google_Auth_password",
//         phone: "000000000",
//         businessName: "Business Name (Pending)",
//         legalEntityName: "Legal Entity (Pending)",
//         ownerName: "Owner Name (Pending)",
//         address: "Business Address (Pending)",
//         country: "US (Pending)",
//         startDate: new Date(),
//         insuranceCarrier: "Insurance Carrier (Pending)",
//         policyNumber: "Policy Number (Pending)",
//         policyExpiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
//         insuranceCertificate: "Pending",
//         storeFrontPhoto: "Pending",
//         workSpacePhoto: "Pending",
//         certificateFiles: [],
//         zipCode: "00000",
//         plan: "basic",
//         isEmailVerified: true, // Google already verified email
//       });

//       user = await newShop.save();

//       return res.redirect(
//         `https://bidawrap1.netlify.app/google-success-partner?` +
//         `email=${encodeURIComponent(email)}&flow=signup`
//       );
//     }

//     // =========================================
//     // CASE 2: PROFILE STILL INCOMPLETE → GO SETUP
//     // =========================================
//     const isIncomplete =
//       user.businessName.includes("(Pending)") ||
//       user.legalEntityName.includes("(Pending)") ||
//       user.ownerName.includes("(Pending)") ||
//       user.address.includes("(Pending)");

//     if (isIncomplete) {
//       return res.redirect(
//         `https://bidawrap1.netlify.app/google-success-partner?` +
//         `email=${encodeURIComponent(email)}&flow=signup`
//       );
//     }

//     // =========================================
//     // 🚫 FILTER BEFORE TOKEN AND DATA
//     // =========================================

//     // EMAIL VERIFIED (Google login always verified)
//     if (!user.isEmailVerified) {
//       return res.redirect(
//         `https://bidawrap1.netlify.app/google-status?status=not_verified`
//       );
//     }

//     // ADMIN VERIFIED
//     if (!user.isVerified) {
//       return res.redirect(
//         `https://bidawrap1.netlify.app/google-status?status=not_approved`
//       );
//     }

//     // ===============================================
//     // CASE 3: FULLY VERIFIED USER → SIGNIN + SEND DATA
//     // ===============================================

//     const token = jwt.sign(
//       { shopId: user._id, email: user.email, role: "shop" },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     // Prepare same shop data as signin
//     const shopData = {
//       id: user._id,
//       email: user.email,
//       businessName: user.businessName,
//       ownerName: user.ownerName,
//       plan: user.plan,
//       avatar: user.profilePic || "",

//       countryCode: user.countryCode,
//       phone: user.phone,
//       website: user.website,
//       country: user.country,
//       zipCode: user.zipCode,
//       latitude: user.latitude,
//       longitude: user.longitude,

//       services: user.services,
//       vinylFilms: user.vinylFilms,
//       certificates: user.certificates,
//       certificateFiles: user.certificateFiles,
//       startDate: user.startDate?.toISOString?.() || user.startDate,
//       bio: user.additionalInfo || "",

//       workSpacePhoto: user.workSpacePhoto,
//       storeFrontPhoto: user.storeFrontPhoto,

//       legalEntityName: user.legalEntityName,
//       address: user.address,
//       insuranceCarrier: user.insuranceCarrier,
//       policyNumber: user.policyNumber,
//       policyExpiration: user.policyExpiration,
//       insuranceCertificate: user.insuranceCertificate,

//       instagramLink: user.socialMedia?.instagram || "",
//       facebookLink: user.socialMedia?.facebook || "",
//       linkedinLink: user.socialMedia?.linkedin || "",

//       paymentInfo: user.paymentInfo,

//       rating: user.rating || 0,
//       reviewCount: user.reviewCount || 0,
//       isEmailVerified: user.isEmailVerified,
//       isVerified: user.isVerified
//     };

//     const shopDataEncoded = encodeURIComponent(JSON.stringify(shopData));

//     return res.redirect(
//       `https://bidawrap1.netlify.app/google-success-partner?` +
//       `flow=signin&token=${token}&shopData=${shopDataEncoded}`
//     );

//   } catch (error) {
//     console.error("Google callback error:", error);
//     return res.redirect(`https://bidawrap1.netlify.app/google-failed`);
//   }
// };






// ============================================
// FIXED: googleCallbackPartner WITH VERIFICATION FILTERS
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

    let user = await Shop.findOne({ email });

    // =====================================
    // CASE 1: USER DOES NOT EXIST → SIGNUP
    // =====================================
    if (!user) {
      const newShop = new Shop({
        email,
        password: "Google_Auth_password",
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
        isEmailVerified: true, // Google already verified email
      });

      user = await newShop.save();

      return res.redirect(
        `https://bidawrap1.netlify.app/google-success-partner?` +
        `email=${encodeURIComponent(email)}&flow=signup`
      );
    }

    // =========================================
    // CASE 2: PROFILE STILL INCOMPLETE → GO SETUP
    // =========================================
    const isIncomplete =
      user.businessName.includes("(Pending)") ||
      user.legalEntityName.includes("(Pending)") ||
      user.ownerName.includes("(Pending)") ||
      user.address.includes("(Pending)");

    if (isIncomplete) {
      return res.redirect(
        `https://bidawrap1.netlify.app/google-success-partner?` +
        `email=${encodeURIComponent(email)}&flow=signup`
      );
    }

    // =========================================
    // 🚫 FILTER BEFORE TOKEN AND DATA
    // =========================================

    // EMAIL VERIFIED (Google login always verified)
    if (!user.isEmailVerified) {
      return res.redirect(
        `https://bidawrap1.netlify.app/google-status?status=not_verified`
      );
    }

    // ADMIN VERIFIED
    if (!user.isVerified) {
      return res.redirect(
        `https://bidawrap1.netlify.app/google-status?status=not_approved`
      );
    }

    // =========================================
    // CHECK IF SHOP IS BLOCKED
    // =========================================
    if (user.isBlocked === true || user.status === "blocked") {
      return res.redirect(
        `https://bidawrap1.netlify.app/google-status?status=blocked`
      );
    }

    // =========================================
    // CHECK IF SHOP IS ACTIVE
    // =========================================
    if (user.status !== "active") {
      return res.redirect(
        `https://bidawrap1.netlify.app/google-status?status=inactive&shopStatus=${user.status}`
      );
    }

    // ===============================================
    // CASE 3: FULLY VERIFIED USER → SIGNIN + SEND DATA
    // ===============================================

    const token = jwt.sign(
      { 
        shopId: user._id, 
        email: user.email, 
        role: "shop",
        isBlocked: user.isBlocked, // Include in token
        status: user.status // Include in token
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Prepare same shop data as signin
    const shopData = {
      id: user._id,
      email: user.email,
      businessName: user.businessName,
      ownerName: user.ownerName,
      plan: user.plan,
      avatar: user.profilePic || "",

      countryCode: user.countryCode,
      phone: user.phone,
      website: user.website,
      country: user.country,
      zipCode: user.zipCode,
      latitude: user.latitude,
      longitude: user.longitude,

      services: user.services,
      vinylFilms: user.vinylFilms,
      certificates: user.certificates,
      certificateFiles: user.certificateFiles,
      startDate: user.startDate?.toISOString?.() || user.startDate,
      bio: user.additionalInfo || "",

      workSpacePhoto: user.workSpacePhoto,
      storeFrontPhoto: user.storeFrontPhoto,

      legalEntityName: user.legalEntityName,
      address: user.address,
      insuranceCarrier: user.insuranceCarrier,
      policyNumber: user.policyNumber,
      policyExpiration: user.policyExpiration,
      insuranceCertificate: user.insuranceCertificate,

      instagramLink: user.socialMedia?.instagram || "",
      facebookLink: user.socialMedia?.facebook || "",
      linkedinLink: user.socialMedia?.linkedin || "",

      paymentInfo: user.paymentInfo,

      rating: user.rating || 0,
      reviewCount: user.reviewCount || 0,
      isEmailVerified: user.isEmailVerified,
      isVerified: user.isVerified,
      status: user.status,
      isBlocked: user.isBlocked,
      blockedAt: user.blockedAt,
      blockedReason: user.blockedReason
    };

    const shopDataEncoded = encodeURIComponent(JSON.stringify(shopData));

    return res.redirect(
      `https://bidawrap1.netlify.app/google-success-partner?` +
      `flow=signin&token=${token}&shopData=${shopDataEncoded}`
    );

  } catch (error) {
    console.error("Google callback error:", error);
    return res.redirect(`https://bidawrap1.netlify.app/google-failed`);
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