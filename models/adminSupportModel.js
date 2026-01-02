// // models/SupportMessage.js
// import mongoose from "mongoose";

// const supportMessageSchema = new mongoose.Schema(
//   {
//     shopId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Shop",
//       required: true,
//       index: true,
//     },
//     shopName: {
//       type: String,
//       required: true,
//     },
//     shopEmail: {
//       type: String,
//       required: true,
//     },
//     subject: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     message: {
//       type: String,
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ["pending", "replied"],
//       default: "pending",
//       index: true,
//     },
//     reply: {
//       message: {
//         type: String,
//       },
//       repliedAt: {
//         type: Date,
//       },
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// // Index for faster queries
// supportMessageSchema.index({ createdAt: -1 });
// supportMessageSchema.index({ status: 1, createdAt: -1 });

// export default mongoose.model("SupportMessage", supportMessageSchema);









// models/SupportMessage.js
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ["shop", "admin", "system"], // Add "system" here
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  attachments: [{
    url: String,
    filename: String,
    mimetype: String,
    size: Number,
  }],
  readBy: [{
    type: String,
    enum: ["shop", "admin", "system"], // Add "system" here
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const supportConversationSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    shopName: {
      type: String,
      required: true,
    },
    shopEmail: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    messages: [messageSchema],
    status: {
      type: String,
      enum: ["open", "closed", "pending_reply"],
      default: "open",
      index: true,
    },
    lastMessageBy: {
      type: String,
      enum: ["shop", "admin", "system"], // Add "system" here
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    tags: [{
      type: String,
      trim: true,
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
supportConversationSchema.index({ createdAt: -1 });
supportConversationSchema.index({ status: 1, lastMessageAt: -1 });
supportConversationSchema.index({ shopId: 1, lastMessageAt: -1 });
supportConversationSchema.index({ assignedTo: 1, status: 1 });
supportConversationSchema.index({ "messages.readBy": 1 });

// Virtual for unread count for shop
supportConversationSchema.virtual("unreadCountForShop").get(function() {
  return this.messages.filter(
    msg => msg.sender === "admin" && !msg.readBy.includes("shop")
  ).length;
});

// Virtual for unread count for admin
supportConversationSchema.virtual("unreadCountForAdmin").get(function() {
  return this.messages.filter(
    msg => msg.sender === "shop" && !msg.readBy.includes("admin")
  ).length;
});

// Method to add a new message
supportConversationSchema.methods.addMessage = function(sender, message, attachments = []) {
  const newMessage = {
    sender,
    message,
    attachments,
    readBy: [sender], // Sender has read their own message
    createdAt: new Date(),
  };
  
  this.messages.push(newMessage);
  this.lastMessageAt = new Date();
  this.lastMessageBy = sender;
  
  // Update status
  if (sender === "shop") {
    this.status = "pending_reply";
  } else if (sender === "admin") {
    this.status = "open"; // Keep open when admin replies
  }
  
  return newMessage;
};

// Method to mark messages as read
supportConversationSchema.methods.markAsRead = function(reader) {
  const unreadMessages = this.messages.filter(
    msg => msg.sender !== reader && !msg.readBy.includes(reader)
  );
  
  unreadMessages.forEach(msg => {
    msg.readBy.push(reader);
  });
  
  return unreadMessages.length;
};

// Pre-save middleware to update timestamps
supportConversationSchema.pre("save", function(next) {
  if (this.isModified("messages")) {
    this.lastMessageAt = new Date();
  }
  next();
});

export default mongoose.model("SupportConversation", supportConversationSchema);