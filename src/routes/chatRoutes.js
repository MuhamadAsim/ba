import express from "express";
import {
  getOrCreateChat,
  getUserChats,
  getChat,
  sendMessage,
  deleteChat,
  clearChatMessages,
  getUnreadCount,
  searchChats,
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
router.post("/:chatId/message", sendMessage);
router.delete("/:chatId", deleteChat);
router.delete("/:chatId/clear", clearChatMessages);

export default router;