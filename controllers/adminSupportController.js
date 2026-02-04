import SupportConversation from "../models/adminSupportModel.js";
import cloudinary from "../configs/cloudinary.js";
import { sendEmail } from "../utils/sendEmail.js";


// ==================== SHOP SUPPORT CONTROLLERS ====================

// Create new shop conversation
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
      type: "shop",
      shopId: req.shop._id,
      shopName: req.shop.businessName,
      shopEmail: req.shop.email,
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

// Send shop reply
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
    if (conversation.shopId.toString() !== req.shop._id.toString()) {
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
    let query = { 
      type: "shop",
      shopId: req.shop._id 
    };
    
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

// Get shop conversation details
export const getConversationDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await SupportConversation.findOne({
      _id: conversationId,
      type: "shop",
      shopId: req.shop._id
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

// ==================== CUSTOMER SUPPORT CONTROLLERS ====================
// Create new customer conversation
export const createCustomerConversation = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const files = req.files || [];
    
    // Add console.log to debug
    console.log("req.customer:", req.customer);
    console.log("req.user:", req.user);
    
    if (!subject || (!message && files.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Subject and either message or attachments are required"
      });
    }

    // Check if customer exists
    if (!req.customer) {
      return res.status(401).json({
        success: false,
        message: "Customer not authenticated"
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

    // Create new conversation - FIX HERE
    const conversation = new SupportConversation({
      type: "customer",
      customerId: req.customer._id,
      customerName: req.customer.name || "Customer",  // ✅ Changed from req.user
      customerEmail: req.customer.email,              // ✅ Changed from req.user
      subject,
      messages: [{
        sender: "customer",
        message: message || " ",
        attachments,
        readBy: ["customer"]
      }],
      status: "open",
      lastMessageBy: "customer",
      lastMessageAt: new Date()
    });

    await conversation.save();

    res.status(201).json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error("Error creating customer conversation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create support request",
      error: error.message
    });
  }
};


// Send customer reply
export const sendCustomerReply = async (req, res) => {
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

    // Check if customer owns this conversation
    if (conversation.customerId.toString() !== req.customer._id.toString()) {
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
      sender: "customer",
      message: message || " ",
      attachments,
      readBy: ["customer"]
    });
    
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = "customer";
    conversation.status = "pending_reply";
    
    await conversation.save();

    res.json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error("Error sending customer reply:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send reply",
      error: error.message
    });
  }
};

// Get customer conversations
export const getCustomerConversations = async (req, res) => {
  try {
    const { status } = req.query;
    let query = { 
      type: "customer",
      customerId: req.customer._id
    };
    
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
        msg => msg.sender === "admin" && !msg.readBy.includes("customer")
      ).length
    }));
    
    res.json({
      success: true,
      data: conversationsWithCount
    });
    
  } catch (error) {
    console.error("Error fetching customer conversations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversations"
    });
  }
};




// Get customer conversation details
export const getCustomerConversationDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await SupportConversation.findOne({
      _id: conversationId,
      type: "customer",
      customerId: req.customer._id
    });
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }
    
    // Mark admin messages as read by customer
    const unreadMessages = conversation.messages.filter(
      msg => msg.sender === "admin" && !msg.readBy.includes("customer")
    );
    
    if (unreadMessages.length > 0) {
      unreadMessages.forEach(msg => {
        msg.readBy.push("customer");
      });
      await conversation.save();
    }
    
    res.json({
      success: true,
      data: conversation
    });
    
  } catch (error) {
    console.error("Error fetching customer conversation details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversation details"
    });
  }
};




// ==================== ADMIN SUPPORT CONTROLLERS ====================

