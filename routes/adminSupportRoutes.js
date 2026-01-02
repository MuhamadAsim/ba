// import express from "express";
// import {
//   getShopMessages,
//   sendShopMessage,
//   getAdminMessages,
//   replyToMessage,
 
// } from "../controllers/adminSupportController.js";
// import { authenticateShop } from "../middlewares/authShopMiddleware.js";
// import { authenticateAdmin } from "../middlewares/adminAuthMiddleware.js";
// const router = express.Router();

// // // Shop routes (shop can talk to admin)
// // router.post("/get-or-create", authenticateShop, getOrCreateAdminChat);
// // router.get("/shop/:shopId", authenticateShop, getAdminChatByShopId);
// // router.post("/shop/:shopId/message", authenticateShop, sendMessageToAdmin);
// // router.post("/shop/:shopId/read", authenticateShop, markMessagesAsRead);
// // router.get("/shop/:shopId/messages", authenticateShop, getAdminChatMessages);

// // // Note: You'll need to create admin authentication middleware
// // router.get("/admin/chats", authenticateAdmin, getAllAdminChats); // Add admin auth middleware
// // router.get("/admin/chat/:shopId", authenticateAdmin, getAdminChatByShopId); // Add admin auth middleware
// // router.post("/admin/chat/:shopId/message", authenticateAdmin, sendMessageToAdmin); // Add admin auth middleware
// // router.post("/admin/chat/:shopId/read", authenticateAdmin, markMessagesAsRead); // Add admin auth middleware
// // router.get("/admin/chat/:shopId/messages", authenticateAdmin, getAdminChatMessages); // Get messages




// router.get("/shop/messages", authenticateShop, getShopMessages);

// // @route   POST /api/support/shop/send
// // @desc    Send new message to admin
// // @access  Private (Shop)
// router.post("/shop/send", authenticateShop, sendShopMessage);

// // ==================== ADMIN ROUTES ====================
// // Admin must be authenticated to access these routes

// // @route   GET /api/support/admin/messages
// // @desc    Get all messages from all shops
// // @access  Private (Admin)
// router.get("/admin/messages", authenticateAdmin, getAdminMessages);

// // @route   POST /api/support/admin/reply/:id
// // @desc    Reply to a support message
// // @access  Private (Admin)
// router.post("/admin/reply/:id", authenticateAdmin, replyToMessage);




// export default router;









// routes/supportRoutes.js
import express from "express";
import {
  // Shop endpoints
  getShopConversations,
  getShopConversation,
  createConversation,
  addShopMessage,
  
  // Admin endpoints
  getAdminConversations,
  getAdminConversation,
  addAdminMessage,
  updateConversation,
  getConversationStats,
} from "../controllers/adminSupportController.js";
import { authenticateShop } from "../middlewares/authShopMiddleware.js";
import { authenticateAdmin } from "../middlewares/adminAuthMiddleware.js";

const router = express.Router();

// ==================== SHOP ROUTES ====================

// @route   GET /api/support/shop/conversations
// @desc    Get all conversations for logged-in shop
// @access  Private (Shop)
router.get("/shop/conversations", authenticateShop, getShopConversations);

// @route   GET /api/support/shop/conversations/:conversationId
// @desc    Get single conversation with all messages
// @access  Private (Shop)
router.get("/shop/conversations/:conversationId", authenticateShop, getShopConversation);

// @route   POST /api/support/shop/conversations
// @desc    Start new conversation with admin
// @access  Private (Shop)
router.post("/shop/conversations", authenticateShop, createConversation);

// @route   POST /api/support/shop/conversations/:conversationId/messages
// @desc    Add message to existing conversation (shop replies)
// @access  Private (Shop)
router.post("/shop/conversations/:conversationId/messages", authenticateShop, addShopMessage);

// ==================== ADMIN ROUTES ====================

// @route   GET /api/support/admin/conversations
// @desc    Get all conversations (admin view)
// @access  Private (Admin)
router.get("/admin/conversations", authenticateAdmin, getAdminConversations);

// @route   GET /api/support/admin/conversations/:conversationId
// @desc    Get single conversation (admin view)
// @access  Private (Admin)
router.get("/admin/conversations/:conversationId", authenticateAdmin, getAdminConversation);

// @route   POST /api/support/admin/conversations/:conversationId/messages
// @desc    Admin adds message to conversation
// @access  Private (Admin)
router.post("/admin/conversations/:conversationId/messages", authenticateAdmin, addAdminMessage);

// @route   PUT /api/support/admin/conversations/:conversationId
// @desc    Update conversation (status, priority, assign, etc.)
// @access  Private (Admin)
router.put("/admin/conversations/:conversationId", authenticateAdmin, updateConversation);

// @route   GET /api/support/admin/statistics
// @desc    Get conversation statistics for admin dashboard
// @access  Private (Admin)
router.get("/admin/statistics", authenticateAdmin, getConversationStats);

export default router;