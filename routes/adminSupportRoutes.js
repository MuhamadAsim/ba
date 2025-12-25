import express from "express";
import {
  getOrCreateAdminChat,
  getAllAdminChats,
  getAdminChatByShopId,
  sendMessageToAdmin,
  markMessagesAsRead,
  getAdminChatMessages
} from "../controllers/adminSupportController.js";
import { authenticateShop } from "../middlewares/authShopMiddleware.js";
import { authenticateAdmin } from "../middlewares/adminAuthMiddleware.js";
const router = express.Router();

// Shop routes (shop can talk to admin)
router.post("/get-or-create", authenticateShop, getOrCreateAdminChat);
router.get("/shop/:shopId", authenticateShop, getAdminChatByShopId);
router.post("/shop/:shopId/message", authenticateShop, sendMessageToAdmin);
router.post("/shop/:shopId/read", authenticateShop, markMessagesAsRead);
router.get("/shop/:shopId/messages", authenticateShop, getAdminChatMessages);

// Note: You'll need to create admin authentication middleware
router.get("/admin/chats", authenticateAdmin, getAllAdminChats); // Add admin auth middleware
router.get("/admin/chat/:shopId", authenticateAdmin, getAdminChatByShopId); // Add admin auth middleware
router.post("/admin/chat/:shopId/message", authenticateAdmin, sendMessageToAdmin); // Add admin auth middleware
router.post("/admin/chat/:shopId/read", authenticateAdmin, markMessagesAsRead); // Add admin auth middleware
router.get("/admin/chat/:shopId/messages", authenticateAdmin, getAdminChatMessages); // Get messages


export default router;