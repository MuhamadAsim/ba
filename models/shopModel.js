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
    registrationMethod: {
      type: String,
      enum: ['email_password', 'google'],
      default: 'email_password',
      required: true
    },
    googleId: {
      type: String,
      sparse: true
    },
    password: {
      type: String,
      required: function () {
        return this.registrationMethod === "email_password";
      },
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
    ownerPhone: {
      type: String,
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

    // New fields to add:
    financingOffered: {
      type: Boolean,
      default: false
    },

    acceptedPayments: [{
      type: String,
      enum: ['visa', 'mastercard', 'discover', 'amex', 'business_checks', 'cash', 'zelle', 'other']
    }],
    yearsExperience: {
      type: String,
      default: ''
    },

    businessHours: {
      monday: {
        open: String,
        close: String,
        closed: Boolean
      },
      tuesday: {
        open: String,
        close: String,
        closed: Boolean
      },
      wednesday: {
        open: String,
        close: String,
        closed: Boolean
      },
      thursday: {
        open: String,
        close: String,
        closed: Boolean
      },
      friday: {
        open: String,
        close: String,
        closed: Boolean
      },
      saturday: {
        open: String,
        close: String,
        closed: Boolean
      },
      sunday: {
        open: String,
        close: String,
        closed: Boolean
      }
    },

    // Start Date
    startDate: {
      type: Date,
      default: Date.now,
    },

    // Plan Information
    plan: {
      type: String,
      enum: ["basic", "professional"],
      required: true,
      default: "basic",
    },

    // Stripe Integration Fields
    stripeCustomerId: {
      type: String,
      sparse: true
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true
    },

    // Subscription Status (Synced from Stripe)
    subscriptionStatus: {
      type: String,
      enum: ["inactive", "active", "trialing", "trial_canceled", "cancelled", "cancel_scheduled", "canceled", "past_due", "unpaid", "paused",],
      default: "inactive",
    },

    // Current Subscription Details (from Stripe)
    currentSubscription: {
      // Stripe IDs
      priceId: String,          // Stripe Price ID (e.g., price_basic_monthly)
      productId: String,        // Stripe Product ID

      // Plan Details
      planName: String,         // "basic" or "professional"
      amount: Number,           // Amount in cents
      currency: {
        type: String,
        default: "usd"
      },
      interval: {               // Billing interval
        type: String,
        enum: ["month", "year"],
        default: "month"
      },

      // Period Information
      currentPeriodStart: { type: Date, default: null },
      currentPeriodEnd: { type: Date, default: null },
      trialStart: { type: Date, default: null },
      trialEnd: { type: Date, default: null },
      trialDays: {              // Original trial length in days
        type: Number,
        default: 30             // Default 1-month trial
      },

      // Subscription Management
      cancelAtPeriodEnd: {
        type: Boolean,
        default: false
      },

      // Trial Extension Tracking
      trialExtended: {
        type: Boolean,
        default: false
      },
      trialExtensions: [{
        extendedBy: {           // Admin who extended
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Admin'
        },
        previousEndDate: Date,
        newEndDate: Date,
        extendedDays: Number,
        extendedAt: {
          type: Date,
          default: Date.now
        },
        reason: String          // Optional reason for extension
      }]
    },


    // ================= CHILD ACCOUNT LIMIT =================
    maxChildAccounts: {
      type: Number,
      default: 2, // max allowed child users
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

    // Rating and Reviews
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
      default: true,
    },
    policyAcceptedAt: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },

    registrationExpiresAt: {
      type: Date,
      index: {
        expireAfterSeconds: 0,
        partialFilterExpression: {
          isVerified: false,
        },
      },
    },

    // Account Status
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "cancelled", "blocked"],
      default: "pending",
    },

    // Block/Unblock Status
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockedAt: {
      type: Date,
      default: null,
    },
    blockedReason: {
      type: String,
      trim: true,
      default: "",
    },
    lastUnblockedAt: {
      type: Date,
      default: null,
    },

    // OTP for verification
    otp: {
      type: String,
    },
    otpExpiry: {
      type: Date,
    },

    // Payment History (Reference to Payment collection)
    paymentHistory: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    }],

    // Billing Information (for invoices)
    billingDetails: {
      billingEmail: {
        type: String,
        lowercase: true,
        trim: true
      },
      companyName: String,
      taxId: String,
      address: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String
      }
    }
  },
  {
    timestamps: true,
  }
);