// Admin: Get all conversations (both shop and customer)
export const getAdminConversations = async (req, res) => {
  try {
    const { status, type } = req.query;
    let query = {};
    
    // Filter by type if specified
    if (type && ["shop", "customer"].includes(type)) {
      query.type = type;
    }
    
    // Filter by status if specified
    if (status && status !== "all") {
      query.status = status === "pending" ? "pending_reply" : status;
    }
    
    const conversations = await SupportConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .populate("shopId", "businessName email avatar")
      .populate("customerId", "name email avatar")
      .populate("assignedTo", "name email")
      .select("type subject status messages lastMessageAt lastMessageBy createdAt updatedAt priority tags shopId shopName shopEmail customerId customerName customerEmail assignedTo")
      .lean();
    
    // Add unread count for admin for each conversation
    const conversationsWithCount = conversations.map(conv => ({
      ...conv,
      unreadCount: conv.type === "shop" 
        ? conv.messages.filter(msg => msg.sender === "shop" && !msg.readBy.includes("admin")).length
        : conv.messages.filter(msg => msg.sender === "customer" && !msg.readBy.includes("admin")).length
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
      .populate("customerId", "name email avatar")
      .populate("assignedTo", "name email");
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }
    
    // Mark messages as read by admin
    const userType = conversation.type; // "shop" or "customer"
    const unreadMessages = conversation.messages.filter(
      msg => msg.sender === userType && !msg.readBy.includes("admin")
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

// Admin: Send reply to conversation (works for both shop and customer)
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

// Admin: Assign conversation to admin
export const updateConversationAssignment = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { assignedTo } = req.body;
    
    // If assignedTo is "self", assign to current admin
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

// Get admin messages (legacy function - keep for backward compatibility)
export const getAdminMessages = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    
    if (status && status !== "all") {
      query.status = status === "pending" ? "pending_reply" : status;
    }
    
    const conversations = await SupportConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .populate("shopId", "shopName email")
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

// Admin reply to conversation (legacy function - keep for backward compatibility)
export const replyToMessage = async (req, res) => {
  try {
    const { id } = req.params;
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
      readBy: ["admin"]
    });
    
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = "admin";
    conversation.status = "open";
    
    // Optionally assign conversation to this admin
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





















/**
 * Controller to handle partner application submissions
 * Sends notification email to support team
 */
export const submitPartnerApplication = async (req, res) => {
  try {
    const {
      businessName,
      contactName,
      email,
      phone,
      address,
      website,
      about,
    } = req.body;

    // Validate required fields
    if (!businessName || !contactName || !email || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Create email HTML content
    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border: 1px solid #e0e0e0;
              border-top: none;
            }
            .field {
              margin-bottom: 20px;
              background: white;
              padding: 15px;
              border-radius: 5px;
              border-left: 4px solid #667eea;
            }
            .field-label {
              font-weight: bold;
              color: #667eea;
              font-size: 12px;
              text-transform: uppercase;
              margin-bottom: 5px;
            }
            .field-value {
              color: #333;
              font-size: 16px;
            }
            .footer {
              background: #f9f9f9;
              padding: 20px;
              text-align: center;
              border: 1px solid #e0e0e0;
              border-top: none;
              border-radius: 0 0 10px 10px;
              color: #666;
              font-size: 12px;
            }
            .cta-button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin-top: 20px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 New Partner Application</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">A shop wants to join Bid A Wrap!</p>
          </div>
          
          <div class="content">
            <div class="field">
              <div class="field-label">Business Name</div>
              <div class="field-value">${businessName}</div>
            </div>

            <div class="field">
              <div class="field-label">Contact Person</div>
              <div class="field-value">${contactName}</div>
            </div>

            <div class="field">
              <div class="field-label">Email Address</div>
              <div class="field-value">
                <a href="mailto:${email}" style="color: #667eea; text-decoration: none;">
                  ${email}
                </a>
              </div>
            </div>

            <div class="field">
              <div class="field-label">Phone Number</div>
              <div class="field-value">
                <a href="tel:${phone}" style="color: #667eea; text-decoration: none;">
                  ${phone}
                </a>
              </div>
            </div>

            <div class="field">
              <div class="field-label">Business Address</div>
              <div class="field-value">${address}</div>
            </div>

            ${
              website
                ? `
            <div class="field">
              <div class="field-label">Website</div>
              <div class="field-value">
                <a href="${website}" target="_blank" style="color: #667eea; text-decoration: none;">
                  ${website}
                </a>
              </div>
            </div>
            `
                : ""
            }

            ${
              about
                ? `
            <div class="field">
              <div class="field-label">About the Shop</div>
              <div class="field-value">${about.replace(/\n/g, "<br>")}</div>
            </div>
            `
                : ""
            }

            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #666; margin-bottom: 10px;">
                Please review this application and reach out to the applicant.
              </p>
              <a href="mailto:${email}" class="cta-button">
                Contact Applicant
              </a>
            </div>
          </div>

          <div class="footer">
            <p>This application was submitted through the Bid A Wrap partner application form.</p>
            <p style="margin-top: 10px;">
              Submitted on ${new Date().toLocaleString("en-US", {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email to support
    await sendEmail(
      "support@bidawrap.com",
      `New Partner Application - ${businessName}`,
      emailHTML
    );

    // Optional: Send confirmation email to applicant
    const confirmationHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border: 1px solid #e0e0e0;
              border-top: none;
              border-radius: 0 0 10px 10px;
            }
            .checkmark {
              font-size: 64px;
              color: #4CAF50;
              text-align: center;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Application Received!</h1>
          </div>
          
          <div class="content">
            <div class="checkmark">✓</div>
            
            <h2 style="color: #667eea; text-align: center;">Thank you for your interest, ${contactName}!</h2>
            
            <p>We've received your partner application for <strong>${businessName}</strong>.</p>
            
            <p>Our team will review your application and get back to you.</p>
            
            <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #667eea;">What's Next?</h3>
              <ul style="padding-left: 20px;">
                <li>We'll review your shop's information</li>
                <li>A team member will reach out for any additional details</li>
              </ul>
            </div>
            
            <p>If you have any questions in the meantime, feel free to reach out to us at 
              <a href="mailto:support@bidawrap.com" style="color: #667eea;">support@bidawrap.com</a>
            </p>
            
            <p style="margin-top: 30px;">
              <strong>Best regards,</strong><br>
              The Bid A Wrap Team
            </p>
          </div>
        </body>
      </html>
    `;

    await sendEmail(
      email,
      "Application Received - Bid A Wrap Partner Program",
      confirmationHTML
    );

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Application submitted successfully",
      data: {
        businessName,
        contactName,
        email,
      },
    });
  } catch (error) {
    console.error("❌ Error submitting partner application:", error);
    
    return res.status(500).json({
      success: false,
      message: "Failed to submit application. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};