// import Event from "../models/eventModel.js";




// // -------------------- GET EVENTS --------------------
// export const getEvents = async (req, res) => {
//   try {
//     const customerId = req.customer?._id;
//     const shopId = req.shop?._id;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 15;
//     const skip = (page - 1) * limit;

//     if (!customerId && !shopId) {
//       return res.status(403).json({
//         success: false,
//         message: "Not authorized to view events",
//       });
//     }

//     // Simple query: who's asking?
//     let query = customerId ? { customerId } : { shopId };

//     // Get total count for pagination
//     const totalEvents = await Event.countDocuments(query);

//     // Fetch events with pagination
//     const events = await Event.find(query)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean();

//     const formattedEvents = events.map((e) => ({
//       id: e._id,
//       type: e.type,
//       title: e.title || e.type.replace(/-/g, " ").toUpperCase(),
//       message: e.message,
//       metadata: e.metadata || {},
//       createdAt: e.createdAt,
//       ...(e.bidId && { bidId: e.bidId }),
//       ...(e.offerId && { offerId: e.offerId }),
//     }));

//     res.status(200).json({
//       success: true,
//       page,
//       limit,
//       total: totalEvents,
//       totalPages: Math.ceil(totalEvents / limit),
//       events: formattedEvents,
//     });
//   } catch (err) {
//     console.error("❌ Error fetching events:", err);
//     res.status(500).json({
//       success: false,
//       message: "Server error while fetching events",
//       error: err.message,
//     });
//   }
// };








import Event from "../models/eventModel.js";

// -------------------- GET EVENTS --------------------
export const getEvents = async (req, res) => {
  try {
    const customerId = req.customer?._id;
    const shopId = req.shop?._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    if (!customerId && !shopId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view events",
      });
    }

    // Simple query: who's asking?
    let query = customerId ? { customerId } : { shopId };

    // Get total count for pagination
    const totalEvents = await Event.countDocuments(query);

    // Fetch events with pagination
    const events = await Event.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedEvents = events.map((e) => ({
      id: e._id,
      type: e.type,
      title: e.title || getDefaultTitle(e.type),
      message: e.message,
      metadata: e.metadata || {},
      createdAt: e.createdAt,
      ...(e.bidId && { bidId: e.bidId }),
      ...(e.offerId && { offerId: e.offerId }),
    }));

    res.status(200).json({
      success: true,
      page,
      limit,
      total: totalEvents,
      totalPages: Math.ceil(totalEvents / limit),
      events: formattedEvents,
    });
  } catch (err) {
    console.error("❌ Error fetching events:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching events",
      error: err.message,
    });
  }
};


// -------------------- GET SHOP EVENTS --------------------
export const getShopEvents = async (req, res) => {
  try {
    const shopId = req.shop?._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view events",
      });
    }

    // Query for shop events
    let query = { shopId };

    // Get total count for pagination
    const totalEvents = await Event.countDocuments(query);

    // Fetch events with pagination
    const events = await Event.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedEvents = events.map((e) => ({
      id: e._id,
      type: e.type,
      title: e.title || getDefaultTitle(e.type),
      message: e.message,
      metadata: e.metadata || {},
      createdAt: e.createdAt,
      ...(e.bidId && { bidId: e.bidId }),
      ...(e.offerId && { offerId: e.offerId }),
    }));

    res.status(200).json({
      success: true,
      page,
      limit,
      total: totalEvents,
      totalPages: Math.ceil(totalEvents / limit),
      events: formattedEvents,
    });
  } catch (err) {
    console.error("❌ Error fetching shop events:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching events",
      error: err.message,
    });
  }
};


// Helper function to get default title based on event type
const getDefaultTitle = (type) => {
  const titleMap = {
    'bid-created': 'New Bid Created',
    'bid-reposted': 'Bid Reposted',
    'bid-accepted': 'Bid Accepted',
    'bid-rejected': 'Bid Rejected',
    'bid-canceled': 'Bid Canceled',
    'offer-received': 'New Offer Received',
    'offer-accepted': 'Offer Accepted',
    'offer-rejected': 'Offer Rejected',
    'status-updated': 'Status Updated',
    'message-received': 'New Message',
    'reminder': 'Reminder',
    'deadline-approaching': 'Deadline Approaching',
    'payment-received': 'Payment Received',
    'completion-confirmed': 'Service Completed',
  };
  
  return titleMap[type] || type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};