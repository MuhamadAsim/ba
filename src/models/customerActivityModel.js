import mongoose from "mongoose";

const customerActivitySchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    // What happened?
    description: {
      type: String,
      required: true,
    },

    // Short label for filtering
    type: {
      type: String,
      required: true,
      enum: [
        "BID_CREATED",
        "BID_CANCELLED",
        "BID_EXPIRED",
        "BID_COMPLETED",
        "PROFILE_UPDATED",
        "OTHER",
      ],
    },

    // Extra details (optional)
    metadata: {
      type: Object,
      default: {},
    },

    // Device, IP, etc.
    ip: { type: String, default: null },
    device: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("CustomerActivity", customerActivitySchema);
