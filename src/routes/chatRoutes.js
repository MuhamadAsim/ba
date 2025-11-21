import express from "express";
import {
  getOrCreateChat,
  getUserChats,
  getChat,
  getChatContext,
  sendMessage,
  deleteChat,
  clearChatMessages,
  getUnreadCount,
  searchChats,
  getChatMessages
} from "../controllers/chatController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Chat operations
router.post("/get-or-create", getOrCreateChat);
router.get("/list", getUserChats);
router.get("/unread-count", getUnreadCount);
router.get("/search", searchChats);
router.get("/:chatId", getChat);
router.get("/:chatId/context", getChatContext);  // ✅ NEW - Fetch offer/bid/counter data
router.post("/:chatId/message", sendMessage);
router.delete("/:chatId", deleteChat);
router.delete("/:chatId/clear", clearChatMessages);
router.get("/:chatId/messages", getChatMessages);

export default router;