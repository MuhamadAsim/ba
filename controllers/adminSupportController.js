import AdminChat from "../models/adminSupportModel.js";
import Shop from "../models/shopModel.js";
import mongoose from "mongoose";

// Get or create admin chat for shop
export const getOrCreateAdminChat = async (req, res) => {
  try {
    const { shopId } = req.body;
    const senderType = req.shopId ? "shop" : "admin";

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: "Shop ID is required"
      });
    }

    // Verify shop exists
    const shop = await Shop.findById(shopId).select("businessName email");
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found"
      });
    }

    // Find existing chat
    let chat = await AdminChat.findOne({ shopId })
      .populate("shopId", "businessName email phone address profilePic");

    // Create new chat if doesn't exist
    if (!chat) {
      chat = new AdminChat({
        shopId,
        shopName: shop.businessName,
        unreadCountAdmin: 0,
        unreadCountShop: 0,
        messages: []
      });
      await chat.save();
    }

    // Populate shop info
    chat = await AdminChat.findById(chat._id)
      .populate("shopId", "businessName email phone address profilePic");

    return res.status(200).json({
      success: true,
      chat
    });

  } catch (error) {
    console.error("Error getting/creating admin chat:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get all admin chats (for admin panel)
export const getAllAdminChats = async (req, res) => {
  try {
    const chats = await AdminChat.find()
      .populate("shopId", "businessName email phone address profilePic")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: chats.length,
      chats
    });

  } catch (error) {
    console.error("Error fetching admin chats:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get admin chat by shop ID
export const getAdminChatByShopId = async (req, res) => {
  try {
    const { shopId } = req.params;

    const chat = await AdminChat.findOne({ shopId })
      .populate("shopId", "businessName email phone address profilePic");

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    return res.status(200).json({
      success: true,
      chat
    });

  } catch (error) {
    console.error("Error fetching admin chat:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// In your adminSupportController.js, update the sendMessageToAdmin function:

export const sendMessageToAdmin = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { text } = req.body;
    
    // Determine sender type
    let senderId;
    let senderType;
    
    if (req.shopId) {
      // Shop sending message
      senderId = req.shopId;
      senderType = "shop";
    } else {
      // Admin sending message
      senderId = "admin";
      senderType = "admin";
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message text is required"
      });
    }

    // Find existing chat
    let chat = await AdminChat.findOne({ shopId });

    // If no chat exists, create one
    let isNewChat = false;
    if (!chat) {
      // Get shop info
      const shop = await Shop.findById(shopId).select("businessName email");
      
      // Create new chat with empty messages array
      chat = new AdminChat({
        shopId,
        shopName: shop?.businessName || "Shop",
        messages: [], // Initialize empty array
        unreadCountAdmin: 0,
        unreadCountShop: 0
      });
      
      isNewChat = true;
    }

    // Create message object
    const message = {
      senderType,
      senderId,
      text: text.trim(),
      createdAt: new Date(),
      _id: new mongoose.Types.ObjectId() // Add explicit _id for the message
    };

    // Add message to chat
    chat.messages.push(message);
    
    // Update chat metadata
    chat.lastMessage = text.trim();
    chat.lastMessageTime = new Date();
    chat.lastSender = senderType;
    
    // Update unread counts
    if (senderType === "shop") {
      chat.unreadCountAdmin += 1;
    } else {
      chat.unreadCountShop += 1;
    }
    
    chat.updatedAt = new Date();

    // Save the chat
    await chat.save();

    // IMPORTANT: Re-fetch the chat to ensure messages are properly loaded
    chat = await AdminChat.findById(chat._id)
      .populate("shopId", "businessName email phone address profilePic");

    // Get the last message
    const lastMessage = chat.messages[chat.messages.length - 1];

    // Emit socket events
    if (req.io) {
      if (senderType === "shop") {
        // Shop sending to admin
        req.io.emit("adminChatUpdated", {
          chatId: chat._id,
          message: lastMessage
        });
        
        // Also emit to shop for confirmation
        req.io.to(`admin-chat-${shopId}`).emit("adminChatMessage", {
          chatId: chat._id,
          message: lastMessage
        });
      } else {
        // Admin sending to shop
        req.io.emit("adminChatUpdated", {
          chatId: chat._id,
          message: lastMessage
        });
        
        // Emit to specific shop
        req.io.to(`admin-chat-${shopId}`).emit("newAdminMessage", {
          chatId: chat._id,
          shopId,
          message: lastMessage
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      chat,
      newMessage: lastMessage,
      isNewChat // Optional: can be used to trigger different UI behavior
    });

  } catch (error) {
    console.error("Error sending admin message:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


// Mark messages as read
export const markMessagesAsRead = async (req, res) => {
  try {
    const { shopId } = req.params;
    const userId = req.shopId || req.adminId;
    const userType = req.shopId ? "shop" : "admin";

    const chat = await AdminChat.findOne({ shopId });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    // Update unread count
    if (userType === "admin") {
      chat.unreadCountAdmin = 0;
    } else {
      chat.unreadCountShop = 0;
    }

    await chat.save();

    return res.status(200).json({
      success: true,
      message: "Messages marked as read",
      chat
    });

  } catch (error) {
    console.error("Error marking messages as read:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};



// In adminSupportController.js, add this function:
export const getAdminChatMessages = async (req, res) => {
  try {
    const { shopId } = req.params;
    
    // Find chat with messages
    const chat = await AdminChat.findOne({ shopId })
      .populate("shopId", "businessName email phone address profilePic");

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    return res.status(200).json({
      success: true,
      messages: chat.messages || [],
      chat: {
        _id: chat._id,
        shopId: chat.shopId,
        shopName: chat.shopName,
        lastMessage: chat.lastMessage,
        lastMessageTime: chat.lastMessageTime,
        lastSender: chat.lastSender,
        unreadCountAdmin: chat.unreadCountAdmin,
        unreadCountShop: chat.unreadCountShop,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt
      }
    });

  } catch (error) {
    console.error("Error fetching admin chat messages:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};