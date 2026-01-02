// // controllers/supportController.js
// import SupportMessage from "../models/adminSupportModel.js";
// import Shop from "../models/shopModel.js"; // Adjust path as needed
// import { sendEmail } from "../utils/sendEmail.js"; // Your email service



// // ==================== SHOP ENDPOINTS ====================

// // @desc    Get all messages for logged-in shop
// // @route   GET /api/support/shop/messages
// // @access  Private (Shop)
// export const getShopMessages = async (req, res) => {
//   try {
//     const shopId = req.shop._id; // From shop auth middleware

//     const messages = await SupportMessage.find({ shopId })
//       .sort({ createdAt: -1 })
//       .select("-__v");

//     res.status(200).json({
//       success: true,
//       count: messages.length,
//       data: messages,
//     });
//   } catch (error) {
//     console.error("Error fetching shop messages:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching messages",
//       error: error.message,
//     });
//   }
// };

// // @desc    Send new message to admin
// // @route   POST /api/support/shop/send
// // @access  Private (Shop)
// export const sendShopMessage = async (req, res) => {
//   try {
//     const shopId = req.shop._id;
//     const { subject, message } = req.body;

//     // Validation
//     if (!subject || !message) {
//       return res.status(400).json({
//         success: false,
//         message: "Subject and message are required",
//       });
//     }

//     // Get shop details
//     const shop = await Shop.findById(shopId).select("businessName email");
    
//     if (!shop) {
//       return res.status(404).json({
//         success: false,
//         message: "Shop not found",
//       });
//     }

//     // Create support message
//     const supportMessage = await SupportMessage.create({
//       shopId,
//       shopName: shop.businessName, // Using businessName from Shop model
//       shopEmail: shop.email,
//       subject,
//       message,
//     });

//     // Send email notification to admin
//     try {
//       const adminEmail = process.env.ADMIN_EMAIL;
      
//       const emailHtml = `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
//             New Support Message
//           </h2>
//           <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
//             <p style="margin: 0 0 10px 0;"><strong>From Shop:</strong> ${shop.businessName}</p>
//             <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${shop.email}</p>
//             <p style="margin: 0 0 10px 0;"><strong>Subject:</strong> ${subject}</p>
//             <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 6px;">
//               <strong>Message:</strong>
//               <p style="margin-top: 10px; white-space: pre-wrap;">${message}</p>
//             </div>
//           </div>
//           <p style="color: #666; font-size: 14px;">
//             Please log in to the admin panel to reply to this message.
//           </p>
//         </div>
//       `;

//       await sendEmail(
//         adminEmail,
//         `New Support Message: ${subject}`,
//         emailHtml
//       );
//     } catch (emailError) {
//       console.error("Failed to send email notification:", emailError);
//       // Don't fail the request if email fails
//     }

//     res.status(201).json({
//       success: true,
//       message: "Message sent successfully",
//       data: supportMessage,
//     });
//   } catch (error) {
//     console.error("Error sending shop message:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error sending message",
//       error: error.message,
//     });
//   }
// };

// // ==================== ADMIN ENDPOINTS ====================

// // @desc    Get all messages from all shops
// // @route   GET /api/support/admin/messages
// // @access  Private (Admin)
// export const getAdminMessages = async (req, res) => {
//   try {
//     const messages = await SupportMessage.find()
//       .sort({ createdAt: -1 })
//       .select("-__v");

//     res.status(200).json({
//       success: true,
//       count: messages.length,
//       data: messages,
//     });
//   } catch (error) {
//     console.error("Error fetching admin messages:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching messages",
//       error: error.message,
//     });
//   }
// };

// // @desc    Reply to a support message
// // @route   POST /api/support/admin/reply/:id
// // @access  Private (Admin)
// export const replyToMessage = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { message } = req.body;

//     // Validation
//     if (!message) {
//       return res.status(400).json({
//         success: false,
//         message: "Reply message is required",
//       });
//     }

//     // Find the support message
//     const supportMessage = await SupportMessage.findById(id);

//     if (!supportMessage) {
//       return res.status(404).json({
//         success: false,
//         message: "Support message not found",
//       });
//     }

//     // Check if already replied
//     if (supportMessage.status === "replied") {
//       return res.status(400).json({
//         success: false,
//         message: "This message has already been replied to",
//       });
//     }

//     // Update with reply
//     supportMessage.reply = {
//       message,
//       repliedAt: new Date(),
//     };
//     supportMessage.status = "replied";

//     await supportMessage.save();

