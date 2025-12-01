import mongoose from "mongoose";

const shopSchema = new mongoose.Schema(
  {
    // Basic Information
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    legalEntityName: {
      type: String,
      required: true,
      trim: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },

    // Contact Information
    countryCode: {
      type: String,
      required: true,
      default: "+1",
    },
    phone: {
      type: String,
      required: true,
    },
    website: {
      type: String,
    },

    // Location
    address: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    zipCode: {
      type: String,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    // GeoJSON format for MongoDB geospatial queries
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },

    // Services
    services: {
      type: [String],
      required: true,
      default: [],
    },

    vinylFilms: {
      type: String,
      trim: true,
    },

    // Certificates
    certificates: {
      type: String,
      trim: true,
    },
    certificateFiles: {
      type: [String], // URLs of uploaded certificate files
      default: [],
    },

    // Start Date
    startDate: {
      type: Date,
      required: true,
    },

    // Insurance Information
    insuranceCarrier: {
      type: String,
      required: true,
      trim: true,
    },
    policyNumber: {
      type: String,
      required: true,
      trim: true,
    },
    policyExpiration: {
      type: Date,
      required: true,
    },
    insuranceCertificate: {
      type: String, // URL of insurance certificate file
      required: true,
    },

    // Social Media Links
    socialMedia: {
      instagram: {
        type: String,
        trim: true,
      },
      facebook: {
        type: String,
        trim: true,
      },
      linkedin: {
        type: String,
        trim: true,
      },
    },

    // Additional Information
    additionalInfo: {
      type: String,
      trim: true,
    },

    // Photos
    storeFrontPhoto: {
      type: String, // URL of store front photo
      required: true,
    },
    workSpacePhoto: {
      type: String, // URL of workspace photo
      required: true,
    },
    profilePic: {
      type: String, // URL of shop profile picture
      default: "",
    },

    // Plan Information
    plan: {
      type: String,
      enum: ["basic", "professional"],
      required: true,
      default: "basic",
    },
    planStartDate: {
      type: Date,
      default: Date.now,
    },
    trialEndDate: {
      type: Date,
      default: function () {
        // Set trial to 1 month from now
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        return date;
      },
    },

    // Payment Information (Store tokenized data only, never raw card details)
    paymentInfo: {
      last4: {
        type: String,
      },
      cardName: {
        type: String,
      },
      expiry: {
        type: String,
      },
      paymentToken: {
        type: String, // Stripe/Payment gateway token
      },
    },

    subscription: {
      customerId: { type: String },     // Stripe customer ID
      subscriptionId: { type: String }, // Stripe subscription ID
      planAmount: { type: Number, default: 0 }, // amount in cents or dollars
      billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
      nextBillingDate: { type: Date },
      status: {
        type: String,
        enum: ["trialing", "active", "past_due", "cancelled"],
        default: "trialing",
      }
    },
    // Add these fields to your Shop model after the "profilePic" field:

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },

    // Verification Status
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false, // Admin verification for shop approval
    },
    verifiedAt: {
      type: Date,
    },
     isAdminShop: {
      type: Boolean,
      default: false,
    },

    resetPasswordOtp: { type: String, default: null },
    resetPasswordOtpExpiry: { type: Date, default: null },

    // Policy Acceptance
    acceptedPolicy: {
      type: Boolean,
      required: true,
      default: false,
    },
    policyAcceptedAt: {
      type: Date,
      default: Date.now,
    },

    // Account Status
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "cancelled"],
      default: "pending",
    },

    // OTP for verification
    otp: {
      type: String,
    },
    otpExpiry: {
      type: Date,
    },
  },
  {
    timestamps: true, // automatically adds createdAt and updatedAt
  }
);

// Index for faster queries
shopSchema.index({ email: 1 });
shopSchema.index({ businessName: 1 });
shopSchema.index({ zipCode: 1 });
shopSchema.index({ status: 1 });
shopSchema.index({ isVerified: 1, isEmailVerified: 1 });

// Geospatial index for location-based queries
shopSchema.index({ location: "2dsphere" });

// Virtual for checking if trial is active
shopSchema.virtual("isTrialActive").get(function () {
  return new Date() < this.trialEndDate;
});

// Method to check if shop needs payment
shopSchema.methods.needsPayment = function () {
  return !this.isTrialActive() && !this.paymentInfo.paymentToken;
};

// Method to verify email
shopSchema.methods.verifyEmail = function () {
  this.isEmailVerified = true;
  this.otp = undefined;
  this.otpExpiry = undefined;
  return this.save();
};

// Method to approve shop (admin action)
shopSchema.methods.approveShop = function () {
  this.isVerified = true;
  this.verifiedAt = new Date();
  this.status = "active";
  return this.save();
};

// Auto-assign planAmount based on plan type
shopSchema.pre("save", function (next) {
  const planPrices = {
    basic: 50,
    professional: 200,
  };

  // Only update if plan was changed OR planAmount is 0
  if (this.isModified("plan") || this.subscription.planAmount === 0) {
    this.subscription.planAmount = planPrices[this.plan] || 0;
  }

  next();
});


const Shop = mongoose.model("Shop", shopSchema);

export default Shop;
