// middlewares/upload.js
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../configs/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "chat-images", // Change to specific folder for chat images
    allowed_formats: ["jpg", "png", "jpeg", "gif", "webp"],
    resource_type: "image", // Explicitly set to image only
    transformation: [
      { width: 1920, height: 1080, crop: "limit" },
      { quality: "auto" },
      { fetch_format: "auto" }
    ],
    // This ensures we get the public_id in the response
    public_id: (req, file) => {
      // Generate unique public_id with timestamp
      const timestamp = Date.now();
      const originalName = file.originalname.split('.')[0];
      const sanitizedName = originalName.replace(/[^a-zA-Z0-9]/g, '_');
      return `chat_${timestamp}_${sanitizedName}`;
    }
  },
});

// File filter for image validation
const fileFilter = (req, file, cb) => {
  // Accept only image files
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only images are allowed."), false);
  }
};

// Create multer instance with limits
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 5 // Max 5 files at once
  },
});

export { upload };





