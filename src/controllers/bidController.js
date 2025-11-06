import Bid from "../models/bidModel.js";
import Customer from "../models/customerModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";

export const createBid = async (req, res) => {
  try {
    const {
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
      email, // still needed for guest submissions
      firstName,
      lastName,
      zipCode,
    } = req.body;

    // Extract file paths from Multer uploads
    const vehicleImages = (req.files?.["vehicleImages"] || []).map(f => f.path);
    const artworkFiles = (req.files?.["artworkFiles"] || []).map(f => f.path);
    const exampleFiles = (req.files?.["exampleFiles"] || []).map(f => f.path);

    let user = req.user; // middleware might attach authenticated user

    // 🔹 Case 1: If user is NOT logged in (guest submission)
    if (!user) {
      // Check if user with given email already exists
      let existingUser = await Customer.findOne({ email });

      if (existingUser) {
        user = existingUser; // reuse existing customer
      } else {
        // Auto-register a new user
        const generatedPassword = crypto.randomBytes(6).toString("hex");
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        user = new Customer({
          name: `${firstName || ""} ${lastName || ""}`.trim(),
          email,
          password: hashedPassword,
          zip: zipCode || "",
          isAuthenticated: true,
        });

        await user.save();

        // Send email with temporary password
        const emailContent = `
          <p>Hello ${firstName || "there"},</p>
          <p>Your account was automatically created when you submitted a bid.</p>
          <p><strong>Login Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${generatedPassword}</p>
          <p>You can log in and change your password anytime.</p>
        `;
        await sendEmail(email, "Your New Account Details", emailContent);
      }
    }

    // 🔹 Case 2: Create the bid linked to user
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
      vehicleImages,
      artworkFiles,
      exampleFiles,
      user_id: user._id,
    });

    await newBid.save();

    return res.status(201).json({
      success: true,
      message: "✅ Bid submitted successfully",
      data: newBid,
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





export const getCustomerBidStats = async (req, res) => {
  try {
    const userId = req.customer?._id || req.params.userId;

    const [active, inProgress, completed, expired, canceled] = await Promise.all([
      Bid.countDocuments({ user_id: userId, status: "active" }),
      Bid.countDocuments({ user_id: userId, status: "in_progress" }),
      Bid.countDocuments({ user_id: userId, status: "completed" }),
      Bid.countDocuments({ user_id: userId, status: "expired" }),
      Bid.countDocuments({ user_id: userId, status: "canceled" }),
    ]);

    const total = active + inProgress + completed + expired + canceled;

    res.json({
      status: "success",
      data: { total, active, inProgress, completed, expired, canceled },
    });
  } catch (error) {
    console.error("Error fetching bid stats:", error);
    res.status(500).json({ status: "error", message: "Server error fetching stats" });
  }
};
