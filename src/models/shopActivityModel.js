import mongoose from "mongoose";

const shopActivitySchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    // What happened?
    description: {
      type: String,
      required: true,
    },

    // Category of activity
    type: {
      type: String,
      required: true,
      enum: [
        "BID_ACCEPTED",
        "BID_REJECTED",
        "JOB_COMPLETED",
        "JOB_CANCELLED",

        "PROFILE_UPDATED",
        "SETTINGS_UPDATED",

        "PHOTO_UPLOADED",
        "WORKSPACE_UPDATED",

        "SUBSCRIPTION_UPGRADED",
        "SUBSCRIPTION_EXPIRED",

        "PAYMENT_RECEIVED",
        "PAYOUT_REQUESTED",

        "LOGIN",
        "LOGOUT",
        "SIGNUP",

        "OTHER",
      ],
    },

    // Extra dynamic details (optional)
    metadata: {
      type: Object,
      default: {},
    },

    // Additional optional info
    ip: { type: String, default: null },
    device: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("ShopActivity", shopActivitySchema);
