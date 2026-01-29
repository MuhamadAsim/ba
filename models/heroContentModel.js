import mongoose from 'mongoose';

const heroContentSchema = new mongoose.Schema({
  heading: {
    type: String,
    required: true,
    default: "Transform Your Ride with Expert Auto Care"
  },
  
  paragraph: {
    type: String,
    required: true,
    default: "Discover top-tier professionals for PPF, wraps, tinting, and ceramic coating. Compare bids, explore services, and elevate your vehicle's look with unmatched quality."
  },
  
  cardImages: {
    frontImage: String,
    backImage: String
  },
  
  galleryImages: [String],
  
  ctaText: {
    type: String,
    default: "Get Your Free Bid"
  },
  
  badgeText: {
    type: String,
    default: "Premium Vehicle Transformation"
  },
  
  galleryCaption: {
    type: String,
    default: "Featured transformations from our network of professionals"
  }
}, {
  timestamps: true
});

const HeroContent = mongoose.model('HeroContent', heroContentSchema);

export default HeroContent;