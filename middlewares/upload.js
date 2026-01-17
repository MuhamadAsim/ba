import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../configs/cloudinary.js";

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",

  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith("image/");
    const timestamp = Date.now();
    const originalName = file.originalname.split(".")[0];
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9]/g, "_");

    return {
      folder: "chat-files",
      public_id: `chat_${timestamp}_${sanitizedName}`,

      // IMPORTANT: auto handles images + pdf + doc
      resource_type: "auto",

      // Apply transformations ONLY for images
      ...(isImage && {
        transformation: [
          { width: 1920, height: 1080, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" }
        ]
      })
    };
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Allowed: images, PDF, DOC, DOCX"
      ),
      false
    );
  }
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
});

export { upload };
