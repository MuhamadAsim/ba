
import bcrypt from "bcryptjs";
import Shop from "../models/shopModel.js";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";


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

    // Create new shop with placeholders
    const newShop = new Shop({
      email,
      password: hashedPassword,
      phone: "000000000",
      businessName: "Business Name (Pending)",
      legalEntityName: "Legal Entity (Pending)",
      ownerName: "Owner Name (Pending)",
      address: "Business Address (Pending)",
      country : "Usa (Pending)",
      startDate: new Date(),
      insuranceCarrier: "Insurance Carrier (Pending)",
      policyNumber: "Policy Number (Pending)",
      policyExpiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      insuranceCertificate: "Pending",
      storeFrontPhoto: "Pending",
      workSpacePhoto: "Pending",
      certificateFiles: [],
      country: "US",
      zipCode: "9000",
      plan: "basic",
      isEmailVerified: false,
      otp,
      otpExpiry: Date.now() + 10 * 60 * 1000,
    });

    await newShop.save();

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

// ---------------------- SIGNIN ----------------------
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const shop = await Shop.findOne({ email });
    if (!shop)
      return res.json({
        status: "invalid_credentials",
        message: "Invalid email or password"
      });

    // ✅ Check password FIRST before checking verification
    const isMatch = await bcrypt.compare(password, shop.password);
    if (!isMatch)
      return res.json({
        status: "invalid_credentials",
        message: "Invalid email or password"
      });

    // ✅ If credentials are correct but NOT verified, send OTP
    if (!shop.isEmailVerified) {
      const otp = generateOtp();
      shop.otp = otp;
      shop.otpExpiry = Date.now() + 10 * 60 * 1000;
      await shop.save();

      await sendOtpEmail(email, otp);

      return res.json({
        status: "not_verified",
        message: "Email not verified. OTP sent to your email."
      });
    }

    // ✅ Generate JWT for verified shop
    const token = jwt.sign(
      { shopId: shop._id, email: shop.email ,role:"shop"},
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
        plan: shop.plan, // "basic" | "professional" | "enterprise"
        avatar: shop.profilePic || "",

        // Contact & basic info
        countryCode: shop.countryCode,
        phone: shop.phone,
        website: shop.website,
        country: shop.country,
        services: shop.services,
        vinylFilms: shop.vinylFilms,
        certificates: shop.certificates,
        startDate: shop.startDate,

        // Social media (mapped correctly from nested socialMedia object)
        instagramLink: shop.socialMedia?.instagram || "",
        facebookLink: shop.socialMedia?.facebook || "",
        linkedinLink: shop.socialMedia?.linkedin || "",

        // Additional info
        bio: shop.additionalInfo || "",
        workSpacePhoto: shop.workSpacePhoto,
        storeFrontPhoto: shop.storeFrontPhoto,

        // Legal & insurance details
        legalEntityName: shop.legalEntityName,
        address: shop.address,
        insuranceCarrier: shop.insuranceCarrier,
        policyNumber: shop.policyNumber,
        policyExpiration: shop.policyExpiration,
      }


    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error during signin"
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

