//     // Send email notification to shop
//     try {
//       const emailHtml = `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2 style="color: #333; border-bottom: 2px solid #10B981; padding-bottom: 10px;">
//             Admin Reply to Your Support Message
//           </h2>
//           <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
//             <p style="margin: 0 0 10px 0;"><strong>Your Subject:</strong> ${supportMessage.subject}</p>
            
//             <div style="margin: 20px 0; padding: 15px; background: #e5e7eb; border-radius: 6px;">
//               <strong>Your Message:</strong>
//               <p style="margin-top: 10px; white-space: pre-wrap;">${supportMessage.message}</p>
//             </div>

//             <div style="margin-top: 20px; padding: 15px; background: #d1fae5; border-left: 4px solid #10B981; border-radius: 6px;">
//               <strong style="color: #059669;">Admin Reply:</strong>
//               <p style="margin-top: 10px; white-space: pre-wrap; color: #065f46;">${message}</p>
//             </div>
//           </div>
//           <p style="color: #666; font-size: 14px;">
//             Please log in to your shop dashboard to view this message.
//           </p>
//         </div>
//       `;

//       await sendEmail(
//         supportMessage.shopEmail,
//         `Re: ${supportMessage.subject}`,
//         emailHtml
//       );
//     } catch (emailError) {
//       console.error("Failed to send email notification:", emailError);
//       // Don't fail the request if email fails
//     }

//     res.status(200).json({
//       success: true,
//       message: "Reply sent successfully",
//       data: supportMessage,
//     });
//   } catch (error) {
//     console.error("Error replying to message:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error sending reply",
//       error: error.message,
//     });
//   }
// };












// controllers/supportController.js
import SupportConversation from "../models/adminSupportModel.js";
import Shop from "../models/shopModel.js";
import { sendEmail } from "../utils/sendEmail.js";

// ==================== SHOP ENDPOINTS ====================

// @desc    Get all conversations for logged-in shop
// @route   GET /api/support/shop/conversations
// @access  Private (Shop)
export const getShopConversations = async (req, res) => {
  try {
    const shopId = req.shop._id; // From shop auth middleware
    const { status, page = 1, limit = 20 } = req.query;

    const query = { shopId };
    if (status) query.status = status;

    const conversations = await SupportConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select("-messages") // Don't send all messages initially
      .lean();

    // Add unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const fullConv = await SupportConversation.findById(conv._id);
        return {
          ...conv,
          unreadCount: fullConv.messages.filter(
            msg => msg.sender === "admin" && !msg.readBy.includes("shop")
          ).length,
          lastMessage: fullConv.messages[fullConv.messages.length - 1] || null,
        };
      })
    );

    const total = await SupportConversation.countDocuments(query);

    res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversationsWithUnread,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching shop conversations:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching conversations",
      error: error.message,
    });
  }
};

// @desc    Get single conversation with all messages
// @route   GET /api/support/shop/conversations/:conversationId
// @access  Private (Shop)
export const getShopConversation = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const { conversationId } = req.params;

    const conversation = await SupportConversation.findOne({
      _id: conversationId,
      shopId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Mark all admin messages as read by shop
    conversation.markAsRead("shop");
    await conversation.save();

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching conversation",
      error: error.message,
    });
  }
};