// ==================== INDEXES ====================
shopSchema.index({ email: 1 });
shopSchema.index({ businessName: 1 });
shopSchema.index({ zipCode: 1 });
shopSchema.index({ status: 1 });
shopSchema.index({ isVerified: 1, isEmailVerified: 1 });
shopSchema.index({ isBlocked: 1 });
shopSchema.index({ subscriptionStatus: 1 });
shopSchema.index({ stripeCustomerId: 1 }, { sparse: true });
shopSchema.index({ stripeSubscriptionId: 1 }, { sparse: true });
shopSchema.index({ "currentSubscription.trialEnd": 1 }); // For finding expiring trials
shopSchema.index({ "currentSubscription.planName": 1 }); // For plan-based queries

// Geospatial index for location-based queries
shopSchema.index({ location: "2dsphere" });

// ==================== VIRTUAL PROPERTIES ====================

// Check if subscription is active (includes trialing)
shopSchema.virtual("hasActiveSubscription").get(function () {
  return ["active", "trialing"].includes(this.subscriptionStatus);
});

// Check if currently in trial period
shopSchema.virtual("isInTrial").get(function () {
  if (this.subscriptionStatus !== "trialing") return false;

  // Also check if trial end date is in future
  if (this.currentSubscription?.trialEnd) {
    return new Date() < new Date(this.currentSubscription.trialEnd);
  }

  return this.subscriptionStatus === "trialing";
});

// Get plan price in cents
shopSchema.virtual("planPrice").get(function () {
  const prices = {
    basic: 9900,      // $99 in cents
    professional: 19900  // $199 in cents
  };
  return prices[this.plan] || 0;
});

// Get plan display name with price
shopSchema.virtual("planDisplay").get(function () {
  const planNames = {
    basic: "Basic ($99/month)",
    professional: "Professional ($199/month)"
  };
  return planNames[this.plan] || "No Plan";
});

// Get Stripe price ID based on plan
shopSchema.virtual("stripePriceId").get(function () {
  const priceIds = {
    basic: process.env.STRIPE_BASIC_PRICE_ID,
    professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID
  };
  return priceIds[this.plan];
});

// Get trial days remaining
shopSchema.virtual("trialDaysRemaining").get(function () {
  if (!this.isInTrial || !this.currentSubscription?.trialEnd) return 0;

  const now = new Date();
  const trialEnd = new Date(this.currentSubscription.trialEnd);
  const diffTime = trialEnd - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
});

// Get detailed trial information
shopSchema.virtual("trialInfo").get(function () {
  if (!this.currentSubscription?.trialEnd) {
    return {
      isActive: false,
      message: "No trial active"
    };
  }

  const now = new Date();
  const trialEnd = new Date(this.currentSubscription.trialEnd);
  const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
  const isActive = this.isInTrial;

  return {
    isActive,
    endsAt: trialEnd,
    daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
    wasExtended: this.currentSubscription.trialExtended || false,
    extensions: this.currentSubscription.trialExtensions || [],
    originalTrialDays: this.currentSubscription.trialDays || 30,
    startedAt: this.currentSubscription.trialStart
  };
});

// ==================== METHODS ====================

// Verify email
shopSchema.methods.verifyEmail = function () {
  this.isEmailVerified = true;
  this.otp = undefined;
  this.otpExpiry = undefined;
  return this.save();
};

// Approve shop (admin action)
shopSchema.methods.approveShop = function () {
  this.isVerified = true;
  this.verifiedAt = new Date();
  this.status = "active";
  return this.save();
};