export const signInShop = async (req, res) => {
  try {
    const { email, password } = req.body;

    const shop = await Shop.findOne({ email });
    if (!shop) {
      return res.status(404).json({ status: "error", message: "Shop not found" });
    }

    if (!shop.isEmailVerified) {
      return res.json({ status: "not_verified", message: "Email not verified" });
    }

    const isMatch = await bcrypt.compare(password, shop.password);
    if (!isMatch) {
      return res.json({ status: "invalid_credentials", message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: shop._id, email: shop.email, role: "shop" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Map shop data to frontend Partner interface
    const shopData = {
      id: shop._id,
      email: shop.email,
      businessName: shop.businessName,
      ownerName: shop.ownerName,
      plan: shop.plan,
      avatar: shop.profilePic || null,

      // Editable fields
      countryCode: shop.countryCode,
      phone: shop.phone,
      website: shop.website,
      country: shop.country,
      services: shop.services,
      vinylFilms: shop.vinylFilms,
      certificates: shop.certificates,
      startDate: shop.startDate,
      instagramLink: shop.socialMedia?.instagram || "",
      facebookLink: shop.socialMedia?.facebook || "",
      linkedinLink: shop.socialMedia?.linkedin || "",
      bio: shop.additionalInfo || "",

      // Non-editable fields
      legalEntityName: shop.legalEntityName,
      address: shop.address,
      insuranceCarrier: shop.insuranceCarrier,
      policyNumber: shop.policyNumber,
      policyExpiration: shop.policyExpiration,

      // ✅ Add these
      storeFrontPhoto: shop.storeFrontPhoto || null,
      workSpacePhoto: shop.workSpacePhoto || null,
    };


    res.json({
      status: "success",
      token,
      shop: shopData,
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error during signin",
    });
  }
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

    console.log(req.body);

    // Find verified shop
    const shop = await Shop.findOne({ email });
    if (!shop) {
      return res.status(404).json({
        status: "error",
        message: "Shop not found",
      });
    }

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
    if (Array.isArray(services)) {
      parsedServices = services;
    } else if (typeof services === "string") {
      try {
        parsedServices = JSON.parse(services);
      } catch {
        parsedServices = [];
      }
    }

    let parsedPayment = {};
    if (typeof paymentData === "string") {
      try {
        parsedPayment = JSON.parse(paymentData);
      } catch {
        parsedPayment = {};
      }
    } else if (typeof paymentData === "object" && paymentData !== null) {
      parsedPayment = paymentData;
    }

    // Parse location coordinates
    const parsedLatitude = latitude ? parseFloat(latitude) : null;
    const parsedLongitude = longitude ? parseFloat(longitude) : null;

    // Update shop data
    shop.businessName = businessName;
    shop.legalEntityName = legalEntityName;
    shop.ownerName = ownerName;
    shop.countryCode = countryCode;
    shop.phone = phone;
    shop.website = website;
    shop.address = address;
    shop.zipCode = zipCode;
    shop.country = country;
    
    // Location coordinates
    if (parsedLatitude !== null && parsedLongitude !== null) {
      shop.location = {
        type: "Point",
        coordinates: [parsedLongitude, parsedLatitude] // GeoJSON format: [lng, lat]
      };
      shop.latitude = parsedLatitude;
      shop.longitude = parsedLongitude;
    }
    
    shop.services = parsedServices;
    shop.vinylFilms = vinylFilms;
    shop.certificates = certificates;
    shop.startDate = startDate;
    shop.insuranceCarrier = insuranceCarrier;
    shop.policyNumber = policyNumber;
    shop.policyExpiration = policyExpiration;
    shop.insuranceCertificate = insuranceCertificate;
    shop.socialMedia = {
      instagram: instagramLink,
      facebook: facebookLink,
      linkedin: linkedinLink,
    };
    shop.additionalInfo = additionalInfo;
    shop.storeFrontPhoto = storeFrontPhoto;
    shop.workSpacePhoto = workSpacePhoto;
    shop.certificateFiles = certificateFiles;
    shop.plan = plan;
    shop.paymentInfo = parsedPayment;
    shop.acceptedPolicy = true;
    shop.status = "active";
    shop.isVerified = true;
    shop.verifiedAt = new Date();

    await shop.save();

    // ✅ Generate JWT token just like signin
    const token = jwt.sign(
      { shopId: shop._id, email: shop.email ,role:"shop" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Return the same structure as signin
    res.json({
      status: "success",
      message: "Shop registration completed successfully!",
      token,
      shop: {
        id: shop._id,
        email: shop.email,
        businessName: shop.businessName,
        ownerName: shop.ownerName,
        plan: shop.plan, // "basic" | "professional" | "enterprise"
        avatar: shop.profilePic || "",

        // Contact & basic info
        countryCode: shop.countryCode,
        phone: shop.phone,
        website: shop.website,
        country: shop.country,
        zipCode: shop.zipCode,
        latitude: shop.latitude,
        longitude: shop.longitude,
        services: shop.services,
        vinylFilms: shop.vinylFilms,
        certificates: shop.certificates,
        startDate: shop.startDate,

        // Social media (mapped correctly)
        instagramLink: shop.socialMedia?.instagram || "",
        facebookLink: shop.socialMedia?.facebook || "",
        linkedinLink: shop.socialMedia?.linkedin || "",

        // Additional info
        bio: shop.additionalInfo || "",
        workSpacePhoto: shop.workSpacePhoto,
        storeFrontPhoto: shop.storeFrontPhoto,

        // Legal & insurance details
        legalEntityName: shop.legalEntityName,
        address: shop.address,
        insuranceCarrier: shop.insuranceCarrier,
        policyNumber: shop.policyNumber,
        policyExpiration: shop.policyExpiration,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
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
  process.env.GOOGLE_REDIRECT_URI
);

// -------------------- STEP 1: SEND GOOGLE LOGIN URL --------------------
export const getGoogleAuthURL = async (req, res) => {
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


// -------------------- STEP 2: GOOGLE CALLBACK --------------------
export const googleCallback = async (req, res) => {
  try {
    const code = req.query.code;
    const { tokens } = await client.getToken(code);

    client.setCredentials(tokens);

    // Fetch Google user data
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const googleUser = ticket.getPayload();

    const email = googleUser.email;
    const name = googleUser.name;
    const avatar = googleUser.picture;

    let user = await Shop.findOne({ email });

    if (!user) {
      // -------------------- NEW USER (SIGNUP VIA GOOGLE) --------------------
      user = await Shop.create({
        email,
        password: "GOOGLE_AUTH_USER", 
        isEmailVerified: true,
        isVerified: true,
      });
    }

    // -------------------- EXISTING USER LOGIN --------------------
    const token = jwt.sign(
      { shopId: user._id, email: user.email, role: "shop" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // ✅ Include user._id in the redirect URL
    const redirectUrl = `https://bidawrap1.netlify.app/google-success-partner?` +
      `id=${user._id}&` +
      `token=${token}&` +
      `email=${encodeURIComponent(user.email)}&`;

    return res.redirect(redirectUrl);

  } catch (error) {
    console.error("Google callback error:", error);
    return res.redirect(
      `https://bidawrap1.netlify.app/google-failed`
    );
  }
};