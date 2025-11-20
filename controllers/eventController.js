import Event from "../models/eventModel.js";

// -------------------- GET EVENTS --------------------
export const getEvents = async (req, res) => {
  try {
    const customerId = req.customer?._id || null; // authenticated customer
    const shopId = req.shop?._id || null; // authenticated shop
    console.log(customerId, shopId);

    if (!customerId && !shopId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view events",
      });
    }

    // Fetch events related to this user/shop
    const events = await Event.find({
      $or: [{ customerId: customerId }, { shopId: shopId }],
    })
      .sort({ createdAt: -1 }) // newest first
      .limit(15) // limit to latest 15 events
      .lean();

    // Map events to include display info
    const formattedEvents = events.map((e) => ({
      id: e._id,
      type: e.type,
      title: e.type.replace(/-/g, " ").toUpperCase(), // simple title formatting
      message: e.message || "",
      metadata: e.metadata || {},
      createdAt: e.createdAt,
    }));

    res.status(200).json({
      success: true,
      total: formattedEvents.length,
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
