
// ============================================
// models/Chat.js
// ============================================
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    senderType: {
      type: String,
      enum: ["customer", "shop"],
      required: true,
    },
    senderName: String,
    text: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

const chatSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerAvatar: String,
    shopName: {
      type: String,
      required: true,
    },
    shopAvatar: String,
    messages: [messageSchema],
    lastMessage: String,
    lastMessageTime: Date,
    unreadCountCustomer: {
      type: Number,
      default: 0,
    },
    unreadCountShop: {
      type: Number,
      default: 0,
    },
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
chatSchema.index({ customerId: 1, shopId: 1 });
chatSchema.index({ updatedAt: -1 });

const Chat = mongoose.model("Chat", chatSchema);
export default Chat;