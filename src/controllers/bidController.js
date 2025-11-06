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
      firstName,
      lastName,
      email,
      zipCode,
      contactMethod,
      dueDate,
    } = req.body;

    // Extract file paths from Multer uploads
    const vehicleImages = (req.files["vehicleImages"] || []).map(f => f.path);
    const artworkFiles = (req.files["artworkFiles"] || []).map(f => f.path);
    const exampleFiles = (req.files["exampleFiles"] || []).map(f => f.path);

    let user = req.user; // if logged in (middleware sets req.user)

    if (!user) {
      // Check if email already exists
      const existingUser = await Customer.findOne({ email });

      if (existingUser) {
        user = existingUser;
      } else {
        // ✅ Automatically register new customer
        const generatedPassword = crypto.randomBytes(6).toString("hex"); // 12 chars password
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        user = new Customer({
          name: `${firstName} ${lastName}`,
          email,
          password: hashedPassword,
          phone: "",
          address: "",
          zip: zipCode,
          isAuthenticated: true,
        });

        await user.save();

        // ✅ Email auto-generated password
        const emailContent = `
          <p>Hello ${firstName},</p>
          <p>Your account has been created automatically while submitting your bid.</p>
          <p><strong>Login Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${generatedPassword}</p>
          <p>You can login and change your password later.</p>
        `;
        await sendEmail(email, "Your New Account Details", emailContent);
      }
    }

    // ✅ Create bid now associated with user
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
      firstName,
      lastName,
      email,
      zipCode,
      contactMethod,
      dueDate,
      vehicleImages,
      artworkFiles,
      exampleFiles,
      user_id: user._id, // add this field in Bid schema
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
      message: "Server error",
      error: error.message,
    });
  }
};
