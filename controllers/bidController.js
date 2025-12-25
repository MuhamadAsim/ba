import Bid from "../models/bidModel.js";
import Customer from "../models/customerModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import Event from "../models/eventModel.js";
import { notifyShopsForBid } from "../utils/notifyShops.js";
import Shop from "../models/shopModel.js";






export const createBid = async (req, res) => {
  try {
    const {
      vehicleYear,
      vehicleMake,
      vehicleModel,
      requestCategory,
      serviceDescription,
      desiredFinish,
      hasExistingWrap,
      ppfCoverage,
      brandingWrapCoverage,
      hasDesign,
      hasLogo,
      contactMethod,
      dueDate,
      email,
      phone,
      firstName,
      lastName,
      zipCode,
      address,        // Location field
      latitude,       // Location field
      longitude,      // Location field
      country,        // Location field
      vehicleTrim,
      vehicleCondition,
    } = req.body;

    // Validate essential bid fields
    if (!vehicleYear || !vehicleMake || !vehicleModel || !requestCategory || !serviceDescription || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: Vehicle details, service description, and location coordinates are required"
      });
    }

    // Validate customer contact info (email or phone is required for guest submissions)
    let user = req.user;

    // For guest submissions, check if email or phone is provided
    if (!user && !email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Email or phone number is required for guest submissions"
      });
    }

    const vehicleImages = (req.files?.["vehicleImages"] || []).map(f => f.path);
    const artworkFiles = (req.files?.["artworkFiles"] || []).map(f => f.path);
    const exampleFiles = (req.files?.["exampleFiles"] || []).map(f => f.path);

    // Guest submission case
    if (!user) {
      let existingUser = await Customer.findOne({ email });

      if (existingUser) {
        user = existingUser;
      } else {
        // Validate email for new customer creation
        if (!email) {
          return res.status(400).json({
            success: false,
            message: "Email is required to create a new customer account"
          });
        }

        const generatedPassword = crypto.randomBytes(6).toString("hex");
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        user = new Customer({
          name: `${firstName || ""} ${lastName || ""}`.trim(),
          email,
          password: hashedPassword,
          zip: zipCode || "",
          phone: phone || "",
          isAuthenticated: true,
        });

        await user.save();

        const emailContent = `
          <p>Hello ${firstName || "there"},</p>
          <p>Your account was automatically created when you submitted a bid.</p>
          <p><strong>Login Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${generatedPassword}</p>
          <p>You can log in and change your password anytime.</p>
        `;

        // Send welcome email asynchronously (don't wait for it)
        sendEmail(email, "Your New Account Details", emailContent).catch(err => {
          console.error("Failed to send welcome email:", err);
        });
      }
    }

    // ============================================
    // 🚫 CHECK DAILY BID LIMIT (MAX 2 BIDS PER DAY)
    // ============================================
    // Get the start of today (midnight)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Get the end of today (23:59:59)
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Count how many bids this user has created today
    const todaysBidCount = await Bid.countDocuments({
      user_id: user._id,
      createdAt: {
        $gte: startOfToday,
        $lte: endOfToday
      }
    });

    // If user has already created 2 bids today, block new submission
    if (todaysBidCount >= 2) {
      return res.status(429).json({
        success: false,
        message: "Daily limit reached",
        error: `You have already submitted ${todaysBidCount} bids today. The limit is 2 bids per day. Please try again tomorrow.`,
        limit: 2,
        used: todaysBidCount,
        resetsAt: new Date(endOfToday.getTime() + 1).toISOString() // When limit resets
      });
    }

    // Calculate bids remaining for today
    const bidsRemaining = 2 - todaysBidCount;

    // Create the bid with ALL fields including location
    const newBid = new Bid({
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleTrim,
      vehicleCondition,
      requestCategory,
      serviceDescription,
      desiredFinish,
      hasExistingWrap,
      ppfCoverage,
      brandingWrapCoverage,
      hasDesign,
      hasLogo,
      contactMethod,
      dueDate,
      // Location fields (all required from frontend)
      address,
      latitude,
      longitude,
      country,
      zipCode,
      // GeoJSON location field for geospatial queries
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]  // [lng, lat]
      },
      // File uploads
      vehicleImages,
      artworkFiles,
      exampleFiles,
      user_id: user._id,
    });

    await newBid.save();

    // ------------------------------------
    // 🔥 SAVE EVENT (NEW FUNCTIONALITY) - Asynchronously
    // ------------------------------------
    Event.create({
      customerId: user._id,
      shopId: null,
      bidId: newBid._id,
      type: "bid-created",
      title: "New Bid Created",
      message: `A new bid has been submitted.`
    }).catch(err => {
      console.error("Failed to save event:", err);
    });

    // ------------------------------------
    // 🚀 NOTIFY SHOPS ASYNCHRONOUSLY (DON'T WAIT!)
    // ------------------------------------
    // Start shop notifications in the background
    // User doesn't need to wait for this to complete
    notifyShopsForBid(newBid, user).catch(error => {
      console.error("Shop notification failed (non-critical):", error);
      // Don't throw - this is background work
    });

    // 🎯 IMMEDIATE RESPONSE TO USER
    return res.status(201).json({
      success: true,
      message: "✅ Bid submitted successfully",
      data: newBid,
      note: `Local shops are being notified. You'll receive bids within 24-48 hours.`,
      dailyLimit: {
        max: 2,
        used: todaysBidCount + 1, // +1 for this new bid
        remaining: bidsRemaining - 1,
        resetsAt: new Date(endOfToday.getTime() + 1).toISOString()
      }
    });

  } catch (error) {
    console.error("❌ Error creating bid:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating bid",
      error: error.message,
    });
  }
};