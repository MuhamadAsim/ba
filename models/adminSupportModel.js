import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ["shop", "admin", "system", "customer"],
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
    enum: ["shop", "admin", "system", "customer"],
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const supportConversationSchema = new mongoose.Schema(
  {
    // Support type: 'shop' or 'customer'
    type: {
      type: String,
      enum: ["shop", "customer"],
      required: true,
      index: true,
    },
    
    // Shop-specific fields
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      index: true,
    },
    shopName: {
      type: String,
    },
    shopEmail: {
      type: String,
    },
    
    // Customer-specific fields
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    customerName: {
      type: String,
    },
    customerEmail: {
      type: String,
    },
    
    // Common fields
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
      enum: ["shop", "admin", "system", "customer"],
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
supportConversationSchema.index({ type: 1, status: 1, lastMessageAt: -1 });
supportConversationSchema.index({ shopId: 1, lastMessageAt: -1 });
supportConversationSchema.index({ customerId: 1, lastMessageAt: -1 });
supportConversationSchema.index({ assignedTo: 1, status: 1 });
supportConversationSchema.index({ "messages.readBy": 1 });

// Virtual for unread count for shop/customer
supportConversationSchema.virtual("unreadCountForUser").get(function() {
  if (this.type === "shop") {
    return this.messages.filter(
      msg => msg.sender === "admin" && !msg.readBy.includes("shop")
    ).length;
  } else if (this.type === "customer") {
    return this.messages.filter(
      msg => msg.sender === "admin" && !msg.readBy.includes("customer")
    ).length;
  }
  return 0;
});

// Virtual for unread count for admin
supportConversationSchema.virtual("unreadCountForAdmin").get(function() {
  if (this.type === "shop") {
    return this.messages.filter(
      msg => msg.sender === "shop" && !msg.readBy.includes("admin")
    ).length;
  } else if (this.type === "customer") {
    return this.messages.filter(
      msg => msg.sender === "customer" && !msg.readBy.includes("admin")
    ).length;
  }
  return 0;
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
  if (sender === "shop" || sender === "customer") {
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