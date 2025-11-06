import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    vehicleYear: String,
    vehicleMake: String,
    vehicleModel: String,
    vehicleTrim: String,
    vehicleCondition: Number,
    vehicleImages: [String], // store file path

    requestCategory: String,
    serviceDescription: String,
    desiredFinish: String,
    hasExistingWrap: String,
    ppfCoverage: String,
    brandingWrapCoverage: String,
    hasDesign: String,
    hasLogo: String,
    artworkFiles: [String],
    exampleFiles: [String],

    firstName: String,
    lastName: String,
    email: String,
    zipCode: String,
    contactMethod: String,
    dueDate: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Bid", bidSchema);