// @desc    Start new conversation with admin
// @route   POST /api/support/shop/conversations
// @access  Private (Shop)
export const createConversation = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const { subject, message, attachments = [] } = req.body;

    // Validation
    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Subject and message are required",
      });
    }

    // Get shop details
    const shop = await Shop.findById(shopId).select("businessName email avatar");
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Create conversation with first message
    const conversation = new SupportConversation({
      shopId,
      shopName: shop.businessName,
      shopEmail: shop.email,
      subject,
      status: "pending_reply",
      lastMessageBy: "shop",
    });

    conversation.addMessage("shop", message, attachments);
    await conversation.save();

    // Send email notification to admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
            New Support Conversation Started
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
          <div style="background: #e0e7ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; color: #3730a3;">
              <strong>Conversation ID:</strong> ${conversation._id}
            </p>
          </div>
          <p style="color: #666; font-size: 14px;">
            Please log in to the admin panel to reply to this conversation.
          </p>
        </div>
      `;

      await sendEmail(
        adminEmail,
        `New Support Conversation: ${subject}`,
        emailHtml
      );
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: "Conversation started successfully",
      data: conversation,
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({
      success: false,
      message: "Error starting conversation",
      error: error.message,
    });
  }
};

// @desc    Add message to existing conversation (shop replies)
// @route   POST /api/support/shop/conversations/:conversationId/messages
// @access  Private (Shop)
export const addShopMessage = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const { conversationId } = req.params;
    const { message, attachments = [] } = req.body;

    // Validation
    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const conversation = await SupportConversation.findOne({
      _id: conversationId,
      shopId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Check if conversation is closed
    if (conversation.status === "closed") {
      return res.status(400).json({
        success: false,
        message: "Cannot add message to closed conversation",
      });
    }

    // Add shop's message
    const newMessage = conversation.addMessage("shop", message, attachments);
    await conversation.save();

    // Send email notification to admin about shop's reply
    try {
      const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #7C3AED; padding-bottom: 10px;">
            Shop Replied to Support Conversation
          </h2>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Shop:</strong> ${conversation.shopName}</p>
            <p style="margin: 0 0 10px 0;"><strong>Subject:</strong> ${conversation.subject}</p>
            <p style="margin: 0 0 10px 0;"><strong>Conversation ID:</strong> ${conversation._id}</p>
            <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 6px;">
              <strong>New Reply:</strong>
              <p style="margin-top: 10px; white-space: pre-wrap;">${message}</p>
            </div>
          </div>
          <p style="color: #666; font-size: 14px;">
            This conversation now has ${conversation.messages.length} messages.
            Please log in to the admin panel to reply.
          </p>
        </div>
      `;

      await sendEmail(
        adminEmail,
        `Shop Replied: ${conversation.subject}`,
        emailHtml
      );
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
    }

    res.status(200).json({
      success: true,
      message: "Message sent successfully",
      data: newMessage,
    });
  } catch (error) {
    console.error("Error adding shop message:", error);
    res.status(500).json({
      success: false,
      message: "Error sending message",
      error: error.message,
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

// @desc    Get all conversations (admin view)
// @route   GET /api/support/admin/conversations
// @access  Private (Admin)
export const getAdminConversations = async (req, res) => {
  try {
    const { 
      status, 
      assignedTo, 
      priority, 
      search,
      page = 1, 
      limit = 50 
    } = req.query;

    const query = {};
    
    // Apply filters
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;
    if (priority) query.priority = priority;
    
    // Search filter
    if (search) {
      query.$or = [
        { shopName: { $regex: search, $options: "i" } },
        { shopEmail: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { "messages.message": { $regex: search, $options: "i" } },
      ];
    }

    const conversations = await SupportConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("shopId", "businessName email avatar")
      .populate("assignedTo", "name email")
      .select("-messages") // Don't send all messages initially
      .lean();

    // Add unread count for admin
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const fullConv = await SupportConversation.findById(conv._id);
        const unreadCount = fullConv.messages.filter(
          msg => msg.sender === "shop" && !msg.readBy.includes("admin")
        ).length;
        
        const lastMessage = fullConv.messages[fullConv.messages.length - 1] || null;
        
        return {
          ...conv,
          unreadCount,
          lastMessage,
          messageCount: fullConv.messages.length,
        };
      })
    );

    const total = await SupportConversation.countDocuments(query);

    res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversationsWithUnread,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching admin conversations:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching conversations",
      error: error.message,
    });
  }
};

// @desc    Get single conversation (admin view)
// @route   GET /api/support/admin/conversations/:conversationId
// @access  Private (Admin)
export const getAdminConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await SupportConversation.findById(conversationId)
      .populate("shopId", "businessName email avatar phone address")
      .populate("assignedTo", "name email");

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Mark all shop messages as read by admin
    conversation.markAsRead("admin");
    await conversation.save();

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching conversation",
      error: error.message,
    });
  }
};