// Block shop (admin action)
shopSchema.methods.blockShop = function (adminId, reason = "") {
  this.isBlocked = true;
  this.status = "blocked";
  this.blockedAt = new Date();
  this.blockedReason = reason;
  this.blockedBy = adminId;
  return this.save();
};

// Unblock shop (admin action)
shopSchema.methods.unblockShop = function () {
  this.isBlocked = false;
  this.status = "active";
  this.lastUnblockedAt = new Date();
  this.blockedReason = "";
  this.blockedBy = null;
  return this.save();
};

// Check if shop is blocked
shopSchema.methods.isBlockedNow = function () {
  return this.isBlocked === true;
};




// Get plan from Stripe price ID
shopSchema.methods.getPlanFromPriceId = function (priceId) {
  // Map Stripe price IDs to plan names
  if (priceId === process.env.STRIPE_BASIC_PRICE_ID) return "basic";
  if (priceId === process.env.STRIPE_PROFESSIONAL_PRICE_ID) return "professional";
  return "basic";
};

// Create Stripe subscription with 30-day trial
shopSchema.methods.createStripeSubscription = async function (plan = "basic") {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  // Get Stripe price ID for the plan
  const priceId = plan === "professional"
    ? process.env.STRIPE_PROFESSIONAL_PRICE_ID
    : process.env.STRIPE_BASIC_PRICE_ID;

  // Create subscription with 30-day trial
  const subscription = await stripe.subscriptions.create({
    customer: this.stripeCustomerId,
    items: [{ price: priceId }],
    trial_period_days: 30, // Default 30-day trial
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent']
  });

  // Update shop with subscription data
  this.stripeSubscriptionId = subscription.id;
  this.plan = plan;
  await this.updateSubscriptionFromStripe(subscription);

  return subscription;
};





shopSchema.methods.updateSubscriptionFromStripe = async function (subscription) {
  const currentSub = this.currentSubscription || {};

  const price = subscription.items?.data?.[0]?.price;

  this.stripeSubscriptionId = subscription.id;
  this.subscriptionStatus = subscription.status;

  this.currentSubscription = {
    priceId: price?.id ?? currentSub.priceId,
    productId: price?.product ?? currentSub.productId,
    planName: this.getPlanFromPriceId(price?.id) ?? currentSub.planName,
    amount: price?.unit_amount ?? currentSub.amount,
    currency: price?.currency ?? currentSub.currency,
    interval: price?.recurring?.interval ?? currentSub.interval,

    // ✅ SAFE DATE HANDLING
    currentPeriodStart: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000)
      : currentSub.currentPeriodStart,

    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : currentSub.currentPeriodEnd,

    trialStart: subscription.trial_start
      ? new Date(subscription.trial_start * 1000)
      : currentSub.trialStart,

    trialEnd: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : currentSub.trialEnd,

    trialDays: currentSub.trialDays ?? 30,
    cancelAtPeriodEnd:
      subscription.cancel_at_period_end ?? currentSub.cancelAtPeriodEnd,

    // Preserve admin extensions
    trialExtended: currentSub.trialExtended ?? false,
    trialExtensions: currentSub.trialExtensions ?? [],
  };

  // Keep plan in sync
  if (price?.id === process.env.STRIPE_BASIC_PRICE_ID) {
    this.plan = "basic";
  } else if (price?.id === process.env.STRIPE_PROFESSIONAL_PRICE_ID) {
    this.plan = "professional";
  }

  await this.save();
};


