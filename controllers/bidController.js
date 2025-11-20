import Bid from "../models/bidModel.js";
import Customer from "../models/customerModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import Event from "../models/eventModel.js"






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
      email,
      firstName,
      lastName,
      zipCode,
    } = req.body;

    const vehicleImages = (req.files?.["vehicleImages"] || []).map(f => f.path);
    const artworkFiles = (req.files?.["artworkFiles"] || []).map(f => f.path);
    const exampleFiles = (req.files?.["exampleFiles"] || []).map(f => f.path);

    let user = req.user;

    // Guest submission case
    if (!user) {
      let existingUser = await Customer.findOne({ email });

      if (existingUser) {
        user = existingUser;
      } else {
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

    // Create the bid
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

    // ------------------------------------
    // 🔥 SAVE EVENT (NEW FUNCTIONALITY)
    // ------------------------------------
    await Event.create({
      customerId: user._id,             // correct field name
      shopId: null,                     // no shop involved yet
      bidId: newBid._id,
      type: "bid-created",              // valid enum type
      title: "New Bid Created",
      message: "A new bid has been submitted by the customer.",
    });

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











