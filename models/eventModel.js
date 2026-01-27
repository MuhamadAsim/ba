import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    // ✔️ If event is for customer
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    // ✔️ If event is for shop
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      default: null,
    },

    // ✔️ Type of event
    type: {
      type: String,
      enum: [
        // Auth / Profile
        "signup",
        "profile-updated",

        // Bid lifecycle
        "bid-created",
        "bid-in-progress",
        "bid-completed",
        "bid-expired",
        "bid-canceled",
        "bid-reposted",

        // Offer lifecycle
        "new-offer",
        "counter-offer",
        "offer-accepted",
        "offer-rejected",
        "counter-offer-rejected",
        'counter-offer-accepted',  // Add this line
        'counter-offer-rejected',   // You might want this too


        // System / Notifications
        "system",
        "info",
      ],
      required: true,
    },

    // ✔️ Small title for notifications
    title: {
      type: String,
    },

    // ✔️ Full description
    message: {
      type: String,
      required: true,
    },

    // ✔️ Optional (link to bid)
    bidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
      default: null,
    },

    // ✔️ Optional (link to offer)
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },

    // ✔️ Auto delete after 14 days (2 weeks)
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      index: { expires: 0 }, // TTL index
    },
  },
  { timestamps: true }
);

export default mongoose.model("Event", eventSchema);
