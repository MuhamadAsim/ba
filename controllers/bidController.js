import Bid from "../models/bidModel.js";
import Customer from "../models/customerModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import Event from "../models/eventModel.js";
import { notifyShopsForBid } from "../utils/notifyShops.js";

export const createBid = async (req, res) => {
  try {
    const {
      // Vehicle Details
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleTrim,
      vehicleCondition,
      
      // Service Request
      requestCategory,
      serviceDescription,
      
      // Color Wrap & PPF fields
      desiredFinish,
      hasExistingWrap,
      wrapCoverage,
      wrapType,
      desiredColor,
      
      // Business Wrap fields
      brandingWrapCoverage,
      hasDesign,
      hasLogo,
      
      // Window Tinting fields
      hasExistingTint,
      tintCoverage,
      tintType,
      
      // Ceramic Coating fields
      paintFinish,
      coatingPackage,
      coverageExterior,
      coverageInterior,
      coverageGlassTrims,
      coverageWheelsBrakes,
      
      // PPF fields
      ppfCoverage,
      addCeramicCoating,
      
      // Detailing fields
      packageExterior,
      packageInterior,
      packageWheelsBrakes,
      detailLevel,
      
      // Contact Info
      contactMethod,
      dueDate,
      email,
      phone,
      firstName,
      lastName,
      zipCode,
      address,
      latitude,
      longitude,
      country,
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

    // Process file uploads
    const vehicleImages = (req.files?.["vehicleImages"] || []).map(f => f.path);
    const artworkFiles = (req.files?.["artworkFiles"] || []).map(f => f.path);
    const exampleFiles = (req.files?.["exampleFiles"] || []).map(f => f.path);
    const coatingPhotos = (req.files?.["coatingPhotos"] || []).map(f => f.path);
    const ppfPhotos = (req.files?.["ppfPhotos"] || []).map(f => f.path);
    const detailPhotos = (req.files?.["detailPhotos"] || []).map(f => f.path);

    // Guest submission case
    if (!user) {
      let existingUser = await Customer.findOne({ email });

      if (existingUser) {
        user = existingUser;
        
        // Check if the existing user is blocked
        if (user.isBlocked) {
          return res.status(403).json({
            success: false,
            message: "Your account has been blocked. Please contact support for assistance."
          });
        }
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
          isBlocked: false, // New users are not blocked by default
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
    } else {
      // For logged-in users, check if they're blocked
      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: "Your account has been blocked. Please contact support for assistance."
        });
      }
    }

    // Create the bid with ALL fields
    const newBid = new Bid({
      // Vehicle Details
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleTrim,
      vehicleCondition,
      
      // Service Request
      requestCategory,
      serviceDescription,
      
      // Color Wrap & PPF fields
      desiredFinish,
      hasExistingWrap,
      wrapCoverage,
      wrapType,
      desiredColor,
      
      // Business Wrap fields
      brandingWrapCoverage,
      hasDesign,
      hasLogo,
      
      // Window Tinting fields
      hasExistingTint,
      tintCoverage,
      tintType,
      
      // Ceramic Coating fields
      paintFinish,
      coatingPackage,
      coverageExterior: coverageExterior === 'true' || coverageExterior === true,
      coverageInterior: coverageInterior === 'true' || coverageInterior === true,
      coverageGlassTrims: coverageGlassTrims === 'true' || coverageGlassTrims === true,
      coverageWheelsBrakes: coverageWheelsBrakes === 'true' || coverageWheelsBrakes === true,
      
      // PPF fields
      ppfCoverage,
      addCeramicCoating,
      
      // Detailing fields
      packageExterior: packageExterior === 'true' || packageExterior === true,
      packageInterior: packageInterior === 'true' || packageInterior === true,
      packageWheelsBrakes: packageWheelsBrakes === 'true' || packageWheelsBrakes === true,
      detailLevel,
      
      // Contact Info
      contactMethod,
      dueDate: dueDate ? new Date(dueDate) : null,
      firstName,
      lastName,
      email,
      phone,
      zipCode,
      address,
      latitude,
      longitude,
      country,
      
      // Location field for geospatial queries
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]  // [lng, lat]
      },
      
      // File uploads
      vehicleImages,
      artworkFiles,
      exampleFiles,
      coatingPhotos,
      ppfPhotos,
      detailPhotos,
      
      user_id: user._id,
      // Add a reference to the user's block status for tracking
      userBlockedAtSubmission: user.isBlocked,
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
      message: `A new bid has been submitted.`,
      metadata: {
        userBlocked: user.isBlocked
      }
    }).catch(err => {
      console.error("Failed to save event:", err);
    });

    // Only notify shops if the user is not blocked
    if (!user.isBlocked) {
      // ------------------------------------
      // 🚀 NOTIFY SHOPS ASYNCHRONOUSLY (DON'T WAIT!)
      // ------------------------------------
      // Start shop notifications in the background
      // User doesn't need to wait for this to complete
      notifyShopsForBid(newBid, user).catch(error => {
        console.error("Shop notification failed (non-critical):", error);
        // Don't throw - this is background work
      });
    } else {
      console.warn(`Bid ${newBid._id} created by blocked user ${user._id}. Shops will not be notified.`);
    }

    // 🎯 IMMEDIATE RESPONSE TO USER
    return res.status(201).json({
      success: true,
      message: user.isBlocked 
        ? "✅ Bid submitted successfully but account is blocked. Please contact support to restore access." 
        : "✅ Bid submitted successfully",
      data: newBid,
      note: user.isBlocked 
        ? "Your account is currently blocked. Please contact support to restore access to platform features."
        : `Local shops are being notified. You'll receive bids within 24-48 hours.`,
      userBlocked: user.isBlocked
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