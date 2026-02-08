import mongoose from "mongoose";

const counterOfferSchema = new mongoose.Schema(
  {
    counterPrice: { type: Number, required: true },
    message: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
  },
  { _id: true }
);

// Attachment schema for file uploads
const attachmentSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// In your Offer model (backend)
const offerSchema = new mongoose.Schema(
  {
    bidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
      required: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    message: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "canceled"],
      default: "pending",
    },
    
    // --- Appointment/Availability Fields ---
    appointmentDate: {
      type: Date,
      default: null,
    },
    appointmentTime: {
      type: String,
      trim: true,
      default: null,
    },
    estimatedCompletionDays: {
      type: Number,
      default: null,
    },
    workingHours: {
      start: { type: String, trim: true, default: null }, // e.g., "09:00"
      end: { type: String, trim: true, default: null },   // e.g., "17:00"
    },
    // --- End Appointment Fields ---
    
    // --- Attachments for file uploads ---
    attachments: [attachmentSchema],
    
    // --- New field for counter offers ---
    counterOffers: [counterOfferSchema],
    
    // --- Sub-account tracking ---
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShopUser",
      default: null
    },
    createdByType: {
      type: String,
      enum: ["shop", "shop_user"],
      default: "shop"
    }
  },
  { timestamps: true }
);

// Indexes for better query performance
offerSchema.index({ bidId: 1, shopId: 1 }, { unique: true }); // Prevent duplicate offers
offerSchema.index({ shopId: 1, status: 1 });
offerSchema.index({ bidId: 1, status: 1 });
offerSchema.index({ createdAt: -1 });

export default mongoose.model("Offer", offerSchema);