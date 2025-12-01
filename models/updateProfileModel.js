import mongoose from "mongoose";

const verificationRequestSchema = new mongoose.Schema(
  {
    // Reference to the shop making the request
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    // Request Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // Basic Information Updates
    legalEntityName: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    zipCode: {
      type: String,
      trim: true,
    },
    latitude: {
      type: String,
      trim: true,
    },
    longitude: {
      type: String,
      trim: true,
    },
    insuranceCarrier: {
      type: String,
      trim: true,
    },
    policyNumber: {
      type: String,
      trim: true,
    },
    policyExpiration: {
      type: Date,
    },

    // Certificate Updates
    certificates: {
      type: String, // Comma-separated certificate names
      trim: true,
    },
    certificateFiles: {
      type: [String], // Array of Cloudinary URLs
      default: [],
    },
    insuranceCertificate: {
      type: String, // Single Cloudinary URL
    },

    // Admin Review
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },

    // Notes
    shopNotes: {
      type: String, // Optional notes from shop when submitting
      trim: true,
    },
    adminNotes: {
      type: String, // Admin's notes during review
      trim: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Indexes for faster queries
verificationRequestSchema.index({ shopId: 1 });
verificationRequestSchema.index({ status: 1 });
verificationRequestSchema.index({ createdAt: -1 });

// Method to approve the request and update shop data
verificationRequestSchema.methods.approveAndUpdateShop = async function (adminId) {
  const Shop = mongoose.model("Shop");
  
  try {
    // Find the shop
    const shop = await Shop.findById(this.shopId);
    if (!shop) {
      throw new Error("Shop not found");
    }

    // Update shop with new verified information
    const updates = {};
    
    if (this.legalEntityName) updates.legalEntityName = this.legalEntityName;
    if (this.address) updates.address = this.address;
    if (this.country) updates.country = this.country;
    if (this.zipCode) updates.zipCode = this.zipCode;
    if (this.latitude) updates.latitude = this.latitude;
    if (this.longitude) updates.longitude = this.longitude;
    if (this.insuranceCarrier) updates.insuranceCarrier = this.insuranceCarrier;
    if (this.policyNumber) updates.policyNumber = this.policyNumber;
    if (this.policyExpiration) updates.policyExpiration = this.policyExpiration;
    if (this.certificates) updates.certificates = this.certificates;
    if (this.certificateFiles && this.certificateFiles.length > 0) {
      updates.certificateFiles = this.certificateFiles;
    }
    if (this.insuranceCertificate) updates.insuranceCertificate = this.insuranceCertificate;

    // Update the shop
    await Shop.findByIdAndUpdate(this.shopId, updates);

    // Update this request status
    this.status = "approved";
    this.reviewedBy = adminId;
    this.reviewedAt = new Date();
    await this.save();

    return { success: true, message: "Request approved and shop updated" };
  } catch (error) {
    throw error;
  }
};

// Method to reject the request
verificationRequestSchema.methods.rejectRequest = async function (adminId, reason) {
  this.status = "rejected";
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;
  await this.save();
  return { success: true, message: "Request rejected" };
};

// Static method to get pending requests
verificationRequestSchema.statics.getPendingRequests = function () {
  return this.find({ status: "pending" })
    .populate("shopId", "businessName email ownerName")
    .sort({ createdAt: -1 });
};

// Static method to get requests by shop
verificationRequestSchema.statics.getRequestsByShop = function (shopId) {
  return this.find({ shopId })
    .sort({ createdAt: -1 });
};

const VerificationRequest = mongoose.model("VerificationRequest", verificationRequestSchema);

export default VerificationRequest;