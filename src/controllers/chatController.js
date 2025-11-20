import Chat from "../models/chatRoomModel.js";
import Customer from "../models/customerModel.js";
import Shop from "../models/shopModel.js";








// Get or create a chat between customer and shop
export const getOrCreateChat = async (req, res) => {
  try {
    const { customerId, shopId } = req.body;
    const userRole = req.user.role; // "customer" or "shop"
    const userId = req.user._id.toString();

    console.log("CUSTOMER:", customerId, "SHOP:", shopId, "ROLE:", userRole, "USER:", userId);

    // ------------------------------ AUTH CHECK ------------------------------
    if (userRole === "customer" && userId !== customerId) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    if (userRole === "shop" && userId !== shopId) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    if (customerId === shopId) {
      return res.status(400).json({ error: "Invalid chat participants" });
    }

    // ------------------------------ CHECK IF CHAT EXISTS ------------------------------
    let chat = await Chat.findOne({
      customerId,
      shopId,
    });

    if (chat) {
      return res.status(200).json(chat);
    }

    // ------------------------------ GET CUSTOMER + SHOP ------------------------------
    const customer = await Customer.findById(customerId).select("name email avatar");
    
    const shop = await Shop.findById(shopId).select("businessName email profilePic");

    if (!customer || !shop) {
      return res.status(404).json({ error: "Customer or Shop not found" });
    }

    // ------------------------------ CREATE CHAT ------------------------------
    chat = await Chat.create({
      customerId,
      shopId,

      // Customer Fields
      customerName: customer.name,
      customerAvatar: customer.avatar,

      // Shop Fields
      shopName: shop.businessName,
      shopAvatar: shop.profilePic,

      // Defaults
      messages: [],
      unreadCountCustomer: 0,
      unreadCountShop: 0,
    });

    res.status(201).json(chat);

  } catch (error) {
    console.error("Error in getOrCreateChat:", error);
    res.status(500).json({ error: error.message });
  }
};








// Get all chats for current user
export const getUserChats = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let chats;
    if (userRole === "customer") {
      chats = await Chat.find({ customerId: userId, isActive: true })
        .sort({ updatedAt: -1 })
        .lean();
    } else if (userRole === "shop") {
      chats = await Chat.find({ shopId: userId, isActive: true })
        .sort({ updatedAt: -1 })
        .lean();
    } else {
      return res.status(403).json({ error: "Invalid user role" });
    }

    res.status(200).json(chats);
  } catch (error) {
    console.error("Error in getUserChats:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get single chat with all messages
export const getChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Verify user is part of this chat
    const isCustomer = chat.customerId.toString() === userId.toString();
    const isShop = chat.shopId.toString() === userId.toString();

    if (!isCustomer && !isShop) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Mark messages as read for this user
    if (userRole === "customer") {
      chat.messages.forEach((msg) => {
        if (msg.senderType === "shop") {
          msg.isRead = true;
        }
      });
      chat.unreadCountCustomer = 0;
    } else if (userRole === "shop") {
      chat.messages.forEach((msg) => {
        if (msg.senderType === "customer") {
          msg.isRead = true;
        }
      });
      chat.unreadCountShop = 0;
    }

    await chat.save();

    res.status(200).json(chat);
  } catch (error) {
    console.error("Error in getChat:", error);
    res.status(500).json({ error: error.message });
  }
};

// Send a message in a chat
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const userName = req.user.name || req.user.shopName;

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Message text is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Verify user is part of this chat
    const isCustomer = chat.customerId.toString() === userId.toString();
    const isShop = chat.shopId.toString() === userId.toString();

    if (!isCustomer && !isShop) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Create message
    const message = {
      senderId: userId,
      senderType: userRole,
      senderName: userName,
      text: text.trim(),
      isRead: false,
      createdAt: new Date(),
    };

    // Add message to chat
    chat.messages.push(message);
    chat.lastMessage = text.trim();
    chat.lastMessageTime = new Date();

    // Update unread counts
    if (userRole === "customer") {
      chat.unreadCountShop += 1;
    } else if (userRole === "shop") {
      chat.unreadCountCustomer += 1;
    }

    await chat.save();

    // Emit real-time update via Socket.io
    if (req.io) {
      req.io.to(chatId).emit("newMessage", {
        ...message,
        _id: message._id,
        chatId,
      });

      // Update chat list for other user
      req.io.to(chatId).emit("chatUpdated", {
        chatId,
        lastMessage: message.text,
        lastMessageTime: message.createdAt,
      });
    }

    res.status(201).json({
      success: true,
      message: message,
      chatId,
    });
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete a chat
export const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Verify authorization
    const isCustomer = chat.customerId.toString() === userId.toString();
    const isShop = chat.shopId.toString() === userId.toString();

    if (!isCustomer && !isShop) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Soft delete
    chat.isActive = false;
    await chat.save();

    res.status(200).json({ success: true, message: "Chat deleted" });
  } catch (error) {
    console.error("Error in deleteChat:", error);
    res.status(500).json({ error: error.message });
  }
};

// Clear chat messages
export const clearChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Verify authorization
    const isCustomer = chat.customerId.toString() === userId.toString();
    const isShop = chat.shopId.toString() === userId.toString();

    if (!isCustomer && !isShop) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    chat.messages = [];
    chat.lastMessage = null;
    chat.lastMessageTime = null;
    await chat.save();

    res.status(200).json({ success: true, message: "Chat cleared" });
  } catch (error) {
    console.error("Error in clearChatMessages:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get unread message count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let totalUnread = 0;

    if (userRole === "customer") {
      const chats = await Chat.find({ customerId: userId }).lean();
      totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCountCustomer, 0);
    } else if (userRole === "shop") {
      const chats = await Chat.find({ shopId: userId }).lean();
      totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCountShop, 0);
    }

    res.status(200).json({ unreadCount: totalUnread });
  } catch (error) {
    console.error("Error in getUnreadCount:", error);
    res.status(500).json({ error: error.message });
  }
};

// Search chats
export const searchChats = async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Search query required" });
    }

    let chats;
    const searchRegex = new RegExp(query, "i");

    if (userRole === "customer") {
      chats = await Chat.find({
        customerId: userId,
        shopName: searchRegex,
      }).lean();
    } else if (userRole === "shop") {
      chats = await Chat.find({
        shopId: userId,
        customerName: searchRegex,
      }).lean();
    }

    res.status(200).json(chats);
  } catch (error) {
    console.error("Error in searchChats:", error);
    res.status(500).json({ error: error.message });
  }
};