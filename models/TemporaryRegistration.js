// models/TemporaryRegistration.js
import mongoose from 'mongoose';

const TemporaryRegistrationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  // For email/password registration
  password: {
    type: String,
  },
  otp: {
    type: String,
  },
  otpExpiry: {
    type: Date,
  },
  // For Google registration
  googleId: {
    type: String,
  },
  name: {
    type: String,
  },
  picture: {
    type: String,
  },
  registrationMethod: {
    type: String,
    enum: ['email_password', 'google'],
    required: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600, // Auto-delete after 1 hour
  }
});

const TemporaryRegistration = mongoose.model('TemporaryRegistration', TemporaryRegistrationSchema);
export default TemporaryRegistration;