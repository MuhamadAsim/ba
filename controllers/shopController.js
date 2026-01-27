
import Shop from "../models/shopModel.js";
import dotenv from "dotenv";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import Event from "../models/eventModel.js";
import { notifyNewOffer } from "../utils/notifyNewOffer.js";
import { notifyCounterAccepted } from "../utils/notifyCounterAccepted.js";
import { notifyBidCompleted } from "../utils/notifyBidCompleted.js"; '@sendgrid/mail'
import BidActivity from "../models/bidLogsModel.js";
import Stripe from 'stripe';
import stripeLib from "stripe";
import Plan from '../models/planModel.js';
import { enforceSubAccountLimit } from "../utils/accountLimitation.js";


const stripelib = stripeLib(process.env.STRIPE_SECRET_KEY);


dotenv.config();



const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);







/**
 * @route   GET /api/shop/bid-history
 * @desc    Get bid activity history for a shop
 * @access  Private (Shop)
 */
export const getBidHistory = async (req, res) => {
  try {
    const shopId = req.shop._id; // From auth middleware
    const {
      page = 1,
      limit = 20,
      activity_type,
      bid_id,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Validate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const filter = { shop_id: shopId };

    // Filter by activity type if provided
    if (activity_type) {
      if (Array.isArray(activity_type)) {
        filter.activity_type = { $in: activity_type };
      } else {
        filter.activity_type = activity_type;
      }
    }

    // Filter by bid_id if provided
    if (bid_id) {
      filter.bid_id = bid_id;
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Fetch activities with populate for Customer instead of User
    const activities = await BidActivity.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('customer_id', 'name email phone zip') // Changed from User to Customer
      .populate('bid_id', 'serviceDescription title status vehicleMake vehicleModel zipCode')
      .populate('offer_id', 'price status')
      .populate('counter_offer_id', 'counterPrice status')
      .lean();

    // Get total count for pagination
    const total = await BidActivity.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    // Format the response data
    const formattedActivities = activities.map(activity => {
      // Format timestamps
      const createdAt = new Date(activity.createdAt);
      const updatedAt = new Date(activity.updatedAt);

      // Format activity description based on type
      let activityText = '';
      let shortDescription = '';

      switch (activity.activity_type) {
        case 'offer_made':
          activityText = `Made an offer of $${activity.price} on bid`;
          shortDescription = `Offer: $${activity.price}`;
          break;
        case 'offer_accepted':
          activityText = `Your offer of $${activity.price} was accepted`;
          shortDescription = `Offer Accepted: $${activity.price}`;
          break;
        case 'offer_rejected':
          activityText = `Your offer of $${activity.price} was rejected`;
          shortDescription = `Offer Rejected: $${activity.price}`;
          break;
        case 'counter_offer_received':
          activityText = `Received counter offer of $${activity.counter_price}`;
          shortDescription = `Counter: $${activity.counter_price}`;
          break;
        case 'counter_offer_accepted':
          activityText = `Accepted counter offer of $${activity.counter_price}`;
          shortDescription = `Accepted Counter: $${activity.counter_price}`;
          break;
        case 'counter_offer_rejected':
          activityText = `Rejected counter offer of $${activity.counter_price}`;
          shortDescription = `Rejected Counter: $${activity.counter_price}`;
          break;
        case 'bid_completed':
          activityText = 'Marked bid as completed';
          shortDescription = 'Bid Completed';
          break;
        case 'bid_cancelled':
          activityText = 'Bid was cancelled';
          shortDescription = 'Bid Cancelled';
          break;
        case 'offer_withdrawn':
          activityText = `Withdrew offer of $${activity.price}`;
          shortDescription = `Offer Withdrawn: $${activity.price}`;
          break;
        case 'counter_offer_withdrawn':
          activityText = `Counter offer of $${activity.counter_price} was withdrawn`;
          shortDescription = `Counter Withdrawn: $${activity.counter_price}`;
          break;
        default:
          activityText = 'Activity recorded';
          shortDescription = 'Activity';
      }

      // Get customer name
      const customerName = activity.customer_id?.name ||
        activity.customer_snapshot?.name ||
        'Customer';

      // Get bid details
      const bidTitle = activity.bid_id?.title ||
        activity.bid_id?.serviceDescription ||
        activity.bid_snapshot?.bid_title ||
        'Untitled Bid';

      return {
        id: activity._id,
        activity_type: activity.activity_type,
        activity_text: activityText,
        short_description: shortDescription,
        full_description: `${customerName} - ${activityText} - ${bidTitle}`,
        customer: {
          id: activity.customer_id?._id,
          name: customerName,
          email: activity.customer_id?.email || activity.customer_snapshot?.email,
          phone: activity.customer_id?.phone || activity.customer_snapshot?.phone,
          zip: activity.customer_id?.zip || activity.customer_snapshot?.zip
        },
        bid: {
          id: activity.bid_id?._id,
          title: bidTitle,
          service: activity.bid_id?.serviceDescription || activity.bid_snapshot?.service,
          vehicle: `${activity.bid_id?.vehicleMake || ''} ${activity.bid_id?.vehicleModel || ''}`.trim() || 'Vehicle not specified',
          location: activity.bid_id?.zipCode || activity.bid_snapshot?.location || 'Location not specified',
          status: activity.bid_id?.status || activity.bid_snapshot?.status_at_time
        },
        price_details: {
          offer_price: activity.price,
          counter_price: activity.counter_price,
          final_price: activity.counter_price || activity.price
        },
        message: activity.message,
        timestamps: {
          created_at: activity.createdAt,
          created_at_formatted: createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          updated_at: activity.updatedAt,
          updated_at_formatted: updatedAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        },
        metadata: activity.metadata || {},
        references: {
          offer_id: activity.offer_id?._id,
          counter_offer_id: activity.counter_offer_id?._id,
          bid_id: activity.bid_id?._id
        },
        // For frontend display
        icon: getActivityIcon(activity.activity_type),
        color_class: getActivityColorClass(activity.activity_type)
      };
    });

    // Get activity type statistics
    const activityStats = await BidActivity.aggregate([
      { $match: { shop_id: shopId } },
      { $group: { _id: '$activity_type', count: { $sum: 1 } } }
    ]);

    // Convert stats to object
    const stats = {};
    activityStats.forEach(stat => {
      stats[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        activities: formattedActivities,
        pagination: {
          current_page: pageNum,
          total_pages: totalPages,
          total_items: total,
          items_per_page: limitNum,
          has_next: pageNum < totalPages,
          has_previous: pageNum > 1
        },
        filters: {
          activity_types: getActivityTypes(),
          date_range: {
            start: startDate,
            end: endDate
          }
        },
        statistics: {
          total_activities: total,
          by_type: stats
        }
      }
    });

  } catch (error) {
    console.error("Error fetching bid history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bid history",
      error: error.message
    });
  }
};

/**
 * @route   GET /api/shop/bid-history/summary
 * @desc    Get bid history summary for dashboard
 * @access  Private (Shop)
 */
export const getBidHistorySummary = async (req, res) => {
  try {
    const shopId = req.shop._id;

    // Get last 30 days date
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get recent activities
    const recentActivities = await BidActivity.find({
      shop_id: shopId,
      createdAt: { $gte: thirtyDaysAgo }
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('customer_id', 'name')
      .populate('bid_id', 'serviceDescription vehicleMake vehicleModel')
      .lean();

    // Get statistics for dashboard
    const stats = await BidActivity.aggregate([
      { $match: { shop_id: shopId } },
      {
        $facet: {
          total_activities: [{ $count: "count" }],
          by_type: [
            { $group: { _id: "$activity_type", count: { $sum: 1 } } }
          ],
          recent_30_days: [
            {
              $match: {
                createdAt: { $gte: thirtyDaysAgo }
              }
            },
            { $count: "count" }
          ],
          offers_made: [
            {
              $match: {
                activity_type: "offer_made"
              }
            },
            { $count: "count" }
          ],
          completed_bids: [
            {
              $match: {
                activity_type: "bid_completed"
              }
            },
            { $count: "count" }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        recent_activities: recentActivities.map(activity => ({
          id: activity._id,
          type: activity.activity_type,
          description: getShortDescription(activity),
          customer_name: activity.customer_id?.name || 'Customer',
          bid_description: activity.bid_id?.serviceDescription || 'Untitled',
          vehicle: `${activity.bid_id?.vehicleMake || ''} ${activity.bid_id?.vehicleModel || ''}`.trim() || 'Vehicle',
          date: activity.createdAt,
          price: activity.price || activity.counter_price
        })),
        statistics: {
          total: stats[0]?.total_activities[0]?.count || 0,
          last_30_days: stats[0]?.recent_30_days[0]?.count || 0,
          offers_made: stats[0]?.offers_made[0]?.count || 0,
          completed_bids: stats[0]?.completed_bids[0]?.count || 0,
          by_type: stats[0]?.by_type || []
        }
      }
    });
  } catch (error) {
    console.error("Error fetching bid history summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bid history summary",
      error: error.message
    });
  }
};

/**
 * @route   GET /api/shop/bid-history/:bidId
 * @desc    Get bid activity history for a specific bid
 * @access  Private (Shop)
 */
export const getBidActivities = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const { bidId } = req.params;

    const activities = await BidActivity.find({
      shop_id: shopId,
      bid_id: bidId
    })
      .sort({ createdAt: -1 })
      .populate('customer_id', 'name email')
      .populate('offer_id', 'price status')
      .populate('counter_offer_id', 'counterPrice status')
      .lean();

    // Format activities for this specific bid
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      activity_type: activity.activity_type,
      description: getActivityDescription(activity),
      price: activity.price,
      counter_price: activity.counter_price,
      message: activity.message,
      timestamp: activity.createdAt,
      formatted_timestamp: new Date(activity.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      icon: getActivityIcon(activity.activity_type),
      color: getActivityColor(activity.activity_type)
    }));

    // Get bid details
    const bid = await Bid.findById(bidId)
      .select('serviceDescription title status vehicleMake vehicleModel zipCode')
      .populate('user_id', 'name');

    res.json({
      success: true,
      data: {
        bid: {
          id: bid?._id,
          title: bid?.title,
          service: bid?.serviceDescription,
          vehicle: `${bid?.vehicleMake || ''} ${bid?.vehicleModel || ''}`.trim(),
          location: bid?.zipCode,
          status: bid?.status,
          customer_name: bid?.user_id?.name || 'Customer'
        },
        activities: formattedActivities,
        total_activities: activities.length
      }
    });
  } catch (error) {
    console.error("Error fetching bid activities:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bid activities",
      error: error.message
    });
  }
};

