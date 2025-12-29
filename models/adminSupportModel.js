// models/SupportMessage.js
import mongoose from "mongoose";

const supportMessageSchema = new mongoose.Schema(
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
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "replied"],
      default: "pending",
      index: true,
    },
    reply: {
      message: {
        type: String,
      },
      repliedAt: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
supportMessageSchema.index({ createdAt: -1 });
supportMessageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("SupportMessage", supportMessageSchema);