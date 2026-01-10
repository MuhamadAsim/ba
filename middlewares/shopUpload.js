// middlewares/shopUpload.js - Create this new file
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../configs/cloudinary.js";

// Create a custom filename generator
const generatePublicId = (file) => {
  const timestamp = Date.now();
  // Generate a random string to avoid collisions
  const randomString = Math.random().toString(36).substring(2, 15);
  // Get filename without extension and limit length
  let originalName = file.originalname.split('.')[0] || 'file';
  originalName = originalName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  
  // Final public_id should be less than 255 chars
  return `${originalName}_${timestamp}_${randomString}`;
};

const shopStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const isImage = file.mimetype.startsWith('image/');
    
    // Generate safe public_id
    const publicId = generatePublicId(file);
    
    console.log(`Uploading file: ${file.originalname}, public_id: ${publicId}, type: ${isImage ? 'image' : 'raw'}`);
    
    return {
      folder: "shop-uploads",
      allowed_formats: isImage 
        ? ["jpg", "png", "jpeg", "gif", "webp"]
        : ["pdf"],
      resource_type: isImage ? "image" : "raw",
      transformation: isImage ? [
        { width: 1920, height: 1080, crop: "limit" },
        { quality: "auto" },
        { fetch_format: "auto" }
      ] : undefined,
      public_id: publicId,
      // Add timeout for large files
      timeout: 60000, // 60 seconds
    };
  },
});

// File filter for shop uploads
const shopFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
    "application/pdf"
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only images and PDFs are allowed.`), false);
  }
};

// Create shop-specific upload middleware
export const shopUpload = multer({
  storage: shopStorage,
  fileFilter: shopFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // Allow more files
  },
});

// Separate middleware for single file uploads
export const shopSingleUpload = (fieldName) => shopUpload.single(fieldName);