// Helper functions
const getActivityTypes = () => {
  return [
    { value: 'offer_made', label: 'Offer Made' },
    { value: 'offer_accepted', label: 'Offer Accepted' },
    { value: 'offer_rejected', label: 'Offer Rejected' },
    { value: 'counter_offer_received', label: 'Counter Offer Received' },
    { value: 'counter_offer_accepted', label: 'Counter Offer Accepted' },
    { value: 'counter_offer_rejected', label: 'Counter Offer Rejected' },
    { value: 'bid_completed', label: 'Bid Completed' },
    { value: 'bid_cancelled', label: 'Bid Cancelled' },
    { value: 'offer_withdrawn', label: 'Offer Withdrawn' },
    { value: 'counter_offer_withdrawn', label: 'Counter Offer Withdrawn' }
  ];
};

const getActivityIcon = (type) => {
  switch (type) {
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
};

const getActivityColor = (type) => {
  switch (type) {
    case 'offer_made':
      return 'blue';
    case 'offer_accepted':
    case 'counter_offer_accepted':
    case 'bid_completed':
      return 'green';
    case 'offer_rejected':
    case 'counter_offer_rejected':
      return 'red';
    case 'counter_offer_received':
      return 'yellow';
    case 'bid_cancelled':
      return 'orange';
    case 'offer_withdrawn':
    case 'counter_offer_withdrawn':
      return 'gray';
    default:
      return 'gray';
  }
};

const getActivityColorClass = (type) => {
  switch (type) {
    case 'offer_made':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'offer_accepted':
    case 'counter_offer_accepted':
    case 'bid_completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'offer_rejected':
    case 'counter_offer_rejected':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'counter_offer_received':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'bid_cancelled':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'offer_withdrawn':
    case 'counter_offer_withdrawn':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getActivityDescription = (activity) => {
  const customerName = activity.customer_id?.name || activity.customer_snapshot?.name || 'Customer';
  const bidTitle = activity.bid_id?.serviceDescription || activity.bid_snapshot?.bid_title || 'Untitled Bid';

  switch (activity.activity_type) {
    case 'offer_made':
      return `Made offer of $${activity.price} on "${bidTitle}" to ${customerName}`;
    case 'offer_accepted':
      return `${customerName} accepted your offer of $${activity.price}`;
    case 'offer_rejected':
      return `${customerName} rejected your offer of $${activity.price}`;
    case 'counter_offer_received':
      return `${customerName} sent counter offer of $${activity.counter_price}`;
    case 'counter_offer_accepted':
      return `Accepted counter offer of $${activity.counter_price} from ${customerName}`;
    case 'counter_offer_rejected':
      return `Rejected counter offer of $${activity.counter_price} from ${customerName}`;
    case 'bid_completed':
      return `Completed bid "${bidTitle}" with ${customerName}`;
    default:
      return 'Activity recorded';
  }
};

const getShortDescription = (activity) => {
  switch (activity.activity_type) {
    case 'offer_made':
      return `Offer: $${activity.price}`;
    case 'offer_accepted':
      return `Accepted: $${activity.price}`;
    case 'offer_rejected':
      return `Rejected: $${activity.price}`;
    case 'counter_offer_received':
      return `Counter: $${activity.counter_price}`;
    case 'counter_offer_accepted':
      return `Accepted Counter: $${activity.counter_price}`;
    case 'counter_offer_rejected':
      return `Rejected Counter: $${activity.counter_price}`;
    case 'bid_completed':
      return 'Completed';
    default:
      return 'Activity';
  }
};












// helper
export const updateExpiredBids = async () => {
  const activeBids = await Bid.find({ status: "active" });
  for (const bid of activeBids) {
    if (bid.isExpired()) {
      bid.status = "expired";
      await bid.save();
    }
  }
};










// const MAX_RADIUS_MILES = 15;
// const METERS_PER_MILE = 1609.34;

// // ============================================
// // GET AVAILABLE BIDS FOR SHOP (15-mile radius)
// // ============================================
// export const getAvailableBidsForShops = async (req, res) => {
//   try {
//     await updateExpiredBids();

//     const shopId = req.shopId;

//     // ---------------------- 1️⃣ GET SHOP LOCATION ----------------------
//     const shop = await Shop.findById(shopId).select("location latitude longitude");

//     if (!shop) {
//       return res.status(404).json({
//         success: false,
//         message: "Shop not found",
//       });
//     }

//     let shopLng = null;
//     let shopLat = null;

//     if (shop.location?.coordinates?.length === 2) {
//       shopLng = shop.location.coordinates[0];
//       shopLat = shop.location.coordinates[1];
//     } else if (shop.latitude && shop.longitude) {
//       shopLat = shop.latitude;
//       shopLng = shop.longitude;
//     }

//     if (!shopLat || !shopLng) {
//       return res.status(400).json({
//         success: false,
//         message: "Shop location not set",
//       });
//     }

//     // ---------------------- 2️⃣ ACTIVE BIDS (15-MILE RADIUS) ----------------------
//     const activeBids = await Bid.find({
//       status: "active",
//       location: {
//         $nearSphere: {
//           $geometry: {
//             type: "Point",
//             coordinates: [shopLng, shopLat],
//           },
//           $maxDistance: MAX_RADIUS_MILES * METERS_PER_MILE,
//         },
//       },
//     })
//       .populate("user_id", "name address zip")
//       .sort({ createdAt: -1 });

//     // ---------------------- 3️⃣ OFFERS MADE BY THIS SHOP ----------------------
//     const shopOffers = await Offer.find({ shopId })
//       .populate("counterOffers.createdBy", "name")
//       .lean();

//     const offerMap = {};
//     shopOffers.forEach((offer) => {
//       offerMap[offer.bidId.toString()] = offer;
//     });

//     // ---------------------- 4️⃣ RELATED BIDS (ALREADY ASSIGNED) ----------------------
//     const relatedBids = await Bid.find({
//       currentShopId: shopId,
//       status: { $in: ["in_progress", "completed"] },
//     })
//       .populate("user_id", "name address zip")
//       .sort({ createdAt: -1 });

//     // ---------------------- 5️⃣ MERGE BIDS (NO DUPLICATES) ----------------------
//     const allBidsMap = {};

//     [...activeBids, ...relatedBids].forEach((bid) => {
//       allBidsMap[bid._id.toString()] = bid.toObject();
//     });

//     // ---------------------- 6️⃣ ATTACH OFFER STATUS ----------------------
//     const bidsWithOfferStatus = Object.values(allBidsMap).map((bid) => {
//       const myOffer = offerMap[bid._id.toString()] || null;

//       return {
//         ...bid,
//         hasOffered: !!myOffer,
//         myOffer,
//       };
//     });

//     // ---------------------- 7️⃣ RESPONSE ----------------------
//     return res.status(200).json({
//       success: true,
//       total: bidsWithOfferStatus.length,
//       radiusMiles: MAX_RADIUS_MILES,
//       bids: bidsWithOfferStatus,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching bids for shops:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch bids",
//     });
//   }
// };









const MAX_RADIUS_MILES = 15;
const METERS_PER_MILE = 1609.34;

// Helper function to format name initials
const formatNameInitials = (fullName) => {
  if (!fullName) return '';

  // Split name into parts and get first letter of each part
  const nameParts = fullName.trim().split(/\s+/);
  const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join(' ');

  return initials;
};



export const getAvailableBidsForShops = async (req, res) => {
  try {
    await updateExpiredBids();

    const shopId = req.shopId;

    // ---------------------- 1️⃣ GET SHOP ----------------------
    const shop = await Shop.findById(shopId).select(
      "location latitude longitude subscriptionStatus isBlocked status"
    );

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // ---------------------- 2️⃣ CHECK ACCESS ----------------------
    const blockedStatuses = [
      "inactive",
      "canceled",
      "incomplete_expired",
      "unpaid",
      "paused",
    ];

    if (blockedStatuses.includes(shop.subscriptionStatus) || shop.isBlocked) {
      return res.status(403).json({
        success: false,
        message: shop.isBlocked
          ? "Your account has been blocked by admin."
          : "Your subscription is not active. Please upgrade or renew to access bids.",
        bids: [],
      });
    }

    // ---------------------- 3️⃣ GET SHOP LOCATION ----------------------
    let shopLng = null;
    let shopLat = null;

    if (shop.location?.coordinates?.length === 2) {
      shopLng = shop.location.coordinates[0];
      shopLat = shop.location.coordinates[1];
    } else if (shop.latitude && shop.longitude) {
      shopLat = shop.latitude;
      shopLng = shop.longitude;
    }

    if (!shopLat || !shopLng) {
      return res.status(400).json({
        success: false,
        message: "Shop location not set",
      });
    }

    // ---------------------- 4️⃣ FETCH ACTIVE BIDS ----------------------
    const activeBids = await Bid.find({
      status: "active",
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [shopLng, shopLat],
          },
          $maxDistance: MAX_RADIUS_MILES * METERS_PER_MILE,
        },
      },
    })
      .populate({
        path: "user_id",
        select: "name email phone zip address",
      })
      .sort({ createdAt: -1 });

    const shopOffers = await Offer.find({ shopId })
      .populate("counterOffers.createdBy", "name")
      .lean();

    const offerMap = {};
    shopOffers.forEach((offer) => {
      offerMap[offer.bidId.toString()] = offer;
    });

    const relatedBids = await Bid.find({
      currentShopId: shopId,
      status: { $in: ["in_progress", "completed"] },
    })
      .populate({
        path: "user_id",
        select: "name email phone zip address",
      })
      .populate({
        path: "acceptedOffer",
        select:
          "price appointmentDate appointmentTime estimatedCompletionDays workingHours shopId",
      })
      .sort({ createdAt: -1 });

    // ---------------------- 5️⃣ MERGE & FORMAT ----------------------
    const allBidsMap = {};
    [...activeBids, ...relatedBids].forEach((bid) => {
      allBidsMap[bid._id.toString()] = bid.toObject();
    });

    const formattedBids = Object.values(allBidsMap).map((bid) => {
      const myOffer = offerMap[bid._id.toString()] || null;
      const customer = bid.user_id || {};

      let customerInfo = {};
      if (bid.status === "active") {
        customerInfo = {
          _id: customer._id || customer.id || "",
          name: formatNameInitials(customer.name || ""),
          zip: customer.zip || "",
          address: customer.address || "",
        };
      } else {
        customerInfo = {
          _id: customer._id || customer.id || "",
          name: customer.name || "",
          email: customer.email || "",
          phone: customer.phone || "",
          zip: customer.zip || "",
          address: customer.address || "",
        };
      }

      let appointmentData = null;
      if (bid.status === "in_progress" || bid.status === "completed") {
        if (bid.acceptedOffer) {
          appointmentData = {
            appointmentDate: bid.acceptedOffer.appointmentDate,
            appointmentTime: bid.acceptedOffer.appointmentTime,
            estimatedCompletionDays: bid.acceptedOffer.estimatedCompletionDays,
            workingHours: bid.acceptedOffer.workingHours,
          };
        }
      }

      return {
        ...bid,
        user_id: customerInfo,
        hasOffered: !!myOffer,
        myOffer,
        appointment: appointmentData,
        acceptedOffer: bid.acceptedOffer || null,
      };
    });

    // ---------------------- 6️⃣ RESPONSE ----------------------
    return res.status(200).json({
      success: true,
      total: formattedBids.length,
      radiusMiles: MAX_RADIUS_MILES,
      bids: formattedBids,
    });
  } catch (error) {
    console.error("❌ Error fetching bids for shops:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bids",
      bids: [],
    });
  }
};



