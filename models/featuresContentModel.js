import mongoose from 'mongoose';

const featuresContentSchema = new mongoose.Schema({
  aboutUs: {
    paragraph: {
      type: String,
      required: true,
      default: "Bid A Wrap is revolutionizing the way people find quality vehicle wrap and detailing services. Our platform connects vehicle owners with trusted professionals through transparency, competitive pricing, and verified credentials."
    },
    image: {
      type: String,
      default: "/car-31.png"
    }
  },
  
  locateShops: {
    paragraph: {
      type: String,
      required: true,
      default: "Find verified wrap and detailing shops in your area with our advanced search tools. Browse comprehensive portfolios, read authentic reviews from real customers, and connect with local professionals who specialize in the exact services your vehicle needs."
    },
    image: {
      type: String,
      default: "/car-11.jpg"
    },
    whatYoullFind: {
      type: [String],
      default: [
        "Detailed shop profiles with portfolios and certifications",
        "Authentic customer reviews and ratings",
        "Specialty services including wraps, PPF, ceramic coating, and detailing",
        "Direct contact information and instant quote requests"
      ]
    }
  },
  
  joinNetwork: {
    paragraph: {
      type: String,
      required: true,
      default: "Are you a shop owner looking to grow your business? Join Bid A Wrap's network of trusted professionals and connect with customers actively seeking your services. Get quality leads and increase your bookings today."
    },
    image: {
      type: String,
      default: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80"
    },
    partnershipBenefits: {
      type: [String],
      default: [
        "Access to pre-qualified customer leads",
        "Enhanced online visibility and shop profile",
        "Marketing support and promotional opportunities"
      ]
    }
  },
  
  faq: {
    paragraph: {
      type: String,
      required: true,
      default: "Got questions? Find comprehensive answers to commonly asked questions about how Bid A Wrap works, pricing structures, project timelines, quality standards, and more. We're here to guide you every step of the way on your vehicle transformation journey."
    },
    image: {
      type: String,
      default: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80"
    },
    popularTopics: {
      type: [String],
      default: [
        "How it works",
        "Pricing guide",
        "Project timelines",
        "Quality standards",
        "Warranty info",
        "Payment options"
      ]
    }
  }
}, {
  timestamps: true
});

const FeaturesContent = mongoose.model('FeaturesContent', featuresContentSchema);

export default FeaturesContent;