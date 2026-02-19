// models/DemoVideo.js
import mongoose from 'mongoose';

const demoVideoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Video title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    videoUrl: {
      type: String,
      required: [true, 'Video URL is required'],
      trim: true,
      validate: {
        validator: function(v) {
          // Basic YouTube URL validation
          return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(v);
        },
        message: 'Please provide a valid YouTube URL',
      },
    },
    targetAudience: {
      type: String,
      enum: ['customers', 'shops'],
      required: [true, 'Target audience is required'],
      default: 'customers',
    },
    // ADDED: Tags field for categorizing videos
    tags: [{
      type: String,
      trim: true,
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Index for faster queries
demoVideoSchema.index({ targetAudience: 1, isActive: 1 });
demoVideoSchema.index({ createdAt: -1 });
// ADDED: Index for tags
demoVideoSchema.index({ tags: 1 });

// Virtual for YouTube video ID extraction
demoVideoSchema.virtual('youtubeId').get(function() {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = this.videoUrl.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
});

// Method to get thumbnail URL
demoVideoSchema.methods.getThumbnailUrl = function() {
  const videoId = this.youtubeId;
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
};

// Method to increment views
demoVideoSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

const videoModel = mongoose.model('DemoVideo', demoVideoSchema);

export default videoModel;