export const getShopStats = async (req, res) => {
  try {
    const shopId = req.shopId;

    // 1️⃣ Get all offers made by this shop
    const allOffers = await Offer.find({ shopId }).lean();

    // 2️⃣ Get all bids related to this shop's offers
    const bidIds = allOffers.map(offer => offer.bidId);
    const relatedBids = await Bid.find({ _id: { $in: bidIds } }).lean();

    // 3️⃣ Get bids currently assigned to this shop
    const assignedBids = await Bid.find({ currentShopId: shopId }).lean();

    // 4️⃣ Combine and remove duplicates
    const allBidsMap = {};
    [...relatedBids, ...assignedBids].forEach((bid) => {
      allBidsMap[bid._id.toString()] = bid;
    });

    const allBids = Object.values(allBidsMap);

    // 5️⃣ Calculate stats
    const stats = {
      total: allBids.length,
      active: allBids.filter(bid => bid.status === "active").length,
      inProgress: allBids.filter(bid => bid.status === "in_progress").length,
      completed: allBids.filter(bid => bid.status === "completed").length,
      expired: allBids.filter(bid => bid.status === "expired").length,
      canceled: allBids.filter(bid => bid.status === "canceled").length,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("❌ Error fetching partner stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch partner statistics"
    });
  }
};








// Helper function to create bid snapshot
const createBidSnapshot = (bid) => {
  return {
    bid_title: bid.title || bid.serviceDescription || bid.service || 'Untitled',
    bid_description: bid.description || bid.serviceDescription || '',
    service: bid.service || bid.serviceDescription || 'General Service',
    location: bid.location || bid.user_id?.zip || 'Unknown',
    preferred_date: bid.preferredDate || bid.preferred_date,
    status_at_time: bid.status
  };
};

// Helper function to create customer snapshot
const createCustomerSnapshot = (customer) => {
  return {
    name: customer.name || customer.username || 'Customer',
    email: customer.email || '',
    phone: customer.phone || '',
    zip: customer.zip || ''
  };
};

