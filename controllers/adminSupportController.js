// controllers/adminSupportController.js
import SupportConversation from "../models/adminSupportModel.js";
import cloudinary from "../configs/cloudinary.js"; // You'll need to set this up



// Create new conversation (with file upload support)
export const createShopConversation = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const files = req.files || [];
    
    if (!subject || (!message && files.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Subject and either message or attachments are required"
      });
    }

    // Upload files to Cloudinary
    const attachments = [];
    
    for (const file of files) {
      try {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "support-attachments",
              resource_type: "auto",
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          
          stream.end(file.buffer);
        });
        
        attachments.push({
          url: result.secure_url,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: result.bytes
        });
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        // Continue with other files even if one fails
      }
    }

    // Create new conversation
    const conversation = new SupportConversation({
      shopId: req.shop._id, // Changed from req.user._id to req.shop._id
      shopName: req.shop.businessName || req.shop.businessName, // Changed from req.user
      shopEmail: req.shop.email, // Changed from req.user
      subject,
      messages: [{
        sender: "shop",
        message: message || " ",
        attachments,
        readBy: ["shop"]
      }],
      status: "open",
      lastMessageBy: "shop",
      lastMessageAt: new Date()
    });

    await conversation.save();

    res.status(201).json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create conversation",
      error: error.message
    });
  }
};

// Send reply to conversation (with file upload support)
export const sendShopReply = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message } = req.body;
    const files = req.files || [];
    
    if (!message && files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message or attachments are required"
      });
    }

    const conversation = await SupportConversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    // Check if shop owns this conversation
    if (conversation.shopId.toString() !== req.shop._id.toString()) { // Changed from req.user._id
      return res.status(403).json({
        success: false,
        message: "Not authorized to reply to this conversation"
      });
    }

    // Upload files to Cloudinary
    const attachments = [];
    
    for (const file of files) {
      try {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "support-attachments",
              resource_type: "auto",
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          
          stream.end(file.buffer);
        });
        
        attachments.push({
          url: result.secure_url,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: result.bytes
        });
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        // Continue with other files
      }
    }

    // Add message to conversation
    conversation.messages.push({
      sender: "shop",
      message: message || " ",
      attachments,
      readBy: ["shop"]
    });
    
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = "shop";
    conversation.status = "pending_reply";
    
    await conversation.save();

    res.json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error("Error sending reply:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send reply",
      error: error.message
    });
  }
};

// Get shop conversations
export const getShopConversations = async (req, res) => {
  try {
    const { status } = req.query;
    let query = { shopId: req.shop._id }; // Changed from req.user._id
    
    if (status && status !== "all") {
      query.status = status === "pending" ? "pending_reply" : status;
    }
    
    const conversations = await SupportConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .select("subject status messages lastMessageAt lastMessageBy createdAt updatedAt priority tags")
      .lean();
    
    // Add unread count for each conversation
    const conversationsWithCount = conversations.map(conv => ({
      ...conv,
      unreadCount: conv.messages.filter(
        msg => msg.sender === "admin" && !msg.readBy.includes("shop")
      ).length
    }));
    
    res.json({
      success: true,
      data: conversationsWithCount
    });
    
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversations"
    });
  }
};

// Get conversation details
export const getConversationDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await SupportConversation.findOne({
      _id: conversationId,
      shopId: req.shop._id // Changed from req.user._id
    });
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }
    
    // Mark admin messages as read by shop
    const unreadMessages = conversation.messages.filter(
      msg => msg.sender === "admin" && !msg.readBy.includes("shop")
    );
    
    if (unreadMessages.length > 0) {
      unreadMessages.forEach(msg => {
        msg.readBy.push("shop");
      });
      await conversation.save();
    }
    
    res.json({
      success: true,
      data: conversation
    });
    
  } catch (error) {
    console.error("Error fetching conversation details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversation details"
    });
  }
};


// Get admin messages (for admin dashboard)
export const getAdminMessages = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    
    if (status && status !== "all") {
      query.status = status === "pending" ? "pending_reply" : status;
    }
    
    const conversations = await SupportConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .populate("shopId", "shopName email") // Populate shop info
      .select("subject status messages lastMessageAt lastMessageBy createdAt updatedAt priority tags shopId shopName shopEmail assignedTo")
      .lean();
    
    // Add unread count for admin for each conversation
    const conversationsWithCount = conversations.map(conv => ({
      ...conv,
      unreadCount: conv.messages.filter(
        msg => msg.sender === "shop" && !msg.readBy.includes("admin")
      ).length
    }));
    
    res.json({
      success: true,
      data: conversationsWithCount
    });
    
  } catch (error) {
    console.error("Error fetching admin conversations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversations"
    });
  }
};






