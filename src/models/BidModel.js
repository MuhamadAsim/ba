import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    // Link to the Customer (auto-created or logged-in user)
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    // Vehicle details
    vehicleYear: { type: String, trim: true },
    vehicleMake: { type: String, trim: true },
    vehicleModel: { type: String, trim: true },
    vehicleTrim: { type: String, trim: true },
    vehicleCondition: { type: Number },
    vehicleImages: [{ type: String }], // uploaded image paths

    // Request details
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

    // Contact info
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    contactMethod: { type: String, trim: true },
    dueDate: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Bid", bidSchema);
