import express from "express";
import { upload } from "../middlewares/upload.js";
import {
  getHeroContent,
  createHeroContent,
  updateHeroContent,
  uploadHeroImages,
  getFeaturesContent,
  createFeaturesContent,
  updateFeaturesContent,
  uploadFeaturesImages,
  getAboutUsContent,
  createAboutUsContent,
  updateAboutUsContent,
  uploadAboutUsImages,
  getJoinNetworkContent,
  createJoinNetworkContent,
  updateJoinNetworkContent,
  uploadJoinNetworkImage,
} from "../controllers/frontendController.js";


import { authenticateAdmin } from "../middlewares/adminAuthMiddleware.js";
import multer from "multer"; 

const router = express.Router();


// Increase limits for this specific router
router.use(express.json({ limit: '100mb' }));
router.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Upload middleware configurations
const heroUpload = upload.fields([
  { name: "frontImage", maxCount: 1 },
  { name: "backImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 5 }
]);

const featuresUpload = upload.fields([
  { name: "aboutUsImage", maxCount: 1 },
  { name: "locateShopsImage", maxCount: 1 },
  { name: "joinNetworkImage", maxCount: 1 },
  { name: "faqImage", maxCount: 1 }
]);

// UPDATE ABOUT US UPLOAD TO INCLUDE FLIP CARD IMAGES
const aboutUsUpload = upload.fields([
  { name: "colorChangeWrap", maxCount: 1 },
  { name: "paintProtectionFilm", maxCount: 1 },
  { name: "commercialGraphics", maxCount: 1 },
  { name: "frontImage", maxCount: 1 },      // ADD: Front flip card image
  { name: "backImage", maxCount: 1 }        // ADD: Back flip card image
]);

// NEW: Join Network upload configuration (single hero image)
const joinNetworkUpload = upload.fields([
  { name: "image", maxCount: 1 } // Only need the hero image
]);

// Error handling middleware for uploads
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 20MB per file.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files uploaded.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field.'
      });
    }
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  next();
};

// ===== PUBLIC ROUTES =====
router.get("/hero-content", getHeroContent);
router.get("/features-content", getFeaturesContent);
router.get("/aboutus-content", getAboutUsContent);
router.get("/join-network-content", getJoinNetworkContent); // NEW: Public route

// ===== APPLY AUTHENTICATION TO ALL FOLLOWING ROUTES =====
router.use(authenticateAdmin);

// ===== PROTECTED ADMIN ROUTES =====

// Hero content routes
router.post("/hero-content", createHeroContent);
router.put("/hero-content", updateHeroContent);
router.post("/hero-content/upload", heroUpload, handleUploadError, uploadHeroImages);

// Features content routes
router.post("/features-content", createFeaturesContent);
router.put("/features-content", updateFeaturesContent);
router.post("/features-content/upload", featuresUpload, handleUploadError, uploadFeaturesImages);

// About Us content routes
router.post("/aboutus-content", createAboutUsContent);
router.put("/aboutus-content", updateAboutUsContent);
router.post("/aboutus-content/upload", aboutUsUpload, handleUploadError, uploadAboutUsImages);

// NEW: Join Network content routes
router.post("/join-network-content", createJoinNetworkContent);
router.put("/join-network-content", updateJoinNetworkContent);
router.post("/join-network-content/upload", joinNetworkUpload, handleUploadError, uploadJoinNetworkImage);

export default router;