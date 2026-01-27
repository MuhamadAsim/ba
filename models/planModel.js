import mongoose from "mongoose";
const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
      unique: true,
      index: true,
    },
    descriptionPoints: {
      type: [String],
    },
    tags: {
      type: [String],
      default: [],
      enum: [ 
        'most-popular',
        'budget-friendly', 
        'feature-rich',
        'best-value',
        'recommended',
        'new'
      ],
    },
    price: {
      type: Number,
      required: [true, "Plan price is required"],
      min: [0, "Price cannot be negative"],
    },
    currency: {
      type: String,
      required: [true, "Currency is required"],
      default: "USD",
      uppercase: true,
      enum: ["USD"], 
    },
    interval: {
      type: String,
      default: "month",
      enum: ["month"],
    },
    stripeProductId: {
      type: String,
      required: true,
      unique: true,
    },
    stripePriceId: {
      type: String,
      required: true,
      unique: true,
    },
    features: {
      subAccounts: {
        type: Number,
        default: 0,
        min: 0,
      },
      bidsPerMonth: {
        type: Number,
        default: 0,
        min: -1, // -1 indicates unlimited
      },
      unlimitedBids: {
        type: Boolean,
        default: false,
      },
      notificationDelay: {
        type: Number,
        default: 0, // Delay in minutes, 0 = immediate
        min: 0,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
    // Additional fields for future use
    trialDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for better query performance
planSchema.index({ isActive: 1, isDeleted: 1, price: 1 });
planSchema.index({ tags: 1 });

// Pre-save middleware to sync unlimitedBids and bidsPerMonth
planSchema.pre("save", function(next) {
  if (this.features.unlimitedBids && this.features.bidsPerMonth !== -1) {
    this.features.bidsPerMonth = -1;
  }
  if (!this.features.unlimitedBids && this.features.bidsPerMonth === -1) {
    this.features.unlimitedBids = true;
  }
  next();
});

// Static method for finding active plans
planSchema.statics.findActive = function() {
  return this.find({ isActive: true, isDeleted: false }).sort({ sortOrder: 1, price: 1 });
};

const Plan = mongoose.model("Plan", planSchema);

export default Plan;