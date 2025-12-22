import jwt from "jsonwebtoken";
import crypto from "crypto";
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js"
import Event from "../models/eventModel.js";
import VerificationRequest from "../models/updateProfileModel.js";
import { sendEmail } from "../utils/sendEmail.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";





// ===== IN-MEMORY OTP STORE =====
// NOTE: For production, consider using Redis for scalability and persistence
const otpStore = {};

// ===== CONFIGURATION =====
const OTP_LENGTH = Number(process.env.OTP_LENGTH) || 6;
const OTP_EXPIRY_MS = Number(process.env.OTP_EXPIRY_MS) || 5 * 60 * 1000; // 5 minutes
const MAX_VERIFICATION_ATTEMPTS = 5;
const JWT_EXPIRY = process.env.JWT_EXPIRY || "1d";

// ===== CLEANUP OLD OTPs =====
// Prevent memory leaks by removing expired OTPs every minute
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

/**
 * Hash OTP for secure storage
 * @param {string} otp - Plain text OTP
 * @returns {string} - Hashed OTP
 */
function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}


/**
 * GET /api/admin/dashboard/stats
 * Returns overall platform statistics
 */
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
 */export const getDashboardOverview = async (req, res) => {
  try {
    // ===== RECENT ACTIVITIES =====
    const recentActivities = await Event.find({
      type: { $in: ["bid-created", "offer-accepted", "bid-completed"] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("customerId", "name email")
      .populate("shopId", "businessName")
      .populate("bidId", "requestCategory")
      .lean();

    // Format activities for frontend
    const formattedActivities = recentActivities.map((activity) => {
      let description = activity.message || "Activity occurred";
      let user = "Unknown User";
      let shop = null;
      let activityStatus = "info";

      // Determine user name
      if (activity.customerId) {
        user = activity.customerId.name || activity.customerId.email || "Unknown User";
      } else if (activity.shopId) {
        user = activity.shopId.businessName || "Unknown Shop";
      }

      // Determine shop name if available
      if (activity.shopId) {
        shop = activity.shopId.businessName;
      }

      // Set status based on type
      switch (activity.type) {
        case "bid-created":
          activityStatus = "info";
          break;
        case "offer-accepted":
        case "bid-completed":
          activityStatus = "success";
          break;
        default:
          activityStatus = "info";
      }

      return {
        id: activity._id.toString(),
        type: activity.type,
        description,
        user,
        shop,
        timestamp: activity.createdAt,
        status: activityStatus,
      };
    });

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
          ownerName: 1, // ✅ Use ownerName directly from Shop schema
          completedBids: 1,
          plan: 1, // ✅ Use plan directly from Shop schema
        },
      },
      { $sort: { completedBids: -1 } },
      { $limit: 5 },
    ]);

    // Format shops for frontend
    const formattedShops = topShops.map((shop) => ({
      id: shop._id.toString(),
      name: shop.businessName,
      owner: shop.ownerName || "Unknown Owner", // ✅ Now using the correct field
      completedBids: shop.completedBids,
      subscription: {
        plan: shop.plan || "basic", // ✅ Using the correct field
      },
    }));

    return res.status(200).json({
      success: true,
      data: {
        activities: formattedActivities,
        shops: formattedShops,
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














// ===== AUTHENTICATION ENDPOINTS =====

/**
 * POST /api/admin/login
 * Body: { email, password }
 * - Validates credentials against environment variables
 * - Generates and stores OTP
 * - Sends OTP via email
 */export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    console.log(email, password);

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Validate credentials
    if (
      email !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
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
    otpStore[email] = {
      otp: hashedOtp,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
    };

    // Send OTP email
    const subject = "Your Admin OTP Code";
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Admin Login Verification</h2>
        <p>Your OTP code is:</p>
        <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>This code will expire in <strong>${Math.floor(
      OTP_EXPIRY_MS / 60000
    )} minute(s)</strong>.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `;

    // Call sendEmail with correct parameters (to, subject, html)
    await sendEmail(email, subject, html);

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.error("adminLogin error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP. Please try again.",
    });
  }
};//
/**
 * POST /api/admin/verify-otp
 * Body: { email, otp }
 * - Validates OTP, expiry, and attempts
 * - Returns JWT token on success
 */
export const verifyOtp = (req, res) => {
  try {
    const { email, otp } = req.body || {};

    // Validate input
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
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

    // Success: Remove OTP and generate JWT
    delete otpStore[email];

    const token = jwt.sign(
      { email, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    const adminInfo = {
      email,
      role: "admin",
    };

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

    // Validate admin email
    if (email !== process.env.ADMIN_EMAIL) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin email",
      });
    }

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
    };

    // Send OTP email
    const subject = "Your New Admin OTP Code";
    const text = `Your new OTP code is ${otp}. It expires in ${Math.floor(
      OTP_EXPIRY_MS / 60000
    )} minute(s).`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Admin Login Verification</h2>
        <p>Your new OTP code is:</p>
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
      message: "New OTP sent to your email",
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
export const verifyToken = (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    return res.status(200).json({
      success: true,
      admin: {
        email: decoded.email,
        role: decoded.role,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
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







// // Accept/Verify a shop
// export const acceptShop = async (req, res) => {
//   try {
//     const { shopId } = req.params;
//     const { isAdminShop } = req.body;

//     const shop = await Shop.findById(shopId);

//     if (!shop) {
//       return res.status(404).json({
//         success: false,
//         message: "Shop not found",
//       });
//     }

//     if (shop.isVerified) {
//       return res.status(400).json({
//         success: false,
//         message: "Shop is already verified",
//       });
//     }

//     // If marked as admin shop, set premium plan and clear payment data
//     if (isAdminShop === true) {
//       shop.isAdminShop = true;
//       shop.plan = "professional"; // Set to premium/professional plan

//       // Clear payment information
//       shop.paymentInfo = {
//         last4: undefined,
//         cardName: undefined,
//         expiry: undefined,
//         paymentToken: undefined,
//       };

//       // Clear subscription information
//       shop.subscription = {
//         customerId: undefined,
//         subscriptionId: undefined,
//         planAmount: 0,
//         billingCycle: "monthly",
//         nextBillingDate: undefined,
//         status: "active", // Set to active since admin shop doesn't need payment
//       };

//       // Set trial end date far in the future or null (admin shops don't have trial limitations)
//       shop.trialEndDate = new Date("2099-12-31");
//     }

//     // Use the model method to approve shop
//     await shop.approveShop();
//     // Send approval email
//     await sendEmail(
//       shop.email,
//       "Your Shop Registration Has Been Approved!",
//       `
//     <h2>🎉 Congratulations, ${shop.businessName}!</h2>
//     <p>Your shop registration request has been successfully reviewed and <strong>approved</strong>.</p>

//     <p>You can now access all features available to your account.</p>

//     ${shop.isAdminShop ? `
//       <p>Your shop has been granted <strong>Admin Shop</strong> privileges with a Professional Plan, free of cost.</p>
//     ` : ""}

//     <p>If you have any questions, feel free to reply to this email.</p>

//     <br/>
//     <p>Best regards,<br/>Support Team</p>
//   `
//     );


//     res.status(200).json({
//       success: true,
//       message: isAdminShop
//         ? "Shop verified as Admin Shop and approved successfully"
//         : "Shop verified and approved successfully",
//       data: {
//         shopId: shop._id,
//         businessName: shop.businessName,
//         isVerified: shop.isVerified,
//         isAdminShop: shop.isAdminShop,
//         plan: shop.plan,
//         status: shop.status,
//         verifiedAt: shop.verifiedAt,
//       },
//     });
//   } catch (error) {
//     console.error("Error accepting shop:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to accept shop",
//       error: error.message,
//     });
//   }
// };



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
      plan = 'professional', // Default to professional plan for admin-created shops
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

    // Generate random password
    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

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
      plan,
      // For admin-created shops, set them as automatically verified
      isEmailVerified: true,
      isVerified: true,
      verifiedAt: new Date(),
      status: 'active',
      // Since admin is creating, they accept policies on behalf
      acceptedPolicy: true,
      policyAcceptedAt: new Date(),
      // Set trial end date to far in the future (admin shops don't have trial limitations)
      trialEndDate: new Date('2099-12-31'),
      // No payment required for admin-created shops
      subscription: {
        status: 'active',
        planAmount: plan === 'professional' ? 200 : 50,
        billingCycle: 'monthly',
        nextBillingDate: null // No billing for admin-created shops
      },
      isAdminShop: true
    };

    // Create the shop
    const shop = await Shop.create(shopData);

    // Send welcome email with login credentials
    const emailSubject = `Welcome to Our Platform - Your Shop Account is Ready!`;
    const emailBody = `
      <h2>🎉 Welcome, ${ownerName}!</h2>
      <p>Your shop <strong>${businessName}</strong> has been created by our admin team and is now active on our platform.</p>
      
      <h3>Your Login Credentials:</h3>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Password:</strong> ${randomPassword}</p>
      <p><strong>Important:</strong> Please change your password after your first login.</p>
      
      <h3>Shop Details:</h3>
      <ul>
        <li><strong>Plan:</strong> ${plan === 'professional' ? 'Professional Plan' : 'Basic Plan'}</li>
        <li><strong>Status:</strong> Active and Verified</li>
        <li><strong>Verification:</strong> No additional verification required</li>
      </ul>
      
      <p>You can now log in to your dashboard and start using all available features.</p>
      
      <p>If you have any questions, feel free to reply to this email.</p>
      
      <br/>
      <p>Best regards,<br/>Support Team</p>
    `;

    // Send email (wrap in try-catch to not fail the whole process if email fails)
    try {
      await sendEmail(email, emailSubject, emailBody);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the whole request if email fails
    }

    // Return success response (without password)
    const shopResponse = shop.toObject();
    delete shopResponse.password;

    res.status(201).json({
      success: true,
      message: 'Shop created successfully by admin',
      data: {
        shop: shopResponse,
        temporaryPassword: randomPassword, // Only returned in this response for admin reference
        credentialsSent: true
      }
    });

  } catch (error) {
    console.error('Error creating shop by admin:', error);
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

    // Use the model method to approve shop
    await shop.approveShop();
    
    // Send approval email
    await sendEmail(
      shop.email,
      "Your Shop Registration Has Been Approved!",
      `
    <h2>🎉 Congratulations, ${shop.businessName}!</h2>
    <p>Your shop registration request has been successfully reviewed and <strong>approved</strong>.</p>

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
        status: shop.status,
        verifiedAt: shop.verifiedAt,
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





// Reject a shop (hard delete)
export const rejectShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { reason } = req.body; // Admin rejection reason

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

    // Store details before deleting (needed for email)
    const { email, businessName } = shop;

    // ❌ Delete shop completely
    await Shop.findByIdAndDelete(shopId);

    // 📧 Send rejection email with admin reason
    await sendEmail(
      email,
      "Your Shop Registration Was Rejected",
      `
        <h2>Hello ${businessName},</h2>

        <p>Thank you for registering your shop with us.</p>

        <p>After reviewing your application, we regret to inform you that your shop registration has been <strong>rejected</strong>.</p>

        ${
          reason
            ? `<p><strong>Reason provided by admin:</strong> ${reason}</p>`
            : `<p><strong>Reason:</strong> The provided information did not meet our requirements.</p>`
        }

        <p>You may correct the issues and <strong>register again</strong> using the same email.</p>

        <p>If you believe this was a mistake, feel free to contact our support team.</p>

        <br/>
        <p>Best regards,<br/>Support Team</p>
      `
    );

    return res.status(200).json({
      success: true,
      message: "Shop rejected and deleted successfully",
      data: {
        shopId,
        businessName,
        reason: reason || "No reason provided",
      },
    });
  } catch (error) {
    console.error("Error rejecting shop:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject shop",
      error: error.message,
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
    const { page = 1, limit = 12, verified } = req.query;

    // Build query based on verification filter
    const query = {};
    if (verified === "true") {
      query.isEmailVerified = true;
    } else if (verified === "false") {
      query.isEmailVerified = false;
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

    console.log(id);

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

    // Combine response
    const customerData = {
      ...customer,
      totalBids,
      completedBids,
      activeBids,
      inProgressBids,
      successRate,
      status: customer.isEmailVerified ? "active" : "pending",
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











// export const getShopStats = async (req, res) => {
//   try {
//     const totalShops = await Shop.countDocuments({ isVerified: true });
//     const basicShops = await Shop.countDocuments({
//       isVerified: true,
//       plan: "basic"
//     });
//     const professionalShops = await Shop.countDocuments({
//       isVerified: true,
//       plan: "professional"
//     });
//     const pendingShops = await Shop.countDocuments({ isVerified: false });

//     // Get total completed bids across all shops
//     const totalCompletedBids = await Bid.countDocuments({
//       status: "completed"
//     });

//     // Get average rating across all shops
//     const shops = await Shop.find({ isVerified: true }).select("rating reviewCount");
//     const avgRating = shops.length > 0
//       ? shops.reduce((sum, shop) => sum + shop.rating, 0) / shops.length
//       : 0;

//     res.status(200).json({
//       success: true,
//       data: {
//         total: totalShops,
//         basic: basicShops,
//         professional: professionalShops,
//         pending: pendingShops,
//         totalCompletedBids,
//         averageRating: Math.round(avgRating * 10) / 10,
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching shop stats:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch shop statistics",
//       error: error.message,
//     });
//   }
// };

// // Get all verified shops with pagination and bid statistics
// export const getAllShops = async (req, res) => {
//   try {
//     const { page = 1, limit = 12, plan, verified = "true" } = req.query;

//     // Build query
//     const query = {};

//     // Filter by verification status
//     if (verified === "true") {
//       query.isVerified = true;
//       query.status = "active";
//     } else if (verified === "false") {
//       query.isVerified = false;
//     }

//     // Filter by plan type
//     if (plan && (plan === "basic" || plan === "professional")) {
//       query.plan = plan;
//     }

//     // Fetch shops with pagination
//     const shops = await Shop.find(query)
//       .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry -paymentInfo.paymentToken")
//       .sort({ createdAt: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit)
//       .lean();

//     // Get bid statistics and reviews for each shop
//     const shopsWithStats = await Promise.all(
//       shops.map(async (shop) => {
//         // Count total bids received
//         const totalBids = await Bid.countDocuments({
//           currentShopId: shop._id
//         });

//         // Count completed bids
//         const completedBids = await Bid.countDocuments({
//           currentShopId: shop._id,
//           status: "completed",
//         });

//         // Count active bids
//         const activeBids = await Bid.countDocuments({
//           currentShopId: shop._id,
//           status: "active",
//         });

//         // Count in-progress bids
//         const inProgressBids = await Bid.countDocuments({
//           currentShopId: shop._id,
//           status: "in_progress",
//         });

//         // Get review count and rating (already in shop model)
//         const reviewCount = shop.reviewCount || 0;
//         const rating = shop.rating || 0;

//         return {
//           ...shop,
//           statistics: {
//             totalBids,
//             completedBids,
//             activeBids,
//             inProgressBids,
//             reviewCount,
//             rating,
//             successRate: totalBids > 0 ? Math.round((completedBids / totalBids) * 100) : 0,
//           },
//         };
//       })
//     );

//     const count = await Shop.countDocuments(query);

//     res.status(200).json({
//       success: true,
//       message: "Shops fetched successfully",
//       data: shopsWithStats,
//       pagination: {
//         totalPages: Math.ceil(count / limit),
//         currentPage: parseInt(page),
//         totalShops: count,
//         limit: parseInt(limit),
//         hasMore: page * limit < count,
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching shops:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch shops",
//       error: error.message,
//     });
//   }
// };




export const getShopStats = async (req, res) => {
  try {
    const totalShops = await Shop.countDocuments({ isVerified: true });
    const basicShops = await Shop.countDocuments({
      isVerified: true,
      plan: "basic"
    });
    const professionalShops = await Shop.countDocuments({
      isVerified: true,
      plan: "professional"
    });
    const pendingShops = await Shop.countDocuments({ isVerified: false });
    
    // ADDED: Count blocked and active shops
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
    const shops = await Shop.find({ isVerified: true }).select("rating reviewCount");
    const avgRating = shops.length > 0
      ? shops.reduce((sum, shop) => sum + shop.rating, 0) / shops.length
      : 0;

    res.status(200).json({
      success: true,
      data: {
        total: totalShops,
        basic: basicShops,
        professional: professionalShops,
        pending: pendingShops,
        active: activeShops, // ADDED
        blocked: blockedShops, // ADDED
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
      // REMOVED: Don't hardcode status to "active"
      // query.status = "active";
    } else if (verified === "false") {
      query.isVerified = false;
    }

    // Filter by plan type
    if (plan && (plan === "basic" || plan === "professional")) {
      query.plan = plan;
    }

    // ADDED: Filter by block status
    if (status) {
      if (status === "active") {
        query.isBlocked = false;
      } else if (status === "blocked") {
        query.isBlocked = true;
      }
    }

    // Fetch shops with pagination
    const shops = await Shop.find(query)
      .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry -paymentInfo.paymentToken")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get bid statistics and reviews for each shop
    const shopsWithStats = await Promise.all(
      shops.map(async (shop) => {
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
          // ADDED: Include block status fields
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

    const count = await Shop.countDocuments(query);

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

    // Fetch only necessary fields for map markers
    const shops = await Shop.find(query)
      .select("businessName profilePic address country latitude longitude location rating reviewCount plan")
      .lean();

    // Filter shops that have valid coordinates
    const shopsWithLocation = shops.filter(
      shop =>
        (shop.latitude && shop.longitude) ||
        (shop.location?.coordinates &&
          shop.location.coordinates[0] !== 0 &&
          shop.location.coordinates[1] !== 0)
    );

    // Format data for map
    const mapData = shopsWithLocation.map(shop => ({
      id: shop._id,
      name: shop.businessName,
      profilePic: shop.profilePic,
      address: shop.address,
      country: shop.country,
      rating: shop.rating || 0,
      reviewCount: shop.reviewCount || 0,
      plan: shop.plan,
      coordinates: {
        lat: shop.latitude || shop.location.coordinates[1],
        lng: shop.longitude || shop.location.coordinates[0],
      },
    }));

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

// // Get single shop details with full information
// export const getShopById = async (req, res) => {
//   try {
//     const { shopId } = req.params;

//     const shop = await Shop.findById(shopId)
//       .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry -paymentInfo.paymentToken")
//       .lean();

//     if (!shop) {
//       return res.status(404).json({
//         success: false,
//         message: "Shop not found",
//       });
//     }

//     // Get all bids for this shop
//     const bids = await Bid.find({ currentShopId: shopId })
//       .populate("user_id", "name email phone")
//       .sort({ createdAt: -1 })
//       .lean();

//     // Get all reviews for this shop
//     const reviews = await Review.find({ shop: shopId })
//       .populate("customer", "name avatar")
//       .populate("bid", "vehicleMake vehicleModel")
//       .sort({ createdAt: -1 })
//       .lean();

//     // Calculate statistics
//     const totalBids = bids.length;
//     const completedBids = bids.filter(bid => bid.status === "completed").length;
//     const activeBids = bids.filter(bid => bid.status === "active").length;
//     const inProgressBids = bids.filter(bid => bid.status === "in_progress").length;

//     res.status(200).json({
//       success: true,
//       data: {
//         shop,
//         statistics: {
//           totalBids,
//           completedBids,
//           activeBids,
//           inProgressBids,
//           reviewCount: shop.reviewCount || 0,
//           rating: shop.rating || 0,
//           successRate: totalBids > 0 ? Math.round((completedBids / totalBids) * 100) : 0,
//         },
//         recentBids: bids.slice(0, 10), // Last 10 bids
//         reviews: reviews.slice(0, 10), // Last 10 reviews
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching shop details:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch shop details",
//       error: error.message,
//     });
//   }
// };


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

    // Find shop by ID
    const shop = await Shop.findById(shopId).select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry");

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Calculate statistics for this shop based on currentShopId
    const statistics = await Bid.aggregate([
      { $match: { currentShopId: new mongoose.Types.ObjectId(shopId) } },
      {
        $group: {
          _id: null,
          totalBids: { $sum: 1 },
          // Check for bids that are in progress (assigned to this shop)
          inProgressBids: {
            $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] },
          },
          // Check for completed bids
          completedBids: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          // Check for active bids that this shop might be bidding on
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

    // If you want to include all bids that this shop has made offers on,
    // you might need to look at the Offer model instead
    // Here's an alternative approach if you want to count bids where shop has made offers:
    // const shopOffersStats = await Offer.aggregate([
    //   { $match: { shopId: new mongoose.Types.ObjectId(shopId) } },
    //   {
    //     $lookup: {
    //       from: "bids",
    //       localField: "bidId",
    //       foreignField: "_id",
    //       as: "bid"
    //     }
    //   },
    //   { $unwind: "$bid" },
    //   {
    //     $group: {
    //       _id: "$bid.status",
    //       count: { $sum: 1 }
    //     }
    //   }
    // ]);

    // Extract statistics
    const statsResult = statistics[0] || {
      totalBids: 0,
      inProgressBids: 0,
      completedBids: 0,
      activeBids: 0
    };

    // Calculate success rate if there are any bids
    const successRate = statsResult.totalBids > 0 
      ? (statsResult.completedBids / statsResult.totalBids) * 100 
      : 0;

    const shopData = {
      ...shop.toObject(),
      statistics: {
        totalBids: statsResult.totalBids,
        completedBids: statsResult.completedBids,
        activeBids: statsResult.activeBids,
        inProgressBids: statsResult.inProgressBids,
        successRate: Math.round(successRate),
        rating: shop.rating || 0,
        reviewCount: shop.reviewCount || 0,
      },
    };

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

    // Calculate additional statistics
    const enrichedBid = {
      ...bid,
      totalOffers: bid.offers?.length || 0,
      acceptedPrice: bid.acceptedOffer?.price || null,
      isExpired: bid.status === "active" ? checkIfExpired(bid) : false,
      counterOffersCount: bid.offers?.reduce(
        (acc, offer) => acc + (offer.counterOffers?.length || 0),
        0
      ),
      // Calculate average offer price
      averageOfferPrice: bid.offers?.length > 0 
        ? Math.round(bid.offers.reduce((sum, offer) => sum + (offer.price || 0), 0) / bid.offers.length)
        : 0,
      // Get highest and lowest offers
      highestOffer: bid.offers?.length > 0 
        ? Math.max(...bid.offers.map(offer => offer.price || 0))
        : 0,
      lowestOffer: bid.offers?.length > 0 
        ? Math.min(...bid.offers.map(offer => offer.price || 0))
        : 0,
    };

    res.status(200).json({
      success: true,
      data: enrichedBid,
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







// Block/Unblock shop controller
export const toggleBlockShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { blocked, reason } = req.body;

    const shop = await Shop.findById(shopId);
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }
    
    if (blocked === true) {
      // Block the shop
      shop.isBlocked = true;
      shop.status = "blocked";
      shop.blockedAt = new Date();
      shop.blockedReason = reason || "";
      
      await shop.save();
      
      // Optional: Cancel all active bids for this shop
      // await Bid.updateMany(
      //   { currentShopId: shopId, status: { $in: ["active", "in_progress"] } },
      //   { 
      //     status: "cancelled", 
      //     cancellationReason: "Shop blocked by admin",
      //     cancelledAt: new Date() 
      //   }
      // );
      
      res.status(200).json({
        success: true,
        message: 'Shop blocked successfully',
        data: shop
      });
    } else if (blocked === false) {
      // Unblock the shop
      shop.isBlocked = false;
      shop.status = "active";
      shop.lastUnblockedAt = new Date();
      
      await shop.save();
      
      res.status(200).json({
        success: true,
        message: 'Shop unblocked successfully',
        data: shop
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. "blocked" field is required (true/false)'
      });
    }
  } catch (error) {
    console.error('Error updating shop block status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating shop status',
      error: error.message
    });
  }
};