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
      enum: ['email_password', 'google'], // ✅ Added: Track registration method
      default: 'email_password',
      required: true
    },
    googleId: {
      type: String,
      sparse: true // Allows null values
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
      default: "", // can later store default avatar image URL
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

    // ------------------ NEW FIELDS ------------------
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
    // ------------------------------------------------

    isAuthenticated: {
      type: Boolean,
      default: true,
    },
    resetPasswordOtp: { type: String, default: null },
    resetPasswordOtpExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Customer", customerSchema);




