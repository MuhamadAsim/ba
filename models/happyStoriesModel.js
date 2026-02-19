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
    isBillboard: {
      type: Boolean,
      default: false
    },
    // Add tags field (similar to blogs)
    tags: [{
      type: String,
      trim: true,
    }],
    // Optional: Add slug for SEO-friendly URLs
    slug: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Generate slug before saving (similar to blogs)
storySchema.pre("save", function(next) {
  if (this.isModified("name") && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  next();
});

// Index for faster queries
storySchema.index({ isActive: 1, order: 1 });
storySchema.index({ createdAt: -1 });
storySchema.index({ isBillboard: 1, isActive: 1 });
storySchema.index({ tags: 1 }); // Add index for tag filtering

const Story = mongoose.model('Story', storySchema);

export default Story;