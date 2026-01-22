import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: {
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
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    zip: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    otp: {
      type: String,
      default: null,
    },
    otpExpiry: {
      type: Date,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isAuthenticated: {
      type: Boolean,
      default: true,
    },
    // Add this new field for blocking users
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
      default: "",
      trim: true,
    },
    resetPasswordOtp: { 
      type: String, 
      default: null 
    },
    resetPasswordOtpExpiry: { 
      type: Date, 
      default: null 
    },
  },
  { timestamps: true }
);

// Index for faster blocked users queries
customerSchema.index({ isBlocked: 1 });
customerSchema.index({ email: 1, isBlocked: 1 });

export default mongoose.model("Customer", customerSchema);