// Helper function to create shop snapshot
const createShopSnapshot = (shop) => {
  return {
    business_name: shop.businessName || shop.business_name || shop.name || 'Shop',
    business_type: shop.businessType || shop.business_type || '',
    location: shop.location || shop.address || shop.city || 'Unknown'
  };
};












// Make Offer
export const makeOffer = async (req, res) => {
  try {
    const {
      bidId,
      price,
      note,
      message,
      appointmentDate,
      appointmentTime,
      estimatedCompletionDays,
      workingHours
    } = req.body;

    const shopId = req.user?._id || req.shopId;
    const offerMessage = message || note || "";

    // 1️⃣ Validate input
    if (!bidId || !price) {
      return res.status(400).json({ message: "Bid ID and price are required." });
    }

    // 2️⃣ Verify the bid exists
    const bid = await Bid.findById(bidId).populate('user_id');
    if (!bid) {
      return res.status(404).json({ message: "Bid not found." });
    }
    if (bid.status !== "active") {
      return res.status(400).json({ message: "Cannot make an offer on this bid." });
    }

    const customerId = bid.user_id;

    // 3️⃣ Verify shop + subscription + bid limit
    const shop = await Shop.findById(shopId).populate("plan");
    if (!shop) {
      return res.status(404).json({ message: "Shop not found or not authorized." });
    }

    // 🔒 Subscription check
    const allowedStatuses = ["active", "trialing", "past_due"];
    const blockedStatuses = ["inactive", "canceled", "incomplete_expired", "unpaid", "paused"];
    if (shop.isBlocked || blockedStatuses.includes(shop.subscriptionStatus)) {
      return res.status(403).json({
        message: shop.isBlocked
          ? "Your account has been blocked by admin."
          : "Your subscription is not active. Please update or renew your plan.",
      });
    }

    // Ensure shop has a plan
    if (!shop.plan) {
      return res.status(403).json({
        message: "No active subscription plan found for this shop.",
      });
    }

    // Enforce monthly bid limit
    const bidsLimit = shop.plan.features?.bidsPerMonth ?? 0;
    const usedBids = shop.bidUsage?.usedThisPeriod ?? 0;

    if (bidsLimit !== -1 && usedBids >= bidsLimit) {
      return res.status(403).json({
        message: "You have reached your monthly bid limit. Upgrade your plan to continue.",
      });
    }

    // 4️⃣ Check for duplicate offers
    const existingOffer = await Offer.findOne({ bidId, shopId });
    if (existingOffer) {
      return res.status(400).json({ message: "You have already made an offer for this bid." });
    }

    // 5️⃣ Create new offer
    const offer = new Offer({
      bidId,
      shopId,
      price,
      message: offerMessage,
      status: "pending",
      ...(appointmentDate && { appointmentDate: new Date(appointmentDate) }),
      ...(appointmentTime && { appointmentTime }),
      ...(estimatedCompletionDays && { estimatedCompletionDays }),
      ...(workingHours && workingHours.start && workingHours.end && { workingHours }),
    });
    await offer.save();

    // 6️⃣ Link offer to bid
    bid.offers.push(offer._id);
    await bid.save();

    // 7️⃣ Increment bid usage
    shop.bidUsage.usedThisPeriod += 1;
    await shop.save();

    // 8️⃣ Log activity
    try {
      const activityLog = new BidActivity({
        shop_id: shopId,
        customer_id: customerId._id || customerId,
        bid_id: bidId,
        activity_type: 'offer_made',
        price: price,
        message: offerMessage,
        bid_snapshot: createBidSnapshot(bid),
        customer_snapshot: createCustomerSnapshot(bid?.user_id),
        shop_snapshot: createShopSnapshot(shop),
        offer_id: offer._id,
        metadata: {
          appointmentDetails: {
            price,
            hasAppointment: !!(appointmentDate || appointmentTime),
            appointmentDate: appointmentDate ? new Date(appointmentDate) : null,
            appointmentTime,
            estimatedCompletionDays,
            workingHours
          },
        },
        ip_address: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        user_agent: req.headers['user-agent']
      });
      await activityLog.save();
    } catch (activityError) {
      console.error("⚠️ Failed to log activity (non-critical):", activityError);
    }

    // 9️⃣ Create Event
    const event = new Event({
      type: "new-offer",
      bidId,
      offerId: offer._id,
      shopId,
      customerId,
      message: `A new offer was submitted for bid (${bid.serviceDescription})`,
      metadata: {
        price,
        hasAppointment: !!(appointmentDate || appointmentTime),
        appointmentDate: appointmentDate ? new Date(appointmentDate) : null,
        appointmentTime,
        estimatedCompletionDays,
        workingHours
      }
    });
    await event.save();

    // 10️⃣ Notify customer
    notifyNewOffer(offer, bidId, shopId, price, offerMessage, {
      price,
      hasAppointment: !!(appointmentDate || appointmentTime),
      appointmentDate,
      appointmentTime,
      estimatedCompletionDays,
      workingHours
    });

    return res.status(201).json({
      success: true,
      message: appointmentDate || appointmentTime
        ? "Offer with appointment details submitted successfully."
        : "Offer submitted successfully.",
      data: {
        ...offer.toObject(),
        hasAppointment: !!(appointmentDate || appointmentTime)
      },
    });

  } catch (error) {
    console.error("💥 Server error in makeOffer:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating offer.",
      error: error.message,
    });
  }
};









export const getShops = async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius,
      services,
      zipcode,
      country,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    let query = {
      status: "active",
      isVerified: true,
      isEmailVerified: true,
    };

    if (services) {
      query.services = { $in: services.split(",").map((s) => s.trim()) };
    }
    if (zipcode) query.zipCode = zipcode;
    if (country) query.country = { $regex: country, $options: "i" };
    if (search) query.businessName = { $regex: search, $options: "i" };

    let shops;

    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const maxDistance = radius ? parseFloat(radius) * 1000 : 50000;

      shops = await Shop.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: [longitude, latitude] },
            distanceField: "distance",
            maxDistance: maxDistance,
            spherical: true,
            query,
          },
        },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $project: {
            password: 0,
            otp: 0,
            otpExpiry: 0,
            resetPasswordOtp: 0,
            resetPasswordOtpExpiry: 0,
            paymentInfo: 0,
            // ✅ Add fields to include for geo query
            businessName: 1,
            address: 1,
            zipCode: 1,
            country: 1,
            latitude: 1,
            longitude: 1,
            services: 1,
            countryCode: 1,
            phone: 1,
            rating: 1,
            reviewCount: 1,
            storeFrontPhoto: 1,
            profilePic: 1,
            ownerName: 1,
            website: 1,
            vinylFilms: 1,
            certificates: 1,
            socialMedia: 1,
            workSpacePhoto: 1,
            plan: 1,
            startDate: 1,
            // ✅ ADD NEW FIELDS HERE
            yearsExperience: 1,
            financingOffered: 1,
            businessHours: 1,
          },
        },
      ]);
    } else {
      shops = await Shop.find(query)
        .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry -paymentInfo")
        // ✅ ADD NEW FIELDS TO SELECT
        .select("+yearsExperience +financingOffered +businessHours")
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .sort({ createdAt: -1 });
    }

    const formattedShops = shops.map((shop) => ({
      _id: shop._id || shop.id,
      businessName: shop.businessName,
      address: shop.address,
      zipcode: shop.zipCode,
      country: shop.country,
      coordinates: { lat: shop.latitude, lng: shop.longitude },
      services: shop.services || [],
      phone: `${shop.countryCode || ""} ${shop.phone || ""}`,
      rating: shop.rating || 0,
      reviews: shop.reviewCount || 0,
      // ✅ ADD storeFrontPhoto field here
      storeFrontPhoto: shop.storeFrontPhoto || "", // ✅ FIXED: Add this line
      profilePic: shop.profilePic || "", // ✅ You might want this too
      workSpacePhoto: shop.workSpacePhoto || "",
      // ✅ Keep image for backward compatibility
      image: shop.storeFrontPhoto || shop.profilePic || "",
      ownerName: shop.ownerName || "",
      website: shop.website || "",
      vinylFilms: shop.vinylFilms || [],
      certificates: shop.certificates || [],
      socialMedia: shop.socialMedia || {},
      plan: shop.plan || "",
      startDate: shop.startDate || "",
      distance: shop.distance ? (shop.distance / 1000).toFixed(2) : null,

      // ✅ ADD NEW FIELDS TO RESPONSE (maintaining existing format)
      yearsExperience: shop.yearsExperience || "",
      financingOffered: shop.financingOffered || false,
      businessHours: shop.businessHours || {},
    }));

    // Total count for pagination
    const total = await Shop.countDocuments(query);

    // Send shops array + pagination info
    res.status(200).json({
      shops: formattedShops,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get shops error:", error);
    res.status(500).json({ message: "Failed to fetch shops", error: error.message });
  }
};








