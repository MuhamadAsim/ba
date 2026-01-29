// models/JoinNetworkContent.js
import mongoose from 'mongoose';

const joinNetworkContentSchema = new mongoose.Schema({
  hero: {
    title: {
      type: String,
      default: "Join Our Network"
    },
    subtitle: {
      type: String,
      default: "Grow Your Business with Quality Leads"
    },
    description: {
      type: String,
      default: "Connect with customers looking for wraps, PPF, tinting, and detailing services. No commissions. No hidden fees. Just honest connections."
    },
    image: {
      type: String,
      default: ""
    }
  },
  
  benefits: [{
    icon: {
      type: String,
      enum: ['TrendingUp', 'DollarSign', 'Star', 'BarChart3', 'Shield', 'Users'],
      default: 'TrendingUp'
    },
    title: {
      type: String,
      default: ""
    },
    description: {
      type: String,
      default: ""
    }
  }],
  
  features: [String],
  
  howItWorks: [{
    step: {
      type: Number,
      min: 1,
      max: 10
    },
    title: {
      type: String,
      default: ""
    },
    description: {
      type: String,
      default: ""
    }
  }],
  
  finalCta: {
    title: {
      type: String,
      default: "Ready to Grow Your Business?"
    },
    description: {
      type: String,
      default: "Join professional shops already using Bid A Wrap to grow with purpose and connect with customers who value quality work."
    },
    ctaText: {
      type: String,
      default: "Get Started - It's Free"
    }
  }
}, {
  timestamps: true
});

const JoinNetworkContent = mongoose.model('JoinNetworkContent', joinNetworkContentSchema);

export default JoinNetworkContent;