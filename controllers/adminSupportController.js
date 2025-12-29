// import AdminChat from "../models/adminSupportModel.js";
// import Shop from "../models/shopModel.js";
// import mongoose from "mongoose";

// // Get or create admin chat for shop
// export const getOrCreateAdminChat = async (req, res) => {
//   try {
//     const { shopId } = req.body;
//     const senderType = req.shopId ? "shop" : "admin";

//     if (!shopId) {
//       return res.status(400).json({
//         success: false,
//         message: "Shop ID is required"
//       });
//     }

//     // Verify shop exists
//     const shop = await Shop.findById(shopId).select("businessName email");
//     if (!shop) {
//       return res.status(404).json({
//         success: false,
//         message: "Shop not found"
//       });
//     }

//     // Find existing chat
//     let chat = await AdminChat.findOne({ shopId })
//       .populate("shopId", "businessName email phone address profilePic");

//     // Create new chat if doesn't exist
//     if (!chat) {
//       chat = new AdminChat({
//         shopId,
//         shopName: shop.businessName,
//         unreadCountAdmin: 0,
//         unreadCountShop: 0,
//         messages: []
//       });
//       await chat.save();
//     }

//     // Populate shop info
//     chat = await AdminChat.findById(chat._id)
//       .populate("shopId", "businessName email phone address profilePic");

//     return res.status(200).json({
//       success: true,
//       chat
//     });

//   } catch (error) {
//     console.error("Error getting/creating admin chat:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message
//     });
//   }
// };

// // Get all admin chats (for admin panel)
// export const getAllAdminChats = async (req, res) => {
//   try {
//     const chats = await AdminChat.find()
//       .populate("shopId", "businessName email phone address profilePic")
//       .sort({ updatedAt: -1 });

//     return res.status(200).json({
//       success: true,
//       count: chats.length,
//       chats
//     });

//   } catch (error) {
//     console.error("Error fetching admin chats:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message
//     });
//   }
// };

// // Get admin chat by shop ID
// export const getAdminChatByShopId = async (req, res) => {
//   try {
//     const { shopId } = req.params;

//     const chat = await AdminChat.findOne({ shopId })
//       .populate("shopId", "businessName email phone address profilePic");

//     if (!chat) {
//       return res.status(404).json({
//         success: false,
//         message: "Chat not found"
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       chat
//     });

//   } catch (error) {
//     console.error("Error fetching admin chat:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message
//     });
//   }
// };

// // In your adminSupportController.js, update the sendMessageToAdmin function:

// export const sendMessageToAdmin = async (req, res) => {
//   try {
//     const { shopId } = req.params;
//     const { text } = req.body;
    
//     // Determine sender type
//     let senderId;
//     let senderType;
    
//     if (req.shopId) {
//       // Shop sending message
//       senderId = req.shopId;
//       senderType = "shop";
//     } else {
//       // Admin sending message
//       senderId = "admin";
//       senderType = "admin";
//     }

//     if (!text || !text.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: "Message text is required"
//       });
//     }

//     // Find existing chat
//     let chat = await AdminChat.findOne({ shopId });

//     // If no chat exists, create one
//     let isNewChat = false;
//     if (!chat) {
//       // Get shop info
//       const shop = await Shop.findById(shopId).select("businessName email");
      
//       // Create new chat with empty messages array
//       chat = new AdminChat({
//         shopId,
//         shopName: shop?.businessName || "Shop",
//         messages: [], // Initialize empty array
//         unreadCountAdmin: 0,
//         unreadCountShop: 0
//       });
      
//       isNewChat = true;
//     }

//     // Create message object
//     const message = {
//       senderType,
//       senderId,
//       text: text.trim(),
//       createdAt: new Date(),
//       _id: new mongoose.Types.ObjectId() // Add explicit _id for the message
//     };

//     // Add message to chat
//     chat.messages.push(message);
    
//     // Update chat metadata
//     chat.lastMessage = text.trim();
//     chat.lastMessageTime = new Date();
//     chat.lastSender = senderType;
    
