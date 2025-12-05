import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    vehicleYear: { type: String, trim: true },
    vehicleMake: { type: String, trim: true },
    vehicleModel: { type: String, trim: true },
    vehicleTrim: { type: String, trim: true },
    vehicleCondition: { type: Number },
    vehicleImages: [{ type: String }],

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

    dueDate: { type: Date },

    status: {
      type: String,
      enum: ["active", "in_progress", "completed", "expired", "canceled"],
      default: "active",
    },

    offers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Offer",
      },
    ],
    contactMethod: {
      type: String,
      enum: ["email", "sms", "both"],
      default: "email",
    },



    acceptedOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },


    currentShopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      default: null,
    },
    reviewed: {
      type: Boolean,
      default: false,
    }

  },
  { timestamps: true }
);

bidSchema.pre("save", function (next) {
  if (!this.createdAt) this.createdAt = new Date();
  next();
});

bidSchema.methods.isExpired = function () {
  const now = new Date();
  const createdAt = new Date(this.createdAt);
  const dueDate = this.dueDate ? new Date(this.dueDate) : null;

  const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
  if (this.status === "active" && hoursSinceCreation >= 48) return true;
  if (this.status === "active" && dueDate && now > dueDate) return true;

  return false;
};

// FIX: Prevent OverwriteModelError
export default mongoose.models.Bid || mongoose.model("Bid", bidSchema);
