// models/chatRoomModel.js
import mongoose from "mongoose";

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
    required: true,
  },
  // Multiple references can be attached to one message
  references: [referenceSchema],
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
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

    // Messages with references
    messages: [messageSchema],

    // Last Message Info
    lastMessage: {
      type: String,
      default: null,
    },
    lastMessageTime: {
      type: Date,
      default: null,
    },

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
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
chatRoomSchema.index({ customerId: 1, shopId: 1 });
chatRoomSchema.index({ customerId: 1, isActive: 1 });
chatRoomSchema.index({ shopId: 1, isActive: 1 });
chatRoomSchema.index({ relatedOffers: 1 });
chatRoomSchema.index({ relatedBids: 1 });
chatRoomSchema.index({ isShopToShop: 1 }); // Index for shop-to-shop chats

export default mongoose.model("Chat", chatRoomSchema);