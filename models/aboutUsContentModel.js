import mongoose from 'mongoose';

const aboutUsContentSchema = new mongoose.Schema({
  heading: {
    type: String,
    required: true,
    default: "About Bidawrap.com"
  },
  
  paragraphs: {
    type: [String],
    required: true,
    default: [
      "Bidawrap.com was created with one goal: to bring fairness, transparency, and opportunity to the wrap industry. Founded by a group of industry-leading professionals each with over 25 years of experience in wraps, graphics, and signage our mission is to build a platform that truly serves both shops and customers.",
      "Unlike traditional lead-generation sites that take commissions and hide behind marketing claims, Bidawrap.com is a true marketplace built on honesty, ethics, and trust. Here, customers can post their wrap projects and receive competitive bids from verified professionals specializing in color change wraps, PPF, commercial graphics, and more.",
      "Every shop that joins our platform goes through a verification process to ensure quality, professionalism, and reliability. Shops can bid freely without commissions, while customers get real, transparent pricing and access to trusted experts. It's a win-win environment designed for the entire wrap community."
    ]
  },
  
  whyWeDoSection: {
    title: {
      type: String,
      default: "Because the Industry Deserves Better."
    },
    subtitle: {
      type: String,
      default: "WHY WE DO WHAT WE DO"
    },
    paragraphs: {
      type: [String],
      default: [
        "We've spent decades in the wrap and signage industry, and we've seen how much it's changed. Too many platforms today claim to support professionals but instead charge unnecessary fees, manipulate pricing, or prioritize profits over people. We built Bidawrap.com to change that.",
        "Our purpose is to create a fair, honest, and ethical space where real shops and real customers can connect without the middlemen. We believe that when good work meets good people, the entire industry grows stronger."
      ]
    },
    highlightedText: {
      type: String,
      default: "Bidawrap.com was built by the industry, for the industry to empower professionals, inspire trust, and make the process of getting wrapped simple, transparent, and rewarding for everyone involved."
    }
  },
  
  values: {
    type: [
      {
        title: String,
        description: String
      }
    ],
    default: [
      {
        title: "No Commissions",
        description: "Shops bid freely without hidden fees or commissions"
      },
      {
        title: "Verified Shops",
        description: "Every shop is verified for quality and professionalism"
      },
      {
        title: "Built by Experts",
        description: "Founded by professionals with 25+ years experience"
      },
      {
        title: "Transparent Pricing",
        description: "Real pricing from real professionals, no hidden costs"
      }
    ]
  },
  
  galleryImages: {
    colorChangeWrap: {
      type: String,
      default: "/car-27.png"
    },
    paintProtectionFilm: {
      type: String,
      default: "/car-30.png"
    },
    commercialGraphics: {
      type: String,
      default: "/car-29.png"
    }
  },
  
  // ADD FLIP CARD IMAGES SECTION
  flipCardImages: {
    frontImage: {
      type: String,
      default: "/default-black-car.jpg"
    },
    backImage: {
      type: String,
      default: "/default-yellow-car.jpg"
    }
  },
  
  stats: {
    yearsExperience: {
      type: String,
      default: "25+"
    },
    commissionFees: {
      type: String,
      default: "0%"
    },
    verifiedShops: {
      type: String,
      default: "100%"
    }
  },
  
  cta: {
    title: {
      type: String,
      default: "Ready to Experience the Difference?"
    },
    description: {
      type: String,
      default: "Join thousands of customers and shops who trust Bidawrap.com for their wrap needs."
    },
    getBidButton: {
      type: String,
      default: "Get a Bid"
    },
    joinShopButton: {
      type: String,
      default: "Join as a Shop"
    }
  }
}, {
  timestamps: true
});

const AboutUsContent = mongoose.model('AboutUsContent', aboutUsContentSchema);

export default AboutUsContent;