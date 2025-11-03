import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    trim: true,
    default: ""
  },
  avatar: {
    type: String,
    trim: true,
    default: "" // can later store default avatar image URL
  },
  zip: {
    type: String,
    trim: true,
    default: ""
  },
  address: {
    type: String,
    trim: true,
    default: ""
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  }
}, { timestamps: true }); // adds createdAt and updatedAt fields

export default mongoose.model("Customer", customerSchema);
