import express from "express";
import { upload } from "../middlewares/upload.js";
import { authenticateAdmin } from "../middlewares/adminAuthMiddleware.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  likeBlog,
  uploadBlogImage,
} from "../controllers/blogController.js";

const router = express.Router();

// SPECIFIC ROUTES FIRST (to avoid /:id conflicts)

// Image upload endpoint - Admin only
router.post("/blog-image", upload.single("image"), authenticateAdmin, uploadBlogImage);

// Admin only routes (create, update, delete)
router.post("/", authenticateAdmin, createBlog);
router.put("/:id", authenticateAdmin, updateBlog);
router.delete("/:id", authenticateAdmin, deleteBlog);

// GENERAL ROUTES LAST

// Public routes (anyone can view blogs)
router.get("/", getAllBlogs);
router.get("/:id", getBlogById);

// Protected routes (authenticated users/shops can like)
router.post("/:id/like", authMiddleware, likeBlog);

export default router;