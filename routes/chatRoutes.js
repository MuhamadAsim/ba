// import express from "express";
// import {
//   getOrCreateChat,
//   getUserChats,
//   getChat,
//   getChatContext,
//   sendMessage,
//   deleteChat,
//   clearChatMessages,
//   getUnreadCount,
//   searchChats,
//   getChatMessages,
//   searchShops
// } from "../controllers/chatController.js";
// import { authMiddleware } from "../middlewares/authMiddleware.js";

// const router = express.Router();

// // All routes require authentication
// router.use(authMiddleware);

// // Chat operations
// router.post("/get-or-create", getOrCreateChat);
// router.get("/list", getUserChats);
// router.get("/unread-count", getUnreadCount);
// router.get("/search", searchChats);
// router.get("/search-for-shops", searchShops);
// router.get("/:chatId", getChat);
// router.get("/:chatId/context", getChatContext);  // ✅ NEW - Fetch offer/bid/counter data
// router.post("/:chatId/message", sendMessage);
// router.delete("/:chatId", deleteChat);
// router.delete("/:chatId/clear", clearChatMessages);
// router.get("/:chatId/messages", getChatMessages);



// export default router;


















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
  getChatMessages,
  searchShops,
  // New image functions
  uploadChatImage,
  deleteChatImage,
  getChatImages,
  // Optional: handle direct image in message
  // sendMessageWithImages
} from "../controllers/chatController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js"; // Make sure to import your upload middleware

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// ==================== IMAGE UPLOAD ROUTES ====================
// Configure multer for single image upload
const uploadSingleImage = upload.single("image");

// Upload image to chat (returns Cloudinary URL)
router.post("/upload-image", uploadSingleImage, uploadChatImage);

// Delete uploaded image (from Cloudinary)
router.delete("/delete-image", deleteChatImage);

// Get all images in a specific chat
router.get("/:chatId/images", getChatImages);

// ==================== CHAT OPERATIONS ====================
// Chat creation and listing
router.post("/get-or-create", getOrCreateChat);
router.get("/list", getUserChats);
router.get("/unread-count", getUnreadCount);
router.get("/search", searchChats);
router.get("/search-for-shops", searchShops);

// Specific chat operations
router.get("/:chatId", getChat);
router.get("/:chatId/context", getChatContext);  // Fetch offer/bid/counter data
router.delete("/:chatId", deleteChat);
router.delete("/:chatId/clear", clearChatMessages);

// ==================== MESSAGE ROUTES ====================
// Option 1: Regular text message (with or without references)
router.post("/:chatId/message", sendMessage);

// Option 2: Message with direct image upload (alternative approach)
// This would handle both text and images in one request
// router.post("/:chatId/message-with-images", upload.array("images", 5), sendMessageWithImages);

// Get messages with pagination
router.get("/:chatId/messages", getChatMessages);

export default router;