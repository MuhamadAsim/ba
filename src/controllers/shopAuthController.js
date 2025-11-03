import bcrypt from "bcryptjs";
import Shop from "../models/shopModel.js";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

// Configure SendGrid

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
        <p style="font-size:12px;color:#888;">If you didn’t request this, please ignore this email.</p>
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
        return res.json({ status: "exists", message: "Email already registered" });
      } else {
        // Resend OTP for unverified account
        const otp = generateOtp();
        existing.otp = otp;
        existing.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 mins
        await existing.save();

        await sendOtpEmail(email, otp);
        return res.json({ status: "otp_resent", message: "OTP resent to your email" });
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
      serviceArea: "Service Area (Pending)",
      startDate: new Date(),
      insuranceCarrier: "Insurance Carrier (Pending)",
      policyNumber: "Policy Number (Pending)",
      policyExpiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // +1 year
      insuranceCertificate: "Pending",
      storeFrontPhoto: "Pending",
      workSpacePhoto: "Pending",
      certificateFiles: [],
      plan: "basic", // default plan
      isEmailVerified: false,
      otp,
      otpExpiry: Date.now() + 10 * 60 * 1000, // 10 min expiry
    });

    await newShop.save();

    // Send OTP email
    await sendOtpEmail(email, otp);

    return res.json({ status: "otp_sent", message: "OTP sent to your email" });

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

    if (!shop) return res.status(404).json({ message: "Shop not found" });

    if (!shop.otp || !shop.otpExpiry)
      return res.json({ status: "invalid", message: "No OTP found" });

    if (shop.otp !== otp)
      return res.json({ status: "invalid", message: "Invalid OTP" });

    if (shop.otpExpiry < Date.now())
      return res.json({ status: "expired", message: "OTP expired" });

    // Verify shop email
    shop.isEmailVerified = true;
    shop.otp = undefined;
    shop.otpExpiry = undefined;
    await shop.save();

    res.json({ status: "verified", message: "Email verified successfully" });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ message: "Server error during OTP verification" });
  }
};

// ---------------------- SIGNIN ----------------------
export const signInShop = async (req, res) => {
  try {
    const { email, password } = req.body;
    const shop = await Shop.findOne({ email });

    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if (!shop.isEmailVerified)
      return res.json({ status: "not_verified", message: "Email not verified" });

    const isMatch = await bcrypt.compare(password, shop.password);
    if (!isMatch)
      return res.json({ status: "invalid_credentials", message: "Invalid credentials" });

    res.json({
      status: "success",
      shop: {
        id: shop._id,
        email: shop.email,
        businessName: shop.businessName,
        plan: shop.plan,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ message: "Server error during signin" });
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
      phone,
      website,
      address,
      serviceArea,
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

    // Find verified shop
    const shop = await Shop.findOne({ email });
    if (!shop) {
      return res
        .status(404)
        .json({ status: "error", message: "Shop not found" });
    }

    if (!shop.isEmailVerified) {
      return res
        .status(403)
        .json({ status: "error", message: "Email not verified" });
    }

    // Handle Cloudinary uploaded files
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

    // Parse JSON fields
    let parsedServices = [];
    try {
      parsedServices = JSON.parse(services || "[]");
    } catch {
      parsedServices = [];
    }

    let parsedPayment = {};
    try {
      parsedPayment = JSON.parse(paymentData || "{}");
    } catch {
      parsedPayment = {};
    }

    // Update shop data
    shop.businessName = businessName;
    shop.legalEntityName = legalEntityName;
    shop.ownerName = ownerName;
    shop.countryCode = countryCode;
    shop.phone = phone;
    shop.website = website;
    shop.address = address;
    shop.serviceArea = serviceArea;
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

    res.json({
      status: "success",
      message: "Shop registration completed successfully!",
      shop: {
        id: shop._id,
        email: shop.email,
        businessName: shop.businessName,
        plan: shop.plan,
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
