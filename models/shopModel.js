import mongoose from "mongoose";

const shopSchema = new mongoose.Schema(
  {
    // ================= BASIC INFO =================
    businessName: { type: String, required: true, trim: true },
    legalEntityName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    notificationEmail: {
      type: String,
      lowercase: true,//
      trim: true,
      default: function () {
        return this.email; // Default to the login email
      }
    },

    registrationMethod: {
      type: String,
      enum: ["email_password", "google"],
      default: "email_password",
      required: true,
    },

    googleId: { type: String, sparse: true },

    password: {
      type: String,
      required: function () {
        return this.registrationMethod === "email_password";
      },
    },

    // ================= CONTACT =================
    countryCode: { type: String, default: "+1", required: true },
    phone: { type: String, required: true },
    ownerPhone: String,
    website: String,

    // ================= LOCATION =================
    address: { type: String, required: true },
    country: { type: String, required: true },
    zipCode: String,

    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },

    // ================= SERVICES =================
    services: { type: [String], required: true },
    vinylFilms: String,

    // ================= CERTIFICATES =================
    certificates: String,
    certificateFiles: { type: [String], default: [] },

    financingOffered: { type: Boolean, default: false },

    acceptedPayments: [{
      type: String,
      enum: [
        "visa",
        "mastercard",
        "discover",
        "amex",
        "business_checks",
        "cash",
        "zelle",
        "other",
      ],
    }],

    yearsExperience: { type: String, default: "" },

    businessHours: {
      monday: { open: String, close: String, closed: Boolean },
      tuesday: { open: String, close: String, closed: Boolean },
      wednesday: { open: String, close: String, closed: Boolean },
      thursday: { open: String, close: String, closed: Boolean },
      friday: { open: String, close: String, closed: Boolean },
      saturday: { open: String, close: String, closed: Boolean },
      sunday: { open: String, close: String, closed: Boolean },
    },

    startDate: { type: Date, default: Date.now },

    // =====================================================
    // 🔥 NEW SUBSCRIPTION SYSTEM (CLEAN & CORRECT)
    // =====================================================

    // 🔗 Selected Plan (Admin-created)
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      default: null,
    },

    // Stripe identifiers
    stripeCustomerId: { type: String, sparse: true },
    stripeSubscriptionId: { type: String, sparse: true },

    // Subscription state synced from Stripe
    subscriptionStatus: {
      type: String,
      enum: [
        "inactive",
        "trialing",
        "active",
        "past_due",
        "canceled",
      ],
      default: "inactive",
    },

    // Subscription snapshot
    currentSubscription: {
      plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Plan",
      },

      stripeProductId: String,
      stripePriceId: String,

      currentPeriodStart: Date,
      currentPeriodEnd: Date,

      trialStart: Date,
      trialEnd: Date,

      cancelAtPeriodEnd: {
        type: Boolean,
        default: false,
      },
    },


    // ================= BID USAGE (PER BILLING CYCLE) =================
    bidUsage: {
      usedThisPeriod: {
        type: Number,
        default: 0,
        min: 0,
      },

      periodStart: {
        type: Date,
        default: null,
      },

      periodEnd: {
        type: Date,
        default: null,
      },
    },


    // ====================================================
    // ================= OTHER SYSTEM DATA =================
    // =====================================================


    insuranceCarrier: { type: String, required: true, trim: true },
    policyNumber: { type: String, required: true, trim: true },
    policyExpiration: { type: Date, required: true },
    insuranceCertificate: { type: String, required: true },

    socialMedia: {
      instagram: String,
      facebook: String,
      linkedin: String,
      youtube: String,
      tiktok: String,
    },

    additionalInfo: String,

    storeFrontPhoto: { type: String, required: true },
    workSpacePhoto: { type: String, required: true },
    profilePic: { type: String, default: "" },

    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },

    isEmailVerified: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    verifiedAt: Date,

    isAdminShop: { type: Boolean, default: false },

    resetPasswordOtp: String,
    resetPasswordOtpExpiry: Date,

    acceptedPolicy: { type: Boolean, default: true },
    policyAcceptedAt: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ["pending", "active", "suspended", "cancelled", "blocked", "pending_approval"],
      default: "pending",
    },

    isBlocked: { type: Boolean, default: false },
    blockedAt: Date,
    blockedReason: String,
    lastUnblockedAt: Date,

    otp: String,
    otpExpiry: Date,

    paymentHistory: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    }],

    billingDetails: {
      billingEmail: String,
      companyName: String,
      taxId: String,
      address: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
    },
  },
  { timestamps: true }
);

// ================= INDEXES =================
shopSchema.index({ email: 1 });
shopSchema.index({ businessName: 1 });
shopSchema.index({ zipCode: 1 });
shopSchema.index({ status: 1 });
shopSchema.index({ subscriptionStatus: 1 });
shopSchema.index({ stripeCustomerId: 1 }, { sparse: true });
shopSchema.index({ stripeSubscriptionId: 1 }, { sparse: true });
shopSchema.index({ "currentSubscription.trialEnd": 1 });
shopSchema.index({ location: "2dsphere" });

// ================= VIRTUALS =================

// Active subscription (trial OR paid)
shopSchema.virtual("hasActiveSubscription").get(function () {
  return ["active", "trialing"].includes(this.subscriptionStatus);
});

// Trial check
shopSchema.virtual("isInTrial").get(function () {
  if (this.subscriptionStatus !== "trialing") return false;
  if (!this.currentSubscription?.trialEnd) return false;
  return new Date() < new Date(this.currentSubscription.trialEnd);
});

// Trial days remaining
shopSchema.virtual("trialDaysRemaining").get(function () {
  if (!this.isInTrial) return 0;
  const diff =
    new Date(this.currentSubscription.trialEnd) - new Date();
  return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0);
});

// ================= METHODS =================

// Assign plan + start trial (NO STRIPE)
shopSchema.methods.startTrial = async function (planId, trialDays = 30) {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + trialDays);

  this.plan = planId;
  this.subscriptionStatus = "trialing";

  this.currentSubscription = {
    plan: planId,
    trialStart: now,
    trialEnd,
  };

  return this.save();
};

// Sync from Stripe webhook
shopSchema.methods.syncStripeSubscription = async function (stripeSub) {
  const item = stripeSub.items.data[0];
  const price = item.price;

  this.stripeSubscriptionId = stripeSub.id;
  this.subscriptionStatus = stripeSub.status;

  this.currentSubscription = {
    ...this.currentSubscription,
    stripeProductId: price.product,
    stripePriceId: price.id,
    currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
  };

  return this.save();
};



// ================= METHODS =================

// Block shop (business-level)
shopSchema.methods.blockShop = async function (adminId, reason) {
  this.isBlocked = true;
  this.blockedAt = new Date();
  this.blockedReason = reason || "Blocked by admin";
  this.status = "blocked";
};

// Unblock shop
shopSchema.methods.unblockShop = async function () {
  this.isBlocked = false;
  this.lastUnblockedAt = new Date();
  this.blockedReason = null;
};


const Shop = mongoose.model("Shop", shopSchema);
export default Shop;