//     // Update unread counts
//     if (senderType === "shop") {
//       chat.unreadCountAdmin += 1;
//     } else {
//       chat.unreadCountShop += 1;
//     }
    
//     chat.updatedAt = new Date();

//     // Save the chat
//     await chat.save();

//     // IMPORTANT: Re-fetch the chat to ensure messages are properly loaded
//     chat = await AdminChat.findById(chat._id)
//       .populate("shopId", "businessName email phone address profilePic");

//     // Get the last message
//     const lastMessage = chat.messages[chat.messages.length - 1];

//     // Emit socket events
//     if (req.io) {
//       if (senderType === "shop") {
//         // Shop sending to admin
//         req.io.emit("adminChatUpdated", {
//           chatId: chat._id,
//           message: lastMessage
//         });
        
//         // Also emit to shop for confirmation
//         req.io.to(`admin-chat-${shopId}`).emit("adminChatMessage", {
//           chatId: chat._id,
//           message: lastMessage
//         });
//       } else {
//         // Admin sending to shop
//         req.io.emit("adminChatUpdated", {
//           chatId: chat._id,
//           message: lastMessage
//         });
        
//         // Emit to specific shop
//         req.io.to(`admin-chat-${shopId}`).emit("newAdminMessage", {
//           chatId: chat._id,
//           shopId,
//           message: lastMessage
//         });
//       }
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Message sent successfully",
//       chat,
//       newMessage: lastMessage,
//       isNewChat // Optional: can be used to trigger different UI behavior
//     });

//   } catch (error) {
//     console.error("Error sending admin message:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message
//     });
//   }
// };


// // Mark messages as read
// export const markMessagesAsRead = async (req, res) => {
//   try {
//     const { shopId } = req.params;
//     const userId = req.shopId || req.adminId;
//     const userType = req.shopId ? "shop" : "admin";

//     const chat = await AdminChat.findOne({ shopId });
//     if (!chat) {
//       return res.status(404).json({
//         success: false,
//         message: "Chat not found"
//       });
//     }

//     // Update unread count
//     if (userType === "admin") {
//       chat.unreadCountAdmin = 0;
//     } else {
//       chat.unreadCountShop = 0;
//     }

//     await chat.save();

//     return res.status(200).json({
//       success: true,
//       message: "Messages marked as read",
//       chat
//     });

//   } catch (error) {
//     console.error("Error marking messages as read:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message
//     });
//   }
// };



// // In adminSupportController.js, add this function:
// export const getAdminChatMessages = async (req, res) => {
//   try {
//     const { shopId } = req.params;
    
//     // Find chat with messages
//     const chat = await AdminChat.findOne({ shopId })
//       .populate("shopId", "businessName email phone address profilePic");

//     if (!chat) {
//       return res.status(404).json({
//         success: false,
//         message: "Chat not found"
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       messages: chat.messages || [],
//       chat: {
//         _id: chat._id,
//         shopId: chat.shopId,
//         shopName: chat.shopName,
//         lastMessage: chat.lastMessage,
//         lastMessageTime: chat.lastMessageTime,
//         lastSender: chat.lastSender,
//         unreadCountAdmin: chat.unreadCountAdmin,
//         unreadCountShop: chat.unreadCountShop,
//         createdAt: chat.createdAt,
//         updatedAt: chat.updatedAt
//       }
//     });

//   } catch (error) {
//     console.error("Error fetching admin chat messages:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message
//     });
//   }
// };











// controllers/supportController.js
import SupportMessage from "../models/adminSupportModel.js";
import Shop from "../models/shopModel.js"; // Adjust path as needed
import { sendEmail } from "../utils/sendEmail.js"; // Your email service



// ==================== SHOP ENDPOINTS ====================