// ---------------------- GET SINGLE SHOP BY ID ----------------------
export const getShopById = async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await Shop.findOne({
      _id: id,
      status: "active",
      isVerified: true,
    }).select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry -paymentInfo");

    if (!shop) {
      return res.status(404).json({
        status: "error",
        message: "Shop not found",
      });
    }

    // Format response
    const formattedShop = {
      _id: shop._id,
      businessName: shop.businessName,
      legalEntityName: shop.legalEntityName,
      ownerName: shop.ownerName,
      email: shop.email,
      countryCode: shop.countryCode,
      phone: shop.phone,
      website: shop.website,
      address: shop.address,
      country: shop.country,
      zipcode: shop.zipCode,
      coordinates: {
        lat: shop.latitude,
        lng: shop.longitude,
      },
      services: shop.services,
      vinylFilms: shop.vinylFilms,
      certificates: shop.certificates,
      certificateFiles: shop.certificateFiles,
      startDate: shop.startDate,
      insuranceCarrier: shop.insuranceCarrier,
      policyExpiration: shop.policyExpiration,
      socialMedia: shop.socialMedia,
      additionalInfo: shop.additionalInfo,
      storeFrontPhoto: shop.storeFrontPhoto,
      workSpacePhoto: shop.workSpacePhoto,
      profilePic: shop.profilePic,
      plan: shop.plan,
      rating: shop.rating || 0, // ⚠️ MISSING FIELD
      reviews: shop.reviewCount || 0, // ⚠️ MISSING FIELD
      image: shop.storeFrontPhoto || shop.profilePic || "",
      createdAt: shop.createdAt,
    };

    res.json({
      status: "success",
      data: {
        shop: formattedShop,
      },
    });
  } catch (error) {
    console.error("Get shop by ID error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch shop",
      error: error.message,
    });
  }
};













// ---------------------- GET NEARBY SHOPS ----------------------
export const getNearbyShops = async (req, res) => {
  try {
    const { lat, lng, radius = 50 } = req.query; // radius in km

    if (!lat || !lng) {
      return res.status(400).json({
        status: "error",
        message: "Latitude and longitude are required",
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const maxDistance = parseFloat(radius) * 1000; // Convert to meters

    const shops = await Shop.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          distanceField: "distance",
          maxDistance: maxDistance,
          spherical: true,
          query: {
            status: "active",
            isVerified: true,
            isEmailVerified: true,
          },
        },
      },
      {
        $project: {
          password: 0,
          otp: 0,
          otpExpiry: 0,
          resetPasswordOtp: 0,
          resetPasswordOtpExpiry: 0,
          paymentInfo: 0,
        },
      },
    ]);

    const formattedShops = shops.map((shop) => ({
      _id: shop._id,
      businessName: shop.businessName,
      address: shop.address,
      zipcode: shop.zipCode,
      country: shop.country,
      coordinates: {
        lat: shop.latitude,
        lng: shop.longitude,
      },
      services: shop.services || [],
      phone: `${shop.countryCode} ${shop.phone}`,
      rating: shop.rating || 0,
      reviews: shop.reviewCount || 0,
      image: shop.storeFrontPhoto || shop.profilePic || "",
      distance: (shop.distance / 1000).toFixed(2), // in km
    }));

    res.json({
      status: "success",
      data: {
        shops: formattedShops,
        count: formattedShops.length,
      },
    });
  } catch (error) {
    console.error("Get nearby shops error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch nearby shops",
      error: error.message,
    });
  }
};


