// @desc    Admin adds message to conversation
// @route   POST /api/support/admin/conversations/:conversationId/messages
// @access  Private (Admin)
export const addAdminMessage = async (req, res) => {
  try {
    const adminId = req.admin?._id; // From admin auth middleware
    const { conversationId } = req.params;
    const { message, attachments = [], closeConversation = false } = req.body;

    // Validation
    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const conversation = await SupportConversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Add admin's message
    const newMessage = conversation.addMessage("admin", message, attachments);
    
    // Assign to admin if not already assigned
    if (!conversation.assignedTo && adminId) {
      conversation.assignedTo = adminId;
    }

    // Close conversation if requested
    if (closeConversation) {
      conversation.status = "closed";
    }

    await conversation.save();

    // Send email notification to shop about admin's reply
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #10B981; padding-bottom: 10px;">
            Admin Replied to Your Support Conversation
          </h2>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Subject:</strong> ${conversation.subject}</p>
            <p style="margin: 0 0 10px 0;"><strong>Conversation ID:</strong> ${conversation._id}</p>
            
            <div style="margin-top: 20px; padding: 15px; background: #d1fae5; border-left: 4px solid #10B981; border-radius: 6px;">
              <strong style="color: #059669;">Admin's Reply:</strong>
              <p style="margin-top: 10px; white-space: pre-wrap; color: #065f46;">${message}</p>
            </div>
            
            ${attachments.length > 0 ? `
            <div style="margin-top: 20px;">
              <strong>Attachments (${attachments.length}):</strong>
              <ul style="margin: 10px 0 0 20px; padding: 0;">
                ${attachments.map(att => `
                  <li style="margin-bottom: 5px;">
                    <a href="${att.url}" style="color: #4F46E5; text-decoration: none;">
                      ${att.filename}
                    </a>
                    (${(att.size / 1024).toFixed(2)} KB)
                  </li>
                `).join('')}
              </ul>
            </div>
            ` : ''}
            
            ${closeConversation ? `
            <div style="margin-top: 20px; padding: 15px; background: #fee2e2; border-left: 4px solid #dc2626; border-radius: 6px;">
              <p style="margin: 0; color: #7f1d1d;">
                <strong>Note:</strong> This conversation has been marked as closed. 
                You can still view the conversation history but cannot add new messages.
              </p>
            </div>
            ` : ''}
          </div>
          <p style="color: #666; font-size: 14px;">
            ${closeConversation 
              ? 'If you have further questions, please start a new conversation.' 
              : 'You can log in to your shop dashboard to reply to this message.'}
          </p>
        </div>
      `;

      await sendEmail(
        conversation.shopEmail,
        `Re: ${conversation.subject}${closeConversation ? ' [CLOSED]' : ''}`,
        emailHtml
      );
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
    }

    res.status(200).json({
      success: true,
      message: "Reply sent successfully",
      data: {
        message: newMessage,
        conversationStatus: conversation.status,
      },
    });
  } catch (error) {
    console.error("Error adding admin message:", error);
    res.status(500).json({
      success: false,
      message: "Error sending reply",
      error: error.message,
    });
  }
};




// @desc    Update conversation (status, priority, assign, etc.)
// @route   PUT /api/support/admin/conversations/:conversationId
// @access  Private (Admin)
export const updateConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { status, assignedTo, priority, tags } = req.body;

    const conversation = await SupportConversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Update fields if provided
    const updates = {};
    if (status) {
      updates.status = status;
      // If closing conversation, add a system message
      if (status === "closed" && conversation.status !== "closed") {
        conversation.addMessage("admin", "Conversation closed by admin.");
      }
    }
    if (assignedTo) updates.assignedTo = assignedTo;
    if (priority) updates.priority = priority;
    if (tags) updates.tags = tags;

    Object.assign(conversation, updates);
    await conversation.save();

    res.status(200).json({
      success: true,
      message: "Conversation updated successfully",
      data: conversation,
    });
  } catch (error) {
    console.error("Error updating conversation:", error);
    res.status(500).json({
      success: false,
      message: "Error updating conversation",
      error: error.message,
    });
  }
};

// @desc    Get conversation statistics for admin dashboard
// @route   GET /api/support/admin/statistics
// @access  Private (Admin)
export const getConversationStats = async (req, res) => {
  try {
    const [
      totalConversations,
      openConversations,
      pendingReply,
      closedConversations,
      conversationsByPriority,
      conversationsByDay,
    ] = await Promise.all([
      // Total conversations
      SupportConversation.countDocuments(),
      
      // Open conversations
      SupportConversation.countDocuments({ status: "open" }),
      
      // Pending reply
      SupportConversation.countDocuments({ status: "pending_reply" }),
      
      // Closed conversations
      SupportConversation.countDocuments({ status: "closed" }),
      
      // Conversations by priority
      SupportConversation.aggregate([
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      
      // Conversations created by day (last 7 days)
      SupportConversation.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalConversations,
        open: openConversations,
        pendingReply,
        closed: closedConversations,
        byPriority: conversationsByPriority,
        last7Days: conversationsByDay,
        averageMessages: totalConversations > 0 ? 
          await SupportConversation.aggregate([
            { $project: { messageCount: { $size: "$messages" } } },
            { $group: { _id: null, avg: { $avg: "$messageCount" } } }
          ]).then(res => res[0]?.avg || 0) : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
};