// Admin: Get all conversations
export const getAdminConversations = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    
    if (status && status !== "all") {
      query.status = status === "pending" ? "pending_reply" : status;
    }
    
    const conversations = await SupportConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .populate("shopId", "businessName email avatar")
      .populate("assignedTo", "name email")
      .select("subject status messages lastMessageAt lastMessageBy createdAt updatedAt priority tags shopId shopName shopEmail assignedTo")
      .lean();
    
    // Add unread count for admin for each conversation
    const conversationsWithCount = conversations.map(conv => ({
      ...conv,
      unreadCount: conv.messages.filter(
        msg => msg.sender === "shop" && !msg.readBy.includes("admin")
      ).length
    }));
    
    res.json({
      success: true,
      data: conversationsWithCount
    });
    
  } catch (error) {
    console.error("Error fetching admin conversations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversations"
    });
  }
};

// Admin: Get conversation details
export const getAdminConversationDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await SupportConversation.findById(conversationId)
      .populate("shopId", "businessName email avatar")
      .populate("assignedTo", "name email");
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }
    
    // Mark shop messages as read by admin
    const unreadMessages = conversation.messages.filter(
      msg => msg.sender === "shop" && !msg.readBy.includes("admin")
    );
    
    if (unreadMessages.length > 0) {
      unreadMessages.forEach(msg => {
        msg.readBy.push("admin");
      });
      await conversation.save();
    }
    
    res.json({
      success: true,
      data: conversation
    });
    
  } catch (error) {
    console.error("Error fetching conversation details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversation details"
    });
  }
};
// Admin: Send reply to conversation
export const sendAdminReply = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message, closeConversation } = req.body;
    const files = req.files || [];
    
    if (!message && files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message or attachments are required"
      });
    }

    const conversation = await SupportConversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    // Upload files to Cloudinary
    const attachments = [];
    
    for (const file of files) {
      try {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "support-attachments",
              resource_type: "auto",
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          
          stream.end(file.buffer);
        });
        
        attachments.push({
          url: result.secure_url,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: result.bytes
        });
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        // Continue with other files
      }
    }

    // Add admin message to conversation
    conversation.messages.push({
      sender: "admin",
      message: message || " ",
      attachments,
      readBy: ["admin"] // Admin has read their own message
    });
    
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = "admin";
    
    // Update status based on closeConversation flag
    if (closeConversation === "true" || closeConversation === true) {
      conversation.status = "closed";
    } else {
      conversation.status = "open";
    }
    
    // Assign to this admin if not already assigned
    // FIXED: Use req.admin.id instead of req.user._id
    if (!conversation.assignedTo && req.admin && req.admin.id) {
      conversation.assignedTo = req.admin.id;
    }
    
    await conversation.save();

    res.json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error("Error sending admin reply:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send reply",
      error: error.message
    });
  }
};

// Admin: Update conversation status
export const updateConversationStatus = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { status } = req.body;
    
    if (!status || !["open", "closed", "pending_reply"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status is required"
      });
    }

    const conversation = await SupportConversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    conversation.status = status;
    await conversation.save();

    res.json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error("Error updating conversation status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update conversation status",
      error: error.message
    });
  }
};

// Admin reply to conversation (old function, update if you're using it)
export const replyToMessage = async (req, res) => {
  try {
    const { id } = req.params; // conversationId
    const { message } = req.body;
    const files = req.files || [];
    
    if (!message && files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message or attachments are required"
      });
    }

    const conversation = await SupportConversation.findById(id);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    // Upload files to Cloudinary for admin
    const attachments = [];
    
    for (const file of files) {
      try {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "support-attachments",
              resource_type: "auto",
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          
          stream.end(file.buffer);
        });
        
        attachments.push({
          url: result.secure_url,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: result.bytes
        });
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        // Continue with other files
      }
    }

    // Add admin message to conversation
    conversation.messages.push({
      sender: "admin",
      message: message || " ",
      attachments,
      readBy: ["admin"] // Admin has read their own message
    });
    
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = "admin";
    conversation.status = "open";
    
    // Optionally assign conversation to this admin
    // FIXED: Use req.admin.id instead of req.user._id
    if (!conversation.assignedTo && req.admin && req.admin.id) {
      conversation.assignedTo = req.admin.id;
    }
    
    await conversation.save();

    res.json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error("Error sending admin reply:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send reply",
      error: error.message
    });
  }
};

// Admin: Assign conversation to admin
export const updateConversationAssignment = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { assignedTo } = req.body;
    
    // If assignedTo is "self", assign to current admin
    // FIXED: Use req.admin.id instead of req.user._id
    const adminId = assignedTo === "self" ? (req.admin && req.admin.id) : assignedTo;

    const conversation = await SupportConversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    conversation.assignedTo = adminId;
    await conversation.save();

    res.json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error("Error assigning conversation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign conversation",
      error: error.message
    });
  }
};