export const acceptCounterOffer = async (req, res) => {
  try {
    const { counterId } = req.params;
    const { bidId } = req.body;
    const shopId = req.shop._id;

    // 🔹 Load shop with plan and subscription info
    const shop = await Shop.findById(shopId).populate("plan");
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // 🔹 Subscription/access check
    const allowedStatuses = ["active", "trialing", "past_due"]; // ✅ allow access
    const blockedStatuses = [
      "inactive",
      "canceled",
      "incomplete_expired",
      "unpaid",
      "paused",
    ];

    if (shop.isBlocked || blockedStatuses.includes(shop.subscriptionStatus)) {
      return res.status(403).json({
        success: false,
        message: shop.isBlocked
          ? "Your account has been blocked by admin."
          : "Your subscription is not active. Please upgrade or renew to accept counter offers.",
      });
    }

    // 🔹 Ensure shop has a plan
    const plan = shop.plan;
    if (!plan) {
      return res.status(403).json({
        success: false,
        message: "No plan assigned to your account",
      });
    }

    // 🔹 Bid usage limit
    const bidsLimit = plan.features?.bidsPerMonth ?? 0;
    const usedBids = shop.bidUsage?.usedThisPeriod ?? 0;

    if (bidsLimit !== -1 && usedBids >= bidsLimit) {
      return res.status(403).json({
        success: false,
        message: "You have reached your monthly bid limit",
      });
    }

    // 1️⃣ Find the offer
    const offer = await Offer.findOne({
      bidId,
      shopId,
      "counterOffers._id": counterId,
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Counter offer not found or you don't have permission",
      });
    }

    // 2️⃣ Find counter offer
    const counterOffer = offer.counterOffers.id(counterId);
    if (!counterOffer) {
      return res.status(404).json({
        success: false,
        message: "Counter offer not found",
      });
    }

    // 3️⃣ Already handled?
    if (counterOffer.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Counter offer has already been ${counterOffer.status}`,
      });
    }

    // 4️⃣ Accept counter offer
    counterOffer.status = "accepted";
    counterOffer.respondedAt = new Date();

    // 5️⃣ Update offer
    const originalPrice = offer.price;
    offer.price = counterOffer.counterPrice;
    offer.status = "accepted";
    await offer.save();

    // 6️⃣ Update bid
    const bid = await Bid.findById(bidId).populate("user_id");
    if (bid) {
      bid.status = "in_progress";
      bid.acceptedOffer = offer._id;
      bid.currentShopId = shopId;
      await bid.save();

      await Offer.updateMany(
        {
          bidId,
          _id: { $ne: offer._id },
          status: "pending",
        },
        { $set: { status: "rejected" } }
      );
    }

    // 🔹 Increment bid usage
    shop.bidUsage.usedThisPeriod += 1;
    await shop.save();

    // 7️⃣ Activity log
    try {
      const activityLog = new BidActivity({
        shop_id: shopId,
        customer_id: bid?.user_id?._id || bid?.user_id,
        bid_id: bidId,
        activity_type: "counter_offer_accepted",
        price: originalPrice,
        counter_price: counterOffer.counterPrice,
        message: counterOffer.message,
        bid_snapshot: createBidSnapshot(bid),
        customer_snapshot: createCustomerSnapshot(bid?.user_id),
        shop_snapshot: createShopSnapshot(req.shop),
        offer_id: offer._id,
        counter_offer_id: counterId,
        metadata: {
          original_price: originalPrice,
          accepted_price: counterOffer.counterPrice,
          price_difference: counterOffer.counterPrice - originalPrice,
        },
      });

      await activityLog.save();
    } catch (e) {
      console.error("⚠️ Activity log failed:", e);
    }

    // Notifications
    notifyCounterAccepted(offer, counterOffer, shopId, bidId);

    // Event
    await Event.create({
      type: "counter-offer-accepted",
      bidId,
      offerId: offer._id,
      counterOfferId: counterOffer._id,
      shopId,
      customerId: bid.user_id,
      message: `Counter offer accepted (${counterOffer.counterPrice})`,
    });

    return res.json({
      success: true,
      message: "Counter offer accepted successfully",
      bidUsage: {
        used: shop.bidUsage.usedThisPeriod,
        limit: bidsLimit,
      },
    });
  } catch (error) {
    console.error("Error accepting counter offer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to accept counter offer",
      error: error.message,
    });
  }
};









// -------------------- REJECT COUNTER OFFER --------------------
export const rejectCounterOffer = async (req, res) => {
  try {
    const { counterId } = req.params;
    const { bidId } = req.body;
    const shopId = req.shop._id; // From auth middleware

    // ------------------ FIND OFFER ------------------
    const offer = await Offer.findOne({
      bidId,
      shopId,
      "counterOffers._id": counterId,
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Counter offer not found or you don't have permission",
      });
    }

    const counterOffer = offer.counterOffers.id(counterId);

    if (!counterOffer) {
      return res.status(404).json({
        success: false,
        message: "Counter offer not found",
      });
    }

    if (counterOffer.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Counter offer has already been ${counterOffer.status}`,
      });
    }

    // ------------------ UPDATE COUNTER OFFER ------------------
    counterOffer.status = "rejected";
    counterOffer.respondedAt = new Date();
    await offer.save();

    // ------------------ GET BID AND CUSTOMER DATA FOR ACTIVITY LOG ------------------
    const bid = await Bid.findById(bidId).populate('user_id');
    const customerId = bid?.user_id?._id || bid?.user_id;

    // ------------------ LOG ACTIVITY TO BidLogsModel ------------------
    try {
      const activityLog = new BidActivity({
        shop_id: shopId,
        customer_id: customerId,
        bid_id: bidId,
        activity_type: 'counter_offer_rejected',
        price: offer.price, // Original offer price
        counter_price: counterOffer.counterPrice, // Rejected counter offer price
        message: counterOffer.message || `Rejected counter offer of ${counterOffer.counterPrice}`,
        bid_snapshot: createBidSnapshot(bid),
        customer_snapshot: createCustomerSnapshot(bid?.user_id),
        shop_snapshot: createShopSnapshot(req.shop), // Shop data from auth middleware
        offer_id: offer._id,
        counter_offer_id: counterId,
        ip_address: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        user_agent: req.headers['user-agent'],
        metadata: {
          original_price: offer.price,
          counter_price: counterOffer.counterPrice,
          rejection_reason: counterOffer.rejectionReason || 'Not specified',
          responded_at: counterOffer.respondedAt
        }
      });

      await activityLog.save();
    } catch (activityError) {
      console.error("⚠️ Failed to log activity (non-critical):", activityError);
      // Don't fail the main operation if activity logging fails
    }

    // ------------------ CREATE EVENT (EXISTING CODE) ------------------
    await Activity.create({
      userId: offer.userId,           // Who created the original bid
      shopId: shopId,                 // Shop rejecting the counter offer
      bidId: bidId,
      type: "counter-offer-rejected", // New activity type
      message: `Rejected counter offer of Rs ${counterOffer.counterPrice}`,
      metadata: {
        offerId: offer._id,
        counterOfferId: counterOffer._id,
        previousPrice: offer.price,
        counterPrice: counterOffer.counterPrice,
      },
    });

    // ------------------ RESPONSE ------------------
    res.json({
      success: true,
      message: "Counter offer rejected. Your original offer remains active.",
      offer: {
        id: offer._id,
        price: offer.price,
        status: offer.status,
        counterOffer: {
          id: counterOffer._id,
          status: counterOffer.status,
          price: counterOffer.counterPrice,
          respondedAt: counterOffer.respondedAt,
        },
      },
    });
  } catch (error) {
    console.error("Error rejecting counter offer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject counter offer",
      error: error.message,
    });
  }
};






// -------------------- MARK BID AS COMPLETED --------------------
export const markBidCompleted = async (req, res) => {
  try {
    const { bidId } = req.params;
    const shopId = req.shop._id; // From auth middleware

    // Find the bid with populated user data
    const bid = await Bid.findById(bidId).populate('user_id');

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    // Check if bid is in progress
    if (bid.status !== "in_progress") {
      return res.status(400).json({
        success: false,
        message: `Cannot mark bid as completed. Current status: ${bid.status}`,
      });
    }

    // Verify that this shop has the accepted offer
    const acceptedOffer = await Offer.findOne({
      _id: bid.acceptedOffer,
      shopId: shopId,
    });

    if (!acceptedOffer) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to complete this bid",
      });
    }

    // Find shop details for activity log
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Update bid status to completed
    const previousStatus = bid.status;
    bid.status = "completed";
    bid.completedAt = new Date();
    await bid.save();

    // ⭐ LOG ACTIVITY to BidLogsModel
    try {
      const activityLog = new BidActivity({
        shop_id: shopId,
        customer_id: bid.user_id?._id || bid.userId,
        bid_id: bidId,
        activity_type: 'bid_completed',
        price: acceptedOffer.price,
        bid_snapshot: createBidSnapshot(bid),
        customer_snapshot: createCustomerSnapshot(bid.user_id),
        shop_snapshot: createShopSnapshot(shop),
        offer_id: acceptedOffer._id,
        ip_address: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        user_agent: req.headers['user-agent'],
        metadata: {
          previous_status: previousStatus,
          completed_at: bid.completedAt
        }
      });

      await activityLog.save();
    } catch (activityError) {
      console.error("⚠️ Failed to log activity (non-critical):", activityError);
      // Don't fail the main operation if activity logging fails
    }

    // Trigger notification
    notifyBidCompleted(shopId, bidId);

    // -------------------- SAVE EVENT --------------------
    await Event.create({
      userId: bid.userId || bid.user_id?._id,
      shopId: shopId,
      bidId: bidId,
      type: "bid-completed",
      message: `The bid "${bid.serviceDescription}" has been marked as completed.`,
      metadata: {
        bidId: bid._id,
        offerId: acceptedOffer._id,
        price: acceptedOffer.price,
        completedAt: bid.completedAt
      },
    });

    res.json({
      success: true,
      message: "Bid marked as completed successfully",
      bid: {
        id: bid._id,
        status: bid.status,
        completedAt: bid.completedAt,
        serviceDescription: bid.serviceDescription
      },
    });
  } catch (error) {
    console.error("Error marking bid as completed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark bid as completed",
      error: error.message,
    });
  }
};
















