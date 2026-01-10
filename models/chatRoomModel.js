// // models/chatRoomModel.js
// import mongoose from "mongoose";

// // Reference schema for offers/bids/counter-offers attached to messages
// const referenceSchema = new mongoose.Schema({
//   type: {
//     type: String,
//     enum: ["offer", "bid", "counterOffer"],
//     required: true,
//   },
//   referenceId: {
//     type: mongoose.Schema.Types.ObjectId,
//     required: true,
//   },
//   // Cached data for quick display (denormalized)
//   data: {
//     price: Number,
//     description: String,
//     status: String,
//     serviceDescription: String,
//     vehicle: String,
//     proposedPrice: Number,
//     message: String,
//   },
// });

// const messageSchema = new mongoose.Schema({
//   senderId: {
//     type: mongoose.Schema.Types.ObjectId,
//     required: true,
//   },
//   senderType: {
//     type: String,
//     enum: ["customer", "shop"],
//     required: true,
//   },
//   senderName: {
//     type: String,
//     required: true,
//   },
//   text: {
//     type: String,
//     required: true,
//   },
//   // Multiple references can be attached to one message
//   references: [referenceSchema],
//   isRead: {
//     type: Boolean,
//     default: false,
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// const chatRoomSchema = new mongoose.Schema(
//   {
//     // Participants
//     customerId: {
//       type: mongoose.Schema.Types.ObjectId,
//       refPath: 'customerModel',
//       required: true,
//     },
//     customerModel: {
//       type: String,
//       enum: ["Customer", "Shop"],
//       required: true,
//     },
//     shopId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Shop",
//       required: true,
//     },

//     // Flag to identify shop-to-shop chats
//     isShopToShop: {
//       type: Boolean,
//       default: false,
//     },

//     // Context: All offers/bids/counter-offers discussed in this chat
//     relatedOffers: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Offer",
//     }],
//     relatedBids: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Bid",
//     }],
//     relatedCounterOffers: [{
//       type: mongoose.Schema.Types.ObjectId,
//     }],

//     // Customer Information (for both customers and shops when in shop-to-shop mode)
//     customerName: {
//       type: String,
//       required: true,
//     },
//     customerAvatar: {
//       type: String,
//       default: null,
//     },

//     // Shop Information
//     shopName: {
//       type: String,
//       required: true,
//     },
//     shopAvatar: {
//       type: String,
//       default: null,
//     },

//     // Messages with references
//     messages: [messageSchema],

//     // Last Message Info
//     lastMessage: {
//       type: String,
//       default: null,
//     },
//     lastMessageTime: {
//       type: Date,
//       default: null,
//     },

//     // Unread Counts
//     unreadCountCustomer: {
//       type: Number,
//       default: 0,
//     },
//     unreadCountShop: {
//       type: Number,
//       default: 0,
//     },

//     // Status
//     isActive: {
//       type: Boolean,
//       default: true,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// // Index for faster queries
// chatRoomSchema.index({ customerId: 1, shopId: 1 });
// chatRoomSchema.index({ customerId: 1, isActive: 1 });
// chatRoomSchema.index({ shopId: 1, isActive: 1 });
// chatRoomSchema.index({ relatedOffers: 1 });
// chatRoomSchema.index({ relatedBids: 1 });
// chatRoomSchema.index({ isShopToShop: 1 }); // Index for shop-to-shop chats

// export default mongoose.model("Chat", chatRoomSchema);




















// models/chatRoomModel.js
import mongoose from "mongoose";

