// // ============================================
// // MODEL: models/happStoresModel.js
// // ============================================

// import mongoose from 'mongoose';

// const storySchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: [true, 'Customer name is required'],
//       trim: true,
//       maxlength: [100, 'Name cannot exceed 100 characters']
//     },
//     rating: {
//       type: Number,
//       required: [true, 'Rating is required'],
//       min: [1, 'Rating must be at least 1'],
//       max: [5, 'Rating cannot exceed 5'],
//       validate: {
//         validator: Number.isInteger,
//         message: 'Rating must be an integer'
//       }
//     },
//     story: {
//       type: String,
//       required: [true, 'Story text is required'],
//       trim: true,
//       maxlength: [1000, 'Story cannot exceed 1000 characters']
//     },
//     image: {
//       type: String,
//       required: [true, 'Image URL is required'],
//       trim: true
//     },
//     isActive: {
//       type: Boolean,
//       default: true
//     },
//     order: {
//       type: Number,
//       default: 0
//     }
//   },
//   {
//     timestamps: true,
//     toJSON: { virtuals: true },
//     toObject: { virtuals: true }
//   },

// );

// // Index for faster queries
// storySchema.index({ isActive: 1, order: 1 });
// storySchema.index({ createdAt: -1 });

// const Story = mongoose.model('Story', storySchema);

// export default Story;







// ============================================
// MODEL: models/happStoresModel.js
// ============================================

import mongoose from 'mongoose';

const storySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer'
      }
    },
    story: {
      type: String,
      required: [true, 'Story text is required'],
      trim: true,
      maxlength: [1000, 'Story cannot exceed 1000 characters']
    },
    image: {
      type: String,
      required: [true, 'Image URL is required'],
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    },
    isBillboard: {  // Add this field inside the schema object
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index for faster queries
storySchema.index({ isActive: 1, order: 1 });
storySchema.index({ createdAt: -1 });
storySchema.index({ isBillboard: 1, isActive: 1 }); // Add index for billboard filtering

const Story = mongoose.model('Story', storySchema);

export default Story;