// @desc    Get all messages for logged-in shop
// @route   GET /api/support/shop/messages
// @access  Private (Shop)
export const getShopMessages = async (req, res) => {
  try {
    const shopId = req.shop._id; // From shop auth middleware

    const messages = await SupportMessage.find({ shopId })
      .sort({ createdAt: -1 })
      .select("-__v");

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    console.error("Error fetching shop messages:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching messages",
      error: error.message,
    });
  }
};

// @desc    Send new message to admin
// @route   POST /api/support/shop/send
// @access  Private (Shop)
export const sendShopMessage = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const { subject, message } = req.body;

    // Validation
    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Subject and message are required",
      });
    }

    // Get shop details
    const shop = await Shop.findById(shopId).select("businessName email");
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Create support message
    const supportMessage = await SupportMessage.create({
      shopId,
      shopName: shop.businessName, // Using businessName from Shop model
      shopEmail: shop.email,
      subject,
      message,
    });

    // Send email notification to admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
            New Support Message
          </h2>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>From Shop:</strong> ${shop.businessName}</p>
            <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${shop.email}</p>
            <p style="margin: 0 0 10px 0;"><strong>Subject:</strong> ${subject}</p>
            <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 6px;">
              <strong>Message:</strong>
              <p style="margin-top: 10px; white-space: pre-wrap;">${message}</p>
            </div>
          </div>
          <p style="color: #666; font-size: 14px;">
            Please log in to the admin panel to reply to this message.
          </p>
        </div>
      `;

      await sendEmail(
        adminEmail,
        `New Support Message: ${subject}`,
        emailHtml
      );
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: supportMessage,
    });
  } catch (error) {
    console.error("Error sending shop message:", error);
    res.status(500).json({
      success: false,
      message: "Error sending message",
      error: error.message,
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

// @desc    Get all messages from all shops
// @route   GET /api/support/admin/messages
// @access  Private (Admin)
export const getAdminMessages = async (req, res) => {
  try {
    const messages = await SupportMessage.find()
      .sort({ createdAt: -1 })
      .select("-__v");

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    console.error("Error fetching admin messages:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching messages",
      error: error.message,
    });
  }
};

// @desc    Reply to a support message
// @route   POST /api/support/admin/reply/:id
// @access  Private (Admin)
export const replyToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    // Validation
    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required",
      });
    }

    // Find the support message
    const supportMessage = await SupportMessage.findById(id);

    if (!supportMessage) {
      return res.status(404).json({
        success: false,
        message: "Support message not found",
      });
    }

    // Check if already replied
    if (supportMessage.status === "replied") {
      return res.status(400).json({
        success: false,
        message: "This message has already been replied to",
      });
    }

    // Update with reply
    supportMessage.reply = {
      message,
      repliedAt: new Date(),
    };
    supportMessage.status = "replied";

    await supportMessage.save();

    // Send email notification to shop
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #10B981; padding-bottom: 10px;">
            Admin Reply to Your Support Message
          </h2>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Your Subject:</strong> ${supportMessage.subject}</p>
            
            <div style="margin: 20px 0; padding: 15px; background: #e5e7eb; border-radius: 6px;">
              <strong>Your Message:</strong>
              <p style="margin-top: 10px; white-space: pre-wrap;">${supportMessage.message}</p>
            </div>

            <div style="margin-top: 20px; padding: 15px; background: #d1fae5; border-left: 4px solid #10B981; border-radius: 6px;">
              <strong style="color: #059669;">Admin Reply:</strong>
              <p style="margin-top: 10px; white-space: pre-wrap; color: #065f46;">${message}</p>
            </div>
          </div>
          <p style="color: #666; font-size: 14px;">
            Please log in to your shop dashboard to view this message.
          </p>
        </div>
      `;

      await sendEmail(
        supportMessage.shopEmail,
        `Re: ${supportMessage.subject}`,
        emailHtml
      );
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: "Reply sent successfully",
      data: supportMessage,
    });
  } catch (error) {
    console.error("Error replying to message:", error);
    res.status(500).json({
      success: false,
      message: "Error sending reply",
      error: error.message,
    });
  }
};