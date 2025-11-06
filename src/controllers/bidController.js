import Bid from "../models/bidModel.js";

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

    // Extract file paths from multer
    const vehicleImages = (req.files["vehicleImages"] || []).map(f => f.path);
    const artworkFiles = (req.files["artworkFiles"] || []).map(f => f.path);
    const exampleFiles = (req.files["exampleFiles"] || []).map(f => f.path);

    // Create and save the bid
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
    });

    await newBid.save();

    res.status(201).json({
      success: true,
      message: "Bid submitted successfully",
      data: newBid,
    });
  } catch (error) {
    console.error("Error creating bid:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};