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
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },

    // --- New field for counter offers ---
    counterOffers: [counterOfferSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Offer", offerSchema);