// Image schema for storing Cloudinary image data
const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number, // in bytes
    required: true,
  },
  fileType: {
    type: String,
    required: true,
  },
  width: {
    type: Number,
    default: null,
  },
  height: {
    type: Number,
    default: null,
  },
  thumbnailUrl: {
    type: String,
    default: null,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

// Reference schema for offers/bids/counter-offers attached to messages
const referenceSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["offer", "bid", "counterOffer"],
    required: true,
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  // Cached data for quick display (denormalized)
  data: {
    price: Number,
    description: String,
    status: String,
    serviceDescription: String,
    vehicle: String,
    proposedPrice: Number,
    message: String,
  },
});

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  senderType: {
    type: String,
    enum: ["customer", "shop"],
    required: true,
  },
  senderName: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    default: "",
  },
  // Array of images attached to this message
  images: [imageSchema],
  // Multiple references can be attached to one message
  references: [referenceSchema],
  isRead: {
    type: Boolean,
    default: false,
  },
  readBy: [{
    userId: mongoose.Schema.Types.ObjectId,
    readAt: {
      type: Date,
      default: Date.now,
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // For message deletion/editing
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  editedAt: {
    type: Date,
    default: null,
  },
});

const chatRoomSchema = new mongoose.Schema(
  {
    // Participants
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'customerModel',
      required: true,
    },
    customerModel: {
      type: String,
      enum: ["Customer", "Shop"],
      required: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    // Flag to identify shop-to-shop chats
    isShopToShop: {
      type: Boolean,
      default: false,
    },

    // Context: All offers/bids/counter-offers discussed in this chat
    relatedOffers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
    }],
    relatedBids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
    }],
    relatedCounterOffers: [{
      type: mongoose.Schema.Types.ObjectId,
    }],

    // Customer Information (for both customers and shops when in shop-to-shop mode)
    customerName: {
      type: String,
      required: true,
    },
    customerAvatar: {
      type: String,
      default: null,
    },

    // Shop Information
    shopName: {
      type: String,
      required: true,
    },
    shopAvatar: {
      type: String,
      default: null,
    },

    // Messages with references and images
    messages: [messageSchema],

    // Last Message Info
    lastMessage: {
      type: String,
      default: null,
    },
    lastMessageType: {
      type: String,
      enum: ["text", "image", "reference"],
      default: "text",
    },
    lastMessageTime: {
      type: Date,
      default: null,
    },
    lastMessageImages: [{
      type: String, // Store first image URL for preview
    }],

    // Unread Counts
    unreadCountCustomer: {
      type: Number,
      default: 0,
    },
    unreadCountShop: {
      type: Number,
      default: 0,
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Settings
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
chatRoomSchema.index({ customerId: 1, shopId: 1 });
chatRoomSchema.index({ customerId: 1, isActive: 1 });
chatRoomSchema.index({ shopId: 1, isActive: 1 });
chatRoomSchema.index({ relatedOffers: 1 });
chatRoomSchema.index({ relatedBids: 1 });
chatRoomSchema.index({ isShopToShop: 1 });
chatRoomSchema.index({ "messages.createdAt": -1 }); // For message sorting
chatRoomSchema.index({ "messages.senderId": 1 }); // For finding user's messages
chatRoomSchema.index({ "messages.images.publicId": 1 }); // For image queries
chatRoomSchema.index({ updatedAt: -1 }); // For chat list ordering

// Middleware to update last message info
chatRoomSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    const lastMsg = this.messages[this.messages.length - 1];
    
    if (lastMsg.images && lastMsg.images.length > 0) {
      // If message has images
      this.lastMessage = `📷 ${lastMsg.images.length} image${lastMsg.images.length > 1 ? 's' : ''}`;
      this.lastMessageType = "image";
      this.lastMessageImages = lastMsg.images.slice(0, 3).map(img => img.url); // Store first 3 images for preview
    } else if (lastMsg.references && lastMsg.references.length > 0) {
      // If message has references
      this.lastMessage = `📎 ${lastMsg.references.length} attachment${lastMsg.references.length > 1 ? 's' : ''}`;
      this.lastMessageType = "reference";
    } else if (lastMsg.text) {
      // If it's a text message
      this.lastMessage = lastMsg.text;
      this.lastMessageType = "text";
    }
    
    this.lastMessageTime = lastMsg.createdAt;
    
    // Update unread counts
    if (!lastMsg.isRead) {
      if (lastMsg.senderType === "customer") {
        this.unreadCountShop += 1;
      } else {
        this.unreadCountCustomer += 1;
      }
    }
  }
  next();
});

// Static method to update unread counts
chatRoomSchema.statics.markAsRead = async function(chatId, userId, userType) {
  const chat = await this.findById(chatId);
  if (!chat) return null;

  const messagesToUpdate = chat.messages.filter(msg => 
    !msg.isRead && 
    msg.senderType !== userType
  );

  if (messagesToUpdate.length > 0) {
    messagesToUpdate.forEach(msg => {
      msg.isRead = true;
      msg.readBy.push({
        userId: userId,
        readAt: new Date(),
      });
    });

    if (userType === "customer") {
      chat.unreadCountCustomer = Math.max(0, chat.unreadCountCustomer - messagesToUpdate.length);
    } else {
      chat.unreadCountShop = Math.max(0, chat.unreadCountShop - messagesToUpdate.length);
    }

    return chat.save();
  }

  return chat;
};

// Static method to add a message
chatRoomSchema.statics.addMessage = async function(chatId, messageData) {
  return this.findByIdAndUpdate(
    chatId,
    {
      $push: { messages: messageData },
      $set: { updatedAt: new Date() },
    },
    { new: true }
  );
};

// Static method to get paginated messages
chatRoomSchema.statics.getMessages = async function(chatId, page = 1, limit = 15) {
  const chat = await this.findById(chatId).select('messages');
  if (!chat) return null;

  const startIndex = Math.max(0, chat.messages.length - (page * limit));
  const endIndex = chat.messages.length - ((page - 1) * limit);
  const messages = chat.messages.slice(startIndex, endIndex).reverse();

  const totalPages = Math.ceil(chat.messages.length / limit);
  const hasMore = page < totalPages;

  return {
    messages,
    pagination: {
      currentPage: page,
      totalPages,
      hasMore,
      totalMessages: chat.messages.length,
    },
  };
};

export default mongoose.model("Chat", chatRoomSchema);