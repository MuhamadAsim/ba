import express from "express";
import multer from "multer";
import {
  // Shop routes
  getShopConversations,
  getConversationDetails,
  sendShopReply,
  createShopConversation,
  
  // Admin routes (you need to create these)
  getAdminConversations,
  getAdminConversationDetails,
  sendAdminReply,
  updateConversationStatus,
  updateConversationAssignment
} from "../controllers/adminSupportController.js";
import { authenticateShop } from "../middlewares/authShopMiddleware.js";
import { authenticateAdmin } from "../middlewares/adminAuthMiddleware.js";

const router = express.Router();

// Configure multer for memory storage (for Cloudinary upload)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
  fileFilter: (req, file, cb) => {
    // Accept images and common document types
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and documents are allowed.'));
    }
  }
});

const uploadAttachments = upload.array("attachments", 5); // Max 5 files

// ==================== SHOP ROUTES ====================
router.get("/shop/conversations", authenticateShop, getShopConversations);
router.get("/shop/conversations/:conversationId", authenticateShop, getConversationDetails);
router.post("/shop/conversations", authenticateShop, uploadAttachments, createShopConversation);
router.post("/shop/conversations/:conversationId/messages", authenticateShop, uploadAttachments, sendShopReply);

// ==================== ADMIN ROUTES ====================
router.get("/admin/conversations", authenticateAdmin, getAdminConversations);
router.get("/admin/conversations/:conversationId", authenticateAdmin, getAdminConversationDetails);
router.post("/admin/conversations/:conversationId/messages", authenticateAdmin, uploadAttachments, sendAdminReply);
router.put("/admin/conversations/:conversationId", authenticateAdmin, updateConversationStatus);
router.put("/admin/conversations/:conversationId/assign", authenticateAdmin, updateConversationAssignment);

export default router;