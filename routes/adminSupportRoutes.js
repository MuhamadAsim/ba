import express from "express";
import {
  getShopMessages,
  sendShopMessage,
  getAdminMessages,
  replyToMessage,
 
} from "../controllers/adminSupportController.js";
import { authenticateShop } from "../middlewares/authShopMiddleware.js";
import { authenticateAdmin } from "../middlewares/adminAuthMiddleware.js";
const router = express.Router();

// // Shop routes (shop can talk to admin)
// router.post("/get-or-create", authenticateShop, getOrCreateAdminChat);
// router.get("/shop/:shopId", authenticateShop, getAdminChatByShopId);
// router.post("/shop/:shopId/message", authenticateShop, sendMessageToAdmin);
// router.post("/shop/:shopId/read", authenticateShop, markMessagesAsRead);
// router.get("/shop/:shopId/messages", authenticateShop, getAdminChatMessages);

// // Note: You'll need to create admin authentication middleware
// router.get("/admin/chats", authenticateAdmin, getAllAdminChats); // Add admin auth middleware
// router.get("/admin/chat/:shopId", authenticateAdmin, getAdminChatByShopId); // Add admin auth middleware
// router.post("/admin/chat/:shopId/message", authenticateAdmin, sendMessageToAdmin); // Add admin auth middleware
// router.post("/admin/chat/:shopId/read", authenticateAdmin, markMessagesAsRead); // Add admin auth middleware
// router.get("/admin/chat/:shopId/messages", authenticateAdmin, getAdminChatMessages); // Get messages




router.get("/shop/messages", authenticateShop, getShopMessages);

// @route   POST /api/support/shop/send
// @desc    Send new message to admin
// @access  Private (Shop)
router.post("/shop/send", authenticateShop, sendShopMessage);

// ==================== ADMIN ROUTES ====================
// Admin must be authenticated to access these routes

// @route   GET /api/support/admin/messages
// @desc    Get all messages from all shops
// @access  Private (Admin)
router.get("/admin/messages", authenticateAdmin, getAdminMessages);

// @route   POST /api/support/admin/reply/:id
// @desc    Reply to a support message
// @access  Private (Admin)
router.post("/admin/reply/:id", authenticateAdmin, replyToMessage);




export default router;