/* =====================================================
   GET SHOP PLAN DETAILS
   - Fetches authenticated shop's current plan and subscription info
   - Returns plan details with trial information
===================================================== */
export const getPlanDetails = async (req, res) => {
  try {
    // req.shop is set by the authentication middleware
    const shopId = req.shop._id || req.shop.id;

    // Fetch shop with plan populated
    const shop = await Shop.findById(shopId)
      .populate('plan')
      .select('businessName email subscriptionStatus currentSubscription plan');

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Check if shop has a plan
    if (!shop.plan) {
      return res.status(404).json({
        success: false,
        message: "No plan assigned to this shop",
      });
    }

    // Calculate trial information
    let isInTrial = false;
    let trialDaysRemaining = 0;

    if (shop.subscriptionStatus === 'trialing' && shop.currentSubscription?.trialEnd) {
      const trialEnd = new Date(shop.currentSubscription.trialEnd);
      const now = new Date();
      
      if (now < trialEnd) {
        isInTrial = true;
        const diffTime = trialEnd.getTime() - now.getTime();
        trialDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // Check if shop has active subscription (either trialing or active)
    const hasActiveSubscription = ['trialing', 'active'].includes(shop.subscriptionStatus);

 
    return res.status(200).json({
      success: true,
      shop: {
        _id: shop._id,
        businessName: shop.businessName,
        email: shop.email,
        subscriptionStatus: shop.subscriptionStatus,
        currentSubscription: shop.currentSubscription,
      },
      planInfo: shop.plan, // This is the populated Plan document
      isInTrial,
      trialDaysRemaining,
      hasActiveSubscription,
    });
  } catch (error) {
    console.error("❌ Get Shop Plan Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch plan details",
      error: error.message,
    });
  }
};











// Helper function to get plan info
async function getPlanInfo(shop, stripeSubscription = null) {
  let planData = null;
  
  // Try to get plan from current subscription first
  if (shop.currentSubscription?.plan) {
    const plan = await Plan.findById(shop.currentSubscription.plan);
    if (plan) {
      planData = {
        _id: plan._id,
        name: plan.name,
        price: plan.price,
        interval: plan.interval,
        currency: plan.currency,
        descriptionPoints: plan.descriptionPoints || [],
        features: plan.features || {
          subAccounts: 0,
          bidsPerMonth: 0,
          unlimitedBids: false
        }
      };
    }
  }
  
  // Fall back to shop.plan
  if (!planData && shop.plan) {
    const plan = await Plan.findById(shop.plan);
    if (plan) {
      planData = {
        _id: plan._id,
        name: plan.name,
        price: plan.price,
        interval: plan.interval,
        currency: plan.currency,
        descriptionPoints: plan.descriptionPoints || [],
        features: plan.features || {
          subAccounts: 0,
          bidsPerMonth: 0,
          unlimitedBids: false
        }
      };
    }
  }
  
  // If still no plan, check if trial is active
  if (!planData && shop.isInTrial) {
    planData = {
      _id: 'trial_plan',
      name: 'Trial Plan',
      price: 0,
      interval: 'month',
      currency: 'USD',
      descriptionPoints: ['Trial access with limited features'],
      features: {
        subAccounts: 0,
        bidsPerMonth: 10,
        unlimitedBids: false
      }
    };
  }
  
  // Last resort - free plan
  if (!planData) {
    planData = {
      _id: 'free_plan',
      name: 'Free Plan',
      price: 0,
      interval: 'month',
      currency: 'USD',
      descriptionPoints: ['Limited bidding access', 'Basic features'],
      features: {
        subAccounts: 0,
        bidsPerMonth: 0,
        unlimitedBids: false
      }
    };
  }
  
  return planData;
}

// Helper function to get billing details
function getBillingDetails(shop, stripeSubscription = null) {
  // Prefer Stripe subscription data if available
  if (stripeSubscription) {
    return {
      currentPeriodStart: stripeSubscription.current_period_start ? 
        new Date(stripeSubscription.current_period_start * 1000).toISOString() : null,
      currentPeriodEnd: stripeSubscription.current_period_end ? 
        new Date(stripeSubscription.current_period_end * 1000).toISOString() : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
      trialEnd: stripeSubscription.trial_end ? 
        new Date(stripeSubscription.trial_end * 1000).toISOString() : null
    };
  }
  
  // Fall back to shop's current subscription data
  if (shop.currentSubscription) {
    return {
      currentPeriodStart: shop.currentSubscription.currentPeriodStart?.toISOString() || null,
      currentPeriodEnd: shop.currentSubscription.currentPeriodEnd?.toISOString() || null,
      cancelAtPeriodEnd: shop.currentSubscription.cancelAtPeriodEnd || false,
      trialEnd: shop.currentSubscription.trialEnd?.toISOString() || null
    };
  }
  
  // Return null if no billing info
  return null;
}

export const getSubscriptionDetails = async (req, res) => {
  try {
    const shop = await Shop.findById(req.shop._id)
      .populate('plan')
      .populate('currentSubscription.plan');

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found"
      });
    }

    // If no Stripe customer ID, return basic info
    if (!shop.stripeCustomerId) {
      const planInfo = await getPlanInfo(shop);
      
      return res.json({
        success: true,
        hasActiveSubscription: shop.hasActiveSubscription,
        subscriptionStatus: shop.subscriptionStatus,
        currentPlan: planInfo,
        stripeCustomerId: null,
        defaultPaymentMethod: null,
        paymentMethodDetails: null,
        billingDetails: getBillingDetails(shop),
        isInTrial: shop.isInTrial,
        trialDaysRemaining: shop.trialDaysRemaining,
        nextInvoice: null
      });
    }

    // Fetch customer details from Stripe
    let customer = null;
    let defaultPaymentMethod = null;
    let paymentMethodDetails = null;
    
    try {
      customer = await stripe.customers.retrieve(shop.stripeCustomerId, {
        expand: ['subscriptions', 'invoice_settings.default_payment_method']
      });
      
      // Get payment method details if available
      if (customer.invoice_settings?.default_payment_method) {
        const paymentMethod = customer.invoice_settings.default_payment_method;
        
        if (paymentMethod.type === 'card') {
          defaultPaymentMethod = paymentMethod.id;
          paymentMethodDetails = {
            last4: paymentMethod.card.last4,
            brand: paymentMethod.card.brand,
            exp_month: paymentMethod.card.exp_month,
            exp_year: paymentMethod.card.exp_year,
            funding: paymentMethod.card.funding,
            country: paymentMethod.card.country
          };
        }
      }
    } catch (stripeError) {
      console.error("Stripe customer fetch error:", stripeError);
      // Continue with shop data even if Stripe fetch fails
    }

    // Get active subscription from Stripe or use shop data
    let activeStripeSubscription = null;
    let nextInvoice = null;
    
    if (customer?.subscriptions?.data) {
      activeStripeSubscription = customer.subscriptions.data.find(sub => 
        ['active', 'trialing', 'past_due'].includes(sub.status)
      );
      
      // Get upcoming invoice for active subscriptions
      if (activeStripeSubscription) {
        try {
          const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
            customer: shop.stripeCustomerId,
          });
          
          nextInvoice = {
            amountDue: upcomingInvoice.amount_due / 100, // Convert from cents
            nextPaymentAttempt: upcomingInvoice.next_payment_attempt ?
              new Date(upcomingInvoice.next_payment_attempt * 1000).toISOString() : null
          };
        } catch (invoiceError) {
          // No upcoming invoice is okay
          nextInvoice = null;
        }
      }
    }

    // Get plan info
    const planInfo = await getPlanInfo(shop, activeStripeSubscription);
    
    // Get billing details - prefer Stripe data, fall back to shop data
    const billingDetails = getBillingDetails(shop, activeStripeSubscription);

    // Determine if in trial
    const isInTrial = shop.subscriptionStatus === 'trialing' && shop.isInTrial;
    const trialDaysRemaining = shop.trialDaysRemaining || 0;

    return res.json({
      success: true,
      hasActiveSubscription: shop.hasActiveSubscription,
      subscriptionStatus: shop.subscriptionStatus,
      currentPlan: planInfo,
      stripeCustomerId: shop.stripeCustomerId,
      defaultPaymentMethod,
      paymentMethodDetails,
      billingDetails,
      isInTrial,
      trialDaysRemaining,
      nextInvoice
    });

  } catch (error) {
    console.error("Error fetching subscription details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription details"
    });
  }
};
















export const getAllPlans = async (req, res) => {
  try {

    console.log("🔍 Query:", {
      isActive: true,
      isDeleted: false,
    });

    const plans = await Plan.find({
      isActive: true,
      isDeleted: false,
    })
    .sort({ sortOrder: 1, price: 1, createdAt: -1 });


    // Log each plan's critical flags
    plans.forEach((plan, index) => {
      console.log(`🧾 Plan ${index + 1}:`, {
        id: plan._id,
        name: plan.name,
        isActive: plan.isActive,
        isDeleted: plan.isDeleted, // may be undefined due to select:false
      });
    });

    res.status(200).json({
      success: true,
      message: "Active plans fetched successfully",
      count: plans.length,
      plans,
    });
  } catch (error) {
    console.error("❌ Fetch Plans Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
      error: error.message,
    });
  }
};










