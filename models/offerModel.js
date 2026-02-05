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
      enum: ["pending", "accepted", "rejected","canceled"],
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
    
    // --- New field for counter offers ---
    counterOffers: [counterOfferSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Offer", offerSchema);
