import jwt from "jsonwebtoken";
import crypto from "crypto";
import Shop from "../models/shopModel.js";
import Customer from "../models/customerModel.js";
import Bid from "../models/bidModel.js";
import Event from "../models/eventModel.js";
import VerificationRequest from "../models/updateProfileModel.js";
import { sendEmail } from "../utils/sendEmail.js";





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
};
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

    await sendEmail({ to: email, subject, text, html });

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







// Accept/Verify a shop
export const acceptShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { isAdminShop } = req.body;

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

    // If marked as admin shop, set premium plan and clear payment data
    if (isAdminShop === true) {
      shop.isAdminShop = true;
      shop.plan = "professional"; // Set to premium/professional plan

      // Clear payment information
      shop.paymentInfo = {
        last4: undefined,
        cardName: undefined,
        expiry: undefined,
        paymentToken: undefined,
      };

      // Clear subscription information
      shop.subscription = {
        customerId: undefined,
        subscriptionId: undefined,
        planAmount: 0,
        billingCycle: "monthly",
        nextBillingDate: undefined,
        status: "active", // Set to active since admin shop doesn't need payment
      };

      // Set trial end date far in the future or null (admin shops don't have trial limitations)
      shop.trialEndDate = new Date("2099-12-31");
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

    ${shop.isAdminShop ? `
      <p>Your shop has been granted <strong>Admin Shop</strong> privileges with a Professional Plan, free of cost.</p>
    ` : ""}

    <p>If you have any questions, feel free to reply to this email.</p>

    <br/>
    <p>Best regards,<br/>Support Team</p>
  `
    );


    res.status(200).json({
      success: true,
      message: isAdminShop
        ? "Shop verified as Admin Shop and approved successfully"
        : "Shop verified and approved successfully",
      data: {
        shopId: shop._id,
        businessName: shop.businessName,
        isVerified: shop.isVerified,
        isAdminShop: shop.isAdminShop,
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

// Reject a shop
export const rejectShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { reason } = req.body; // Optional rejection reason

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

    // Update shop status to suspended or you can delete it
    shop.status = "suspended";
    shop.isVerified = false;

    // You could add a rejectionReason field to the schema if needed
    // shop.rejectionReason = reason;

    await shop.save();


    // Send rejection email
    await sendEmail(
      shop.email,
      "Your Shop Registration Request Was Not Approved",
      `
    <h2>Hello ${shop.businessName},</h2>
    <p>We have reviewed your shop registration request. Unfortunately, we are unable to approve it at this time.</p>

    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}

    <p>You may fix the issues and reapply anytime.</p>

    <p>If you believe this was a mistake or want more details, feel free to contact our support team.</p>

    <br/>
    <p>Best regards,<br/>Support Team</p>
  `
    );




    res.status(200).json({
      success: true,
      message: "Shop rejected successfully",
      data: {
        shopId: shop._id,
        businessName: shop.businessName,
        status: shop.status,
        reason: reason || "No reason provided",
      },
    });
  } catch (error) {
    console.error("Error rejecting shop:", error);
    res.status(500).json({
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

// Get single customer details with full bid history
export const getCustomerById = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId)
      .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry")
      .lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Get all bids for this customer
    const bids = await Bid.find({ user_id: customerId })
      .populate("currentShopId", "businessName email phone")
      .populate("acceptedOffer")
      .sort({ createdAt: -1 })
      .lean();

    // Calculate statistics
    const totalBids = bids.length;
    const completedBids = bids.filter(bid => bid.status === "completed").length;
    const activeBids = bids.filter(bid => bid.status === "active").length;
    const inProgressBids = bids.filter(bid => bid.status === "in_progress").length;

    res.status(200).json({
      success: true,
      data: {
        customer: {
          ...customer,
          status: customer.isEmailVerified ? "active" : "pending",
        },
        statistics: {
          totalBids,
          completedBids,
          activeBids,
          inProgressBids,
          successRate: totalBids > 0 ? Math.round((completedBids / totalBids) * 100) : 0,
        },
        bids,
      },
    });
  } catch (error) {
    console.error("Error fetching customer details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer details",
      error: error.message,
    });
  }
};














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
    const { page = 1, limit = 12, plan, verified = "true" } = req.query;

    // Build query
    const query = {};

    // Filter by verification status
    if (verified === "true") {
      query.isVerified = true;
      query.status = "active";
    } else if (verified === "false") {
      query.isVerified = false;
    }

    // Filter by plan type
    if (plan && (plan === "basic" || plan === "professional")) {
      query.plan = plan;
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

// Get single shop details with full information
export const getShopById = async (req, res) => {
  try {
    const { shopId } = req.params;

    const shop = await Shop.findById(shopId)
      .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry -paymentInfo.paymentToken")
      .lean();

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Get all bids for this shop
    const bids = await Bid.find({ currentShopId: shopId })
      .populate("user_id", "name email phone")
      .sort({ createdAt: -1 })
      .lean();

    // Get all reviews for this shop
    const reviews = await Review.find({ shop: shopId })
      .populate("customer", "name avatar")
      .populate("bid", "vehicleMake vehicleModel")
      .sort({ createdAt: -1 })
      .lean();

    // Calculate statistics
    const totalBids = bids.length;
    const completedBids = bids.filter(bid => bid.status === "completed").length;
    const activeBids = bids.filter(bid => bid.status === "active").length;
    const inProgressBids = bids.filter(bid => bid.status === "in_progress").length;

    res.status(200).json({
      success: true,
      data: {
        shop,
        statistics: {
          totalBids,
          completedBids,
          activeBids,
          inProgressBids,
          reviewCount: shop.reviewCount || 0,
          rating: shop.rating || 0,
          successRate: totalBids > 0 ? Math.round((completedBids / totalBids) * 100) : 0,
        },
        recentBids: bids.slice(0, 10), // Last 10 bids
        reviews: reviews.slice(0, 10), // Last 10 reviews
      },
    });
  } catch (error) {
    console.error("Error fetching shop details:", error);
    res.status(500).json({
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

// // ============================================
// // ADMIN: Approve Verification Request
// // ============================================
// export const approveVerificationRequest = async (req, res) => {
//   try {
//     const { requestId } = req.params;
//     const adminId = req.admin._id; // From authenticateAdmin middleware
//     const { adminNotes } = req.body;

//     const request = await VerificationRequest.findById(requestId);

//     if (!request) {
//       return res.status(404).json({
//         status: "error",
//         message: "Verification request not found",
//       });
//     }

//     if (request.status !== "pending") {
//       return res.status(400).json({
//         status: "error",
//         message: `Request has already been ${request.status}`,
//       });
//     }

//     // Add admin notes if provided
//     if (adminNotes) {
//       request.adminNotes = adminNotes;
//     }

//     // Approve and update shop
//     await request.approveAndUpdateShop(adminId);

//     res.json({
//       status: "success",
//       message: "Verification request approved and shop information updated",
//       data: {
//         requestId: request._id,
//         status: request.status,
//         reviewedAt: request.reviewedAt,
//       },
//     });
//   } catch (error) {
//     console.error("Approve verification request error:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Failed to approve verification request",
//       error: error.message,
//     });
//   }
// };

// // ============================================
// // ADMIN: Reject Verification Request
// // ============================================
// export const rejectVerificationRequest = async (req, res) => {
//   try {
//     const { requestId } = req.params;
//     const adminId = req.admin._id; // From authenticateAdmin middleware
//     const { rejectionReason, adminNotes } = req.body;

//     if (!rejectionReason) {
//       return res.status(400).json({
//         status: "error",
//         message: "Rejection reason is required",
//       });
//     }

//     const request = await VerificationRequest.findById(requestId);

//     if (!request) {
//       return res.status(404).json({
//         status: "error",
//         message: "Verification request not found",
//       });
//     }

//     if (request.status !== "pending") {
//       return res.status(400).json({
//         status: "error",
//         message: `Request has already been ${request.status}`,
//       });
//     }

//     // Add admin notes if provided
//     if (adminNotes) {
//       request.adminNotes = adminNotes;
//     }

//     // Reject the request
//     await request.rejectRequest(adminId, rejectionReason);

//     res.json({
//       status: "success",
//       message: "Verification request rejected",
//       data: {
//         requestId: request._id,
//         status: request.status,
//         rejectionReason: request.rejectionReason,
//         reviewedAt: request.reviewedAt,
//       },
//     });
//   } catch (error) {
//     console.error("Reject verification request error:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Failed to reject verification request",
//       error: error.message,
//     });
//   }
// };




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

        ${
          adminNotes
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

        ${
          adminNotes
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