// Extend trial (admin function)
shopSchema.methods.extendTrial = async function (adminId, additionalDays, reason = "") {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  if (!this.stripeSubscriptionId) {
    throw new Error("Shop doesn't have a Stripe subscription");
  }

  if (!this.isInTrial) {
    throw new Error("Cannot extend trial - trial period has ended");
  }

  // Get current subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(this.stripeSubscriptionId);

  // Calculate new trial end date
  const currentTrialEnd = subscription.trial_end || subscription.current_period_end;
  const newTrialEnd = currentTrialEnd + (additionalDays * 24 * 60 * 60);

  // Update trial in Stripe
  const updatedSubscription = await stripe.subscriptions.update(
    this.stripeSubscriptionId,
    {
      trial_end: newTrialEnd
    }
  );

  // Update local record
  this.currentSubscription.trialExtended = true;
  this.currentSubscription.trialEnd = new Date(newTrialEnd * 1000);

  // Add to extension history
  this.currentSubscription.trialExtensions.push({
    extendedBy: adminId,
    previousEndDate: new Date(currentTrialEnd * 1000),
    newEndDate: new Date(newTrialEnd * 1000),
    extendedDays: additionalDays,
    reason: reason
  });

  // Update from Stripe to sync all fields
  await this.updateSubscriptionFromStripe(updatedSubscription);

  return {
    success: true,
    newTrialEnd: new Date(newTrialEnd * 1000),
    daysExtended: additionalDays,
    subscription: updatedSubscription
  };
};

// Cancel subscription
shopSchema.methods.cancelSubscription = async function () {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  if (!this.stripeSubscriptionId) {
    throw new Error("No active subscription to cancel");
  }

  // Cancel at period end in Stripe
  await stripe.subscriptions.update(this.stripeSubscriptionId, {
    cancel_at_period_end: true
  });

  // Update local status
  this.currentSubscription.cancelAtPeriodEnd = true;
  await this.save();

  return { success: true, message: "Subscription will cancel at period end" };
};

// ==================== STATIC METHODS ====================

// Get plan price
shopSchema.statics.getPlanPrice = function (plan) {
  const prices = {
    basic: 9900,      // $99 in cents
    professional: 19900  // $199 in cents
  };
  return prices[plan] || 0;
};

// Get plan details
shopSchema.statics.getPlanDetails = function (plan) {
  const plans = {
    basic: {
      name: "Basic",
      stripePriceId: process.env.STRIPE_BASIC_PRICE_ID,
      price: 9900, // $99 in cents
      displayPrice: "$99/month",
      interval: "month",
      trialDays: 30,
      features: [
        "Basic shop listing",
        "Up to 5 active bids",
        "Email support",
        "30-day free trial"
      ]
    },
    professional: {
      name: "Professional",
      stripePriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
      price: 19900, // $199 in cents
      displayPrice: "$199/month",
      interval: "month",
      trialDays: 30,
      features: [
        "Premium shop listing",
        "Unlimited active bids",
        "Priority support",
        "Featured in search results",
        "Advanced analytics",
        "30-day free trial"
      ]
    }
  };
  return plans[plan] || null;
};

// Find shops with expiring trials (for notifications)
shopSchema.statics.findExpiringTrials = function (daysBefore = 3) {
  const date = new Date();
  date.setDate(date.getDate() + daysBefore);

  return this.find({
    "subscriptionStatus": "trialing",
    "currentSubscription.trialEnd": {
      $lte: date,
      $gt: new Date() // Only future dates
    }
  });
};

// Find all shops in trial
shopSchema.statics.findAllInTrial = function () {
  return this.find({
    "subscriptionStatus": "trialing"
  }).sort({ "currentSubscription.trialEnd": 1 });
};

// ==================== MIDDLEWARE ====================

// Pre-save middleware to sync isBlocked with status
shopSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status === "blocked") {
      this.isBlocked = true;
      if (!this.blockedAt) {
        this.blockedAt = new Date();
      }
    } else if (this.isBlocked && this.status !== "blocked") {
      this.isBlocked = false;
      this.lastUnblockedAt = new Date();
    }
  }

  if (this.isModified("isBlocked")) {
    if (this.isBlocked && this.status !== "blocked") {
      this.status = "blocked";
      if (!this.blockedAt) {
        this.blockedAt = new Date();
      }
    } else if (!this.isBlocked && this.status === "blocked") {
      this.status = "active";
      this.lastUnblockedAt = new Date();
    }
  }

  next();
});

const Shop = mongoose.model("Shop", shopSchema);

export default Shop;