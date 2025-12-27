// models/BidActivity.js
import mongoose from 'mongoose';

const bidActivitySchema = new mongoose.Schema({
  // Shop reference
  shop_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    required: true,
    index: true
  },
  
  // Customer reference
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  
  // Bid reference
  bid_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bid',
    required: true,
    index: true
  },
  
  // Activity type
  activity_type: {
    type: String,
    required: true,
    enum: [
      'offer_made',           // Shop makes an offer
      'offer_accepted',       // Customer accepts shop's offer
      'offer_rejected',       // Customer rejects shop's offer
      'counter_offer_received', // Customer makes counter offer
      'counter_offer_accepted', // Shop accepts counter offer
      'counter_offer_rejected', // Shop rejects counter offer
      'bid_completed',        // Shop marks bid as completed
    ],
    index: true
  },
  
  // Price information (if applicable)
  price: {
    type: Number,
    min: 0
  },
  
  // Counter offer price (if applicable)
  counter_price: {
    type: Number,
    min: 0
  },
  
  // Message or description
  message: {
    type: String,
    maxlength: 1000
  },
  
  // Bid details snapshot (to preserve history even if bid changes)
  bid_snapshot: {
    bid_title: String,
    bid_description: String,
    service: String,
    location: String,
    preferred_date: Date,
    status_at_time: String
  },
  
  // Customer details snapshot
  customer_snapshot: {
    name: String,
    email: String,
    phone: String,
    zip: String
  },
  
  // Shop details snapshot
  shop_snapshot: {
    business_name: String,
    business_type: String,
    location: String
  },
  
  // References to related documents
  offer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer'
  },
  
  counter_offer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CounterOffer'
  },
  
  // Metadata
  ip_address: String,
  user_agent: String,
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient querying
bidActivitySchema.index({ shop_id: 1, createdAt: -1 });
bidActivitySchema.index({ bid_id: 1, activity_type: 1 });
bidActivitySchema.index({ customer_id: 1, createdAt: -1 });

// Virtual for formatted activity description
bidActivitySchema.virtual('activity_description').get(function() {
  const customerName = this.customer_snapshot?.name || 'Customer';
  const shopName = this.shop_snapshot?.business_name || 'Your shop';
  
  switch (this.activity_type) {
    case 'offer_made':
      return `${shopName} made an offer of $${this.price} on bid "${this.bid_snapshot?.bid_title || 'Untitled'}"`;
    case 'offer_accepted':
      return `${customerName} accepted ${shopName}'s offer of $${this.price}`;
    case 'offer_rejected':
      return `${customerName} rejected ${shopName}'s offer of $${this.price}`;
    case 'counter_offer_received':
      return `${customerName} made a counter offer of $${this.counter_price} on "${this.bid_snapshot?.bid_title || 'Untitled'}"`;
    case 'counter_offer_accepted':
      return `${shopName} accepted ${customerName}'s counter offer of $${this.counter_price}`;
    case 'counter_offer_rejected':
      return `${shopName} rejected ${customerName}'s counter offer of $${this.counter_price}`;
    case 'bid_completed':
      return `${shopName} marked bid "${this.bid_snapshot?.bid_title || 'Untitled'}" as completed`;
    case 'bid_cancelled':
      return `${customerName} cancelled bid "${this.bid_snapshot?.bid_title || 'Untitled'}"`;
    case 'offer_withdrawn':
      return `${shopName} withdrew offer of $${this.price} on "${this.bid_snapshot?.bid_title || 'Untitled'}"`;
    case 'counter_offer_withdrawn':
      return `${customerName} withdrew counter offer of $${this.counter_price}`;
    default:
      return 'Activity recorded';
  }
});

// Virtual for activity icon
bidActivitySchema.virtual('activity_icon').get(function() {
  switch (this.activity_type) {
    case 'offer_made':
    case 'counter_offer_received':
      return 'dollar-sign';
    case 'offer_accepted':
    case 'counter_offer_accepted':
    case 'bid_completed':
      return 'check-circle';
    case 'offer_rejected':
    case 'counter_offer_rejected':
      return 'x-circle';
    case 'bid_cancelled':
      return 'x-octagon';
    case 'offer_withdrawn':
    case 'counter_offer_withdrawn':
      return 'undo';
    default:
      return 'clock';
  }
});

// Static method to log activity
bidActivitySchema.statics.logActivity = async function(activityData) {
  try {
    const activity = new this(activityData);
    return await activity.save();
  } catch (error) {
    console.error('Error logging bid activity:', error);
    // Don't throw error - activity logging shouldn't break main functionality
    return null;
  }
};

// Method to get formatted date
bidActivitySchema.methods.getFormattedDate = function() {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(this.createdAt);
};

const BidActivity = mongoose.models.BidActivity || mongoose.model('BidActivity', bidActivitySchema);

export default BidActivity;