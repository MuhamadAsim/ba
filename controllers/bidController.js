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
      note: `Local shops are being notified. You'll receive bids within 24-48 hours.`
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