export const subscribeShop = async (req, res) => {
  try {
    const { planId, paymentMethodId, useExistingCard } = req.body;
    const shopId = req.shopId;

    if (!planId) {
      return res.status(400).json({ success: false, message: "Plan is required" });
    }

    // 1️⃣ Load shop & plan
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    const oldPlan = shop.plan ? await Plan.findById(shop.plan) : null;

    // 2️⃣ Ensure Stripe customer
    if (!shop.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: shop.email,
        name: shop.businessName,
      });
      shop.stripeCustomerId = customer.id;
    }

    // 3️⃣ Handle payment method
    if (!useExistingCard) {
      if (!paymentMethodId) {
        return res.status(400).json({
          success: false,
          message: "Payment method is required",
        });
      }

      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: shop.stripeCustomerId,
      });

      await stripe.customers.update(shop.stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    } else {
      const customer = await stripe.customers.retrieve(shop.stripeCustomerId);
      if (!customer?.invoice_settings?.default_payment_method) {
        return res.status(400).json({
          success: false,
          message: "No existing payment method found",
        });
      }
    }

    // 4️⃣ Create / Update subscription
    let subscription;

    if (shop.stripeSubscriptionId) {
      // Existing subscription (upgrade / downgrade / re-subscribe)
      subscription = await stripe.subscriptions.retrieve(
        shop.stripeSubscriptionId
      );

      // 🔥 CRITICAL: undo cancellation if user re-subscribes before period end
      if (subscription.cancel_at_period_end) {
        await stripe.subscriptions.update(subscription.id, {
          cancel_at_period_end: false,
        });
      }

      const currentPrice =
        subscription.items.data[0].price.unit_amount / 100;

      const isUpgrade = plan.price > currentPrice;

      subscription = await stripe.subscriptions.update(subscription.id, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: plan.stripePriceId,
          },
        ],
        proration_behavior: isUpgrade ? "create_prorations" : "none",
      });
    } else {
      // New subscription
      subscription = await stripe.subscriptions.create({
        customer: shop.stripeCustomerId,
        items: [{ price: plan.stripePriceId }],
        trial_period_days: plan.trialDays || undefined,
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
      });
    }

    // 5️⃣ Enforce limits ONLY on downgrade
    if (
      oldPlan &&
      plan.features.subAccounts < oldPlan.features.subAccounts
    ) {
      await enforceSubAccountLimit({
        shopId: shop._id,
        oldPlan,
        newPlan: plan,
      });
    }

    // 6️⃣ Sync subscription snapshot (Stripe = source of truth)
    const safeDate = (ts) => (ts ? new Date(ts * 1000) : null);

    shop.plan = plan._id;
    shop.stripeSubscriptionId = subscription.id;
    shop.subscriptionStatus = subscription.status;

    shop.currentSubscription = {
      plan: plan._id,
      stripeProductId: plan.stripeProductId,
      stripePriceId: plan.stripePriceId,
      currentPeriodStart: safeDate(subscription.current_period_start),
      currentPeriodEnd: safeDate(subscription.current_period_end),
      trialStart: safeDate(subscription.trial_start),
      trialEnd: safeDate(subscription.trial_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
    };

    // Reset usage only if new billing period
    if (
      shop.currentSubscription.currentPeriodStart &&
      shop.currentSubscription.currentPeriodEnd
    ) {
      shop.bidUsage = {
        usedThisPeriod: 0,
        periodStart: shop.currentSubscription.currentPeriodStart,
        periodEnd: shop.currentSubscription.currentPeriodEnd,
      };
    }

    await shop.save();

    return res.status(200).json({
      success: true,
      message: "Subscription processed successfully",
      subscriptionStatus: subscription.status,
    });
  } catch (error) {
    console.error("❌ Stripe subscription error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Subscription failed",
    });
  }
};








export const cancelSubscription = async (req, res) => {
  try {
    const shopId = req.shopId;

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    if (!shop.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: "No active subscription to cancel",
      });
    }

    // Retrieve subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(
      shop.stripeSubscriptionId
    );

    // Already cancelled
    if (subscription.cancel_at_period_end) {
      return res.status(200).json({
        success: true,
        message: "Subscription is already scheduled for cancellation",
      });
    }

    // Cancel at period end
    const updatedSubscription = await stripe.subscriptions.update(
      shop.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // Sync local state
    shop.subscriptionStatus = updatedSubscription.status;

    shop.currentSubscription = {
      ...shop.currentSubscription,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date(
        updatedSubscription.current_period_end * 1000
      ),
    };

    await shop.save();

    return res.status(200).json({
      success: true,
      message: "Subscription will be cancelled at the end of the billing period",
      cancelAt: new Date(updatedSubscription.current_period_end * 1000),
      subscriptionStatus: updatedSubscription.status,
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to cancel subscription",
    });
  }
};




















// export const subscribeShop = async (req, res) => {
//   try {
//     const { customerId, planId, useExistingCard } = req.body;
//     const shopId = req.shopId;

//     if (!planId) {
//       return res.status(400).json({
//         success: false,
//         message: "Plan is required",
//       });
//     }

//     const shop = await Shop.findById(shopId);
//     if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

//     const plan = await Plan.findById(planId);
//     if (!plan || !plan.isActive)
//       return res.status(400).json({ success: false, message: "Invalid plan" });

//     let stripeCustomerId = shop.stripeCustomerId;

//     // 1️⃣ Create Stripe customer if not exists
//     if (!stripeCustomerId) {
//       const customer = await stripe.customers.create({
//         email: shop.email,
//         name: shop.businessName,
//       });
//       stripeCustomerId = customer.id;
//       shop.stripeCustomerId = stripeCustomerId;
//     }

//     // 2️⃣ Handle new card if provided
//     if (!useExistingCard) {
//       if (!customerId) {
//         return res.status(400).json({
//           success: false,
//           message: "Payment method is required for new card",
//         });
//       }

//       // Attach new card to Stripe customer
//       await stripe.paymentMethods.attach(customerId, { customer: stripeCustomerId });

//       // Set as default payment method
//       await stripe.customers.update(stripeCustomerId, {
//         invoice_settings: { default_payment_method: customerId },
//       });
//     } else {
//       // Make sure customer has a default payment method
//       const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
//       if (!stripeCustomer || !stripeCustomer.invoice_settings?.default_payment_method) {
//         return res.status(400).json({
//           success: false,
//           message: "No existing payment method found. Please add a new card.",
//         });
//       }
//     }

//     // 3️⃣ Cancel existing subscription if exists
//     if (shop.stripeSubscriptionId) {
//       try {
//         await stripe.subscriptions.del(shop.stripeSubscriptionId, { invoice_now: false, prorate: false });
//       } catch (err) {
//         console.warn("Failed to cancel old subscription:", err.message);
//       }
//     }

//     // 4️⃣ Create subscription with default payment method (either new or existing)
//     const subscription = await stripe.subscriptions.create({
//       customer: stripeCustomerId,
//       items: [{ price: plan.stripePriceId }],
//       trial_period_days: plan.trialDays || undefined,
//       payment_settings: { save_default_payment_method: "on_subscription" },
//       expand: ["latest_invoice.payment_intent"],
//     });

//     // 5️⃣ Safely store subscription info in DB
//     const safeDate = (timestamp) => (timestamp ? new Date(timestamp * 1000) : null);

//     shop.plan = plan._id;
//     shop.stripeSubscriptionId = subscription.id;
//     shop.subscriptionStatus = subscription.status;

//     shop.currentSubscription = {
//       plan: plan._id,
//       stripeProductId: plan.stripeProductId,
//       stripePriceId: plan.stripePriceId,
//       currentPeriodStart: safeDate(subscription.current_period_start),
//       currentPeriodEnd: safeDate(subscription.current_period_end),
//       trialStart: safeDate(subscription.trial_start),
//       trialEnd: safeDate(subscription.trial_end),
//       cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
//     };

//     // 6️⃣ Reset bid usage only if period exists
//     if (shop.currentSubscription.currentPeriodStart && shop.currentSubscription.currentPeriodEnd) {
//       shop.bidUsage = {
//         usedThisPeriod: 0,
//         periodStart: shop.currentSubscription.currentPeriodStart,
//         periodEnd: shop.currentSubscription.currentPeriodEnd,
//       };
//     }

//     await shop.save();

//     return res.status(200).json({
//       success: true,
//       message: "Subscription created successfully",
//       subscriptionStatus: subscription.status,
//     });
//   } catch (error) {
//     console.error("Stripe subscription error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Subscription failed",
//     });
//   }
// };
