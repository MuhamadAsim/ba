import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    vehicleYear: { type: String, trim: true },
    vehicleMake: { type: String, trim: true },
    vehicleModel: { type: String, trim: true },
    vehicleTrim: { type: String, trim: true },
    vehicleCondition: { type: Number },
    vehicleImages: [{ type: String }],

    requestCategory: { type: String, trim: true },
    serviceDescription: { type: String, trim: true },
    
    // Color Wrap & PPF fields
    desiredFinish: { type: String, trim: true },
    hasExistingWrap: { type: String, trim: true },
    wrapCoverage: { type: String, trim: true },
    wrapType: { type: String, trim: true },
    desiredColor: { type: String, trim: true },
    
    // Business Wrap fields
    brandingWrapCoverage: { type: String, trim: true },
    hasDesign: { type: String, trim: true },
    hasLogo: { type: String, trim: true },
    artworkFiles: [{ type: String }],
    exampleFiles: [{ type: String }],
    
    // Window Tinting fields
    hasExistingTint: { type: String, trim: true },
    tintCoverage: { type: String, trim: true },
    tintType: { type: String, trim: true },
    
    // Ceramic Coating fields
    paintFinish: { type: String, trim: true },
    coatingPackage: { type: String, trim: true },
    coverageExterior: { type: Boolean, default: false },
    coverageInterior: { type: Boolean, default: false },
    coverageGlassTrims: { type: Boolean, default: false },
    coverageWheelsBrakes: { type: Boolean, default: false },
    coatingPhotos: [{ type: String }],
    
    // PPF fields
    ppfCoverage: { type: String, trim: true },
    addCeramicCoating: { type: String, trim: true },
    ppfPhotos: [{ type: String }],

    // Detailing fields
    packageExterior: { type: Boolean, default: false },
    packageInterior: { type: Boolean, default: false },
    packageWheelsBrakes: { type: Boolean, default: false },
    detailLevel: { type: String, trim: true },
    detailPhotos: [{ type: String }],

    // Contact Info
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    address: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
    country: { type: String, trim: true },
    
    // GeoJSON location field for geospatial queries
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],  // [longitude, latitude]
        default: [0, 0]
      }
    },

    contactMethod: {
      type: String,
      enum: ["email", "sms", "both"],
      default: "email",
    },

    dueDate: { type: Date },

    status: {
      type: String,
      enum: ["active", "in_progress", "completed", "expired", "canceled"],
      default: "active",
    },

    offers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Offer",
      },
    ],

    acceptedOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },

    currentShopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      default: null,
    },
    
    reviewed: {
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true }
);

// Create 2dsphere index for geospatial queries
bidSchema.index({ location: '2dsphere' });

bidSchema.pre("save", function (next) {
  if (!this.createdAt) this.createdAt = new Date();
  next();
});

bidSchema.methods.isExpired = function () {
  const now = new Date();
  const createdAt = new Date(this.createdAt);
  const dueDate = this.dueDate ? new Date(this.dueDate) : null;

  const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
  if (this.status === "active" && hoursSinceCreation >= 48) return true;
  if (this.status === "active" && dueDate && now > dueDate) return true;

  return false;
};

// FIX: Prevent OverwriteModelError
export default mongoose.models.Bid || mongoose.model("Bid", bidSchema);