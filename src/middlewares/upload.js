import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../configs/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "shops", // all uploads will go to Cloudinary folder "shops"
    allowed_formats: ["jpg", "png", "jpeg", "pdf", "doc", "docx"],
    resource_type: "auto", // handles images, PDFs, videos automatically
  },
});

export const upload = multer({ storage });
