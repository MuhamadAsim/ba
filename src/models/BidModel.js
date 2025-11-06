import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    // Link to the Customer (who created this bid)
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    // Vehicle details
    vehicleYear: { type: String, trim: true },
    vehicleMake: { type: String, trim: true },
    vehicleModel: { type: String, trim: true },
    vehicleTrim: { type: String, trim: true },
    vehicleCondition: { type: Number },
    vehicleImages: [{ type: String }],

    // Request details
    requestCategory: { type: String, trim: true },
    serviceDescription: { type: String, trim: true },
    desiredFinish: { type: String, trim: true },
    hasExistingWrap: { type: String, trim: true },
    ppfCoverage: { type: String, trim: true },
    brandingWrapCoverage: { type: String, trim: true },
    hasDesign: { type: String, trim: true },
    hasLogo: { type: String, trim: true },
    artworkFiles: [{ type: String }],
    exampleFiles: [{ type: String }],

    // Deadline
    dueDate: { type: Date },

    // Bid lifecycle
    status: {
      type: String,
      enum: ["active", "in_progress", "completed", "expired", "canceled"],
      default: "active",
    },

    // Offers from shops
    offers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Offer",
      },
    ],

    // The accepted offer (if customer accepts one)
    acceptedOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },
  },
  { timestamps: true }
);

// Auto-expire logic
bidSchema.pre("save", function (next) {
  if (!this.createdAt) this.createdAt = new Date();
  next();
});

// Optional helper function to check expiration
bidSchema.methods.isExpired = function () {
  const now = new Date();
  const createdAt = new Date(this.createdAt);
  const dueDate = this.dueDate ? new Date(this.dueDate) : null;

  // 48-hour expiration for active bids
  const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
  if (this.status === "active" && hoursSinceCreation >= 48) return true;

  // Expire if due date has passed
  if (this.status === "active" && dueDate && now > dueDate) return true;

  return false;
};

export default mongoose.model("Bid", bidSchema);
