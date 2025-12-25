import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  senderType: {
    type: String,
    enum: ["admin", "shop"],
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.Mixed, // CHANGED: ObjectId → Mixed
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  attachments: [{
    type: String,
    trim: true
  }],
  readBy: [{
    userId: mongoose.Schema.Types.Mixed, // CHANGED: ObjectId → Mixed
    readAt: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const adminChatSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
    index: true
  },
  shopName: {
    type: String,
    trim: true
  },
  lastMessage: {
    type: String,
    trim: true
  },
  lastMessageTime: {
    type: Date
  },
  lastSender: {
    type: String,
    enum: ["admin", "shop"]
  },
  unreadCountAdmin: {
    type: Number,
    default: 0
  },
  unreadCountShop: {
    type: Number,
    default: 0
  },
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Create index for faster queries
adminChatSchema.index({ shopId: 1, updatedAt: -1 });

export default mongoose.models.AdminChat || mongoose.model("AdminChat", adminChatSchema);