
import Shop from "../models/shopModel.js";
import dotenv from "dotenv";
import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import Event from "../models/eventModel.js";
import { notifyNewOffer } from "../utils/notifyNewOffer.js";
import { notifyCounterAccepted } from "../utils/notifyCounterAccepted.js";
import { notifyBidCompleted } from "../utils/notifyBidCompleted.js";

dotenv.config();





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

// ============================================
// GET AVAILABLE BIDS FOR SHOP (15-mile radius)
// ============================================
export const getAvailableBidsForShops = async (req, res) => {
  try {
    await updateExpiredBids();

    const shopId = req.shopId;

    // ---------------------- 1️⃣ GET SHOP LOCATION ----------------------
    const shop = await Shop.findById(shopId).select("location latitude longitude");

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

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

    // ---------------------- 2️⃣ ACTIVE BIDS (15-MILE RADIUS) ----------------------
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
        select: "name email phone zip address", // Get all customer fields
      })
      .sort({ createdAt: -1 });

    // ---------------------- 3️⃣ OFFERS MADE BY THIS SHOP ----------------------
    const shopOffers = await Offer.find({ shopId })
      .populate("counterOffers.createdBy", "name")
      .lean();

    const offerMap = {};
    shopOffers.forEach((offer) => {
      offerMap[offer.bidId.toString()] = offer;
    });

    // ---------------------- 4️⃣ RELATED BIDS (ALREADY ASSIGNED) ----------------------
    const relatedBids = await Bid.find({
      currentShopId: shopId,
      status: { $in: ["in_progress", "completed"] },
    })
      .populate({
        path: "user_id",
        select: "name email phone zip address", // Get all customer fields
      })
      .sort({ createdAt: -1 });

    // ---------------------- 5️⃣ MERGE BIDS (NO DUPLICATES) ----------------------
    const allBidsMap = {};

    [...activeBids, ...relatedBids].forEach((bid) => {
      allBidsMap[bid._id.toString()] = bid.toObject();
    });

    // ---------------------- 6️⃣ FORMAT BIDS WITH PROPER CUSTOMER INFO ----------------------
    const formattedBids = Object.values(allBidsMap).map((bid) => {
      const myOffer = offerMap[bid._id.toString()] || null;
      
      // Extract customer info
      const customer = bid.user_id || {};
      
      console.log("🔄 Processing bid:", bid._id); // DEBUG
      console.log("📦 Raw customer data:", customer); // DEBUG
      console.log("📫 Customer zip:", customer.zip); // DEBUG
      console.log("🏠 Customer address:", customer.address); // DEBUG
      
      // Format based on bid status
      let customerInfo = {};
      
      if (bid.status === "active") {
        // For active bids: initials only, no contact info
        customerInfo = {
          name: formatNameInitials(customer.name || ''),
          zip: customer.zip || '',
          address: customer.address || '',
          // No email/phone for active bids
        };
      } else {
        // For in_progress/completed bids: full info
        customerInfo = {
          name: customer.name || '',
          email: customer.email || '',
          phone: customer.phone || '',
          zip: customer.zip || '',
          address: customer.address || '',
        };
      }

      console.log("✅ Formatted customer info:", customerInfo); // DEBUG

      return {
        ...bid,
        user_id: customerInfo, // Replace populated object with formatted info
        hasOffered: !!myOffer,
        myOffer,
      };
    });

    // ---------------------- 7️⃣ RESPONSE ----------------------
    // Add debug info to response
    const responseData = {
      success: true,
      total: formattedBids.length,
      radiusMiles: MAX_RADIUS_MILES,
      bids: formattedBids,
      debug: formattedBids.length > 0 ? {
        sampleBid: {
          id: formattedBids[0]._id,
          status: formattedBids[0].status,
          user_id: formattedBids[0].user_id,
        }
      } : null
    };

    console.log("📤 Final response sample:", responseData.debug); // DEBUG
    
    return res.status(200).json(responseData);
  } catch (error) {
    console.error("❌ Error fetching bids for shops:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bids",
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










// Make Offer
export const makeOffer = async (req, res) => {
  try {
    // Accept both 'note' and 'message' for compatibility
    const { bidId, price, note, message } = req.body;
    const shopId = req.user?._id || req.shopId;

    console.log("asssssssssssssssssssss",note,message);

    // Use whichever is provided (message takes priority)
    const offerMessage = message || note || "";

    // 1️⃣ Validate input
    if (!bidId || !price) {
      console.log("❌ Missing bidId or price");
      return res.status(400).json({ message: "Bid ID and price are required." });
    }

    // 2️⃣ Verify the bid exists
    const bid = await Bid.findById(bidId);
    if (!bid) {
      console.log("❌ Bid not found:", bidId);
      return res.status(404).json({ message: "Bid not found." });
    }

    if (bid.status !== "active") {
      console.log("❌ Bid not active:", bid.status);
      return res.status(400).json({ message: "Cannot make an offer on this bid." });
    }

    // Customer ID (from bid)
    const customerId = bid.user_id;

    // 3️⃣ Verify shop
    const shop = await Shop.findById(shopId);
    if (!shop) {
      console.log("❌ Shop not found:", shopId);
      return res.status(404).json({ message: "Shop not found or not authorized." });
    }

    // 4️⃣ Check for duplicate offers
    const existingOffer = await Offer.findOne({ bidId, shopId });
    if (existingOffer) {
      console.log("⚠️ Duplicate offer by same shop for same bid");
      return res.status(400).json({ message: "You have already made an offer for this bid." });
    }

    // 5️⃣ Create new offer
    const offer = new Offer({
      bidId,
      shopId,
      price,
      message: offerMessage,  // Use the correct field name
      status: "pending",
    });

    await offer.save();

    // 6️⃣ Link offer to bid
    bid.offers.push(offer._id);
    await bid.save();

    console.log("🔗 Linked offer to bid successfully");

    // ⭐ 7️⃣ CREATE EVENT for both shop & customer  
    const event = new Event({
      type: "new-offer",
      bidId,
      offerId: offer._id,
      shopId,
      customerId,
      message: `A new offer was submitted for bid (${bid.serviceDescription})`,
    });

    await event.save();

    // Fix: Pass the correct message variable
    notifyNewOffer(offer, bidId, shopId, price, offerMessage);

    return res.status(201).json({
      success: true,
      message: "Offer submitted successfully.",
      data: offer,
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
          },
        },
      ]);
    } else {
      shops = await Shop.find(query)
        .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry -paymentInfo")
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
      image: shop.storeFrontPhoto || shop.profilePic || "",
      ownerName: shop.ownerName || "",
      website: shop.website || "",
      vinylFilms: shop.vinylFilms || [],
      certificates: shop.certificates || [],
      socialMedia: shop.socialMedia || {},
      workSpacePhoto: shop.workSpacePhoto || "",
      plan: shop.plan || "",
      startDate: shop.startDate || "",
      distance: shop.distance ? (shop.distance / 1000).toFixed(2) : null,
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
    const shopId = req.shop._id; // From auth middleware

    // 1️⃣ Find the offer with this counter offer
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

    // 2️⃣ Find the specific counter offer
    const counterOffer = offer.counterOffers.id(counterId);

    if (!counterOffer) {
      return res.status(404).json({
        success: false,
        message: "Counter offer not found",
      });
    }

    // 3️⃣ Check if already responded
    if (counterOffer.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Counter offer has already been ${counterOffer.status}`,
      });
    }

    // 4️⃣ Accept counter offer
    counterOffer.status = "accepted";
    counterOffer.respondedAt = new Date();

    // 5️⃣ Update main offer price and status
    offer.price = counterOffer.counterPrice;
    offer.status = "accepted";
    await offer.save();

    // 6️⃣ Update bid
    const bid = await Bid.findById(bidId);
    if (bid) {
      bid.status = "in_progress";
      bid.acceptedOffer = offer._id;
      bid.currentShopId = shopId;
      await bid.save();

      // Reject all other pending offers
      await Offer.updateMany(
        {
          bidId: bidId,
          _id: { $ne: offer._id },
          status: "pending",
        },
        { $set: { status: "rejected" } }
      );
    }

    notifyCounterAccepted(offer, counterOffer, shopId, bidId);


    // ⭐⭐⭐ 7️⃣ CREATE EVENT (ADDED ONLY — DOES NOT CHANGE OLD FLOW)
    const customerId = bid.user_id; // from bid model

    await Event.create({
      type: "counter-offer-accepted",
      bidId,
      offerId: offer._id,
      counterOfferId: counterOffer._id,
      shopId,          // shop accepted customer's counter offer
      customerId,      // customer should be notified
      message: `Counter offer for bid "${bid.service}" was accepted (${counterOffer.counterPrice}).`,
    });

    // ⭐ No other logic modified above this point

    res.json({
      success: true,
      message: "Counter offer accepted successfully! The bid is now in progress.",
      offer: {
        id: offer._id,
        price: offer.price,
        status: offer.status,
        counterOffer: {
          id: counterOffer._id,
          status: counterOffer.status,
          price: counterOffer.counterPrice,
        },
      },
      bid: {
        id: bid._id,
        status: bid.status,
        currentShopId: bid.currentShopId,
        acceptedOffer: bid.acceptedOffer,
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

    // ------------------ ADD ACTIVITY LOG ------------------
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

    // Find the bid
    const bid = await Bid.findById(bidId);

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

    // Update bid status to completed
    bid.status = "completed";
    await bid.save();
    notifyBidCompleted(shopId, bidId);


    // -------------------- SAVE EVENT --------------------
    await Event.create({
      userId: bid.userId,
      shopId: shopId,
      bidId: bidId,
      type: "bid-completed",
      message: `The bid has been completed ${bid.serviceDescription}.`,
      metadata: {
        bidId: bid._id,
        offerId: acceptedOffer._id,

      },
    });

    res.json({
      success: true,
      message: "Bid marked as completed successfully",
      bid: {
        id: bid._id,
        status: bid.status,
        completedAt: bid.updatedAt,
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












// Get shop plan details
export const getPlanDetails = async (req, res) => {
  try {
    const shopId = req.shop.id; // Assuming auth middleware adds shop to req

    const shop = await Shop.findById(shopId).select('plan planStartDate trialEndDate');

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Check if still in trial
    const now = new Date();
    const trialEndDate = new Date(shop.trialEndDate);
    const isTrial = now < trialEndDate;

    // Calculate days remaining in trial
    const daysRemaining = isTrial
      ? Math.max(0, Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24)))
      : 0;

    // Calculate next billing date (1 month after trial ends or last billing)
    let nextBillingDate;
    if (isTrial) {
      nextBillingDate = new Date(trialEndDate);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else {
      const monthsSinceStart = Math.floor((now - new Date(shop.planStartDate)) / (1000 * 60 * 60 * 24 * 30));
      nextBillingDate = new Date(shop.planStartDate);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + monthsSinceStart + 1);
    }

    res.status(200).json({
      plan: shop.plan,
      planStartDate: shop.planStartDate,
      trialEndDate: shop.trialEndDate,
      isTrial,
      daysRemaining,
      nextBillingDate: nextBillingDate.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching plan details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};










// Change shop plan (upgrade/downgrade)
export const changePlan = async (req, res) => {
  try {
    const shopId = req.shop.id;
    const { plan } = req.body;

    // Validate plan
    if (!plan || !['basic', 'professional'].includes(plan)) {
      return res.status(400).json({ 
        message: 'Invalid plan. Must be either "basic" or "professional"' 
      });
    }

    const shop = await Shop.findById(shopId);

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Check if already on this plan
    if (shop.plan === plan) {
      return res.status(400).json({ 
        message: `You are already on the ${plan} plan` 
      });
    }

    const previousPlan = shop.plan;
    shop.plan = plan;

    // Optional: Reset plan start date on plan change
    // shop.planStartDate = new Date();

    await shop.save();

    const action = plan === 'professional' ? 'upgraded' : 'downgraded';
    
    res.status(200).json({
      message: `Successfully ${action} from ${previousPlan} to ${plan} plan`,
      plan: shop.plan,
      planStartDate: shop.planStartDate,
      previousPlan,
    });
  } catch (error) {
    console.error('Error changing plan:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};











// Cancel subscription (downgrade to basic)
export const cancelSubscription = async (req, res) => {
  try {
    const shopId = req.shop.id;

    const shop = await Shop.findById(shopId);

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    shop.plan = 'basic';
    await shop.save();

    res.status(200).json({
      message: 'Subscription cancelled. Downgraded to basic plan',
      plan: shop.plan,
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};








// Get plan history (currently just current plan info)
export const getPlanHistory = async (req, res) => {
  try {
    const shopId = req.shop.id;

    const shop = await Shop.findById(shopId).select('plan planStartDate trialEndDate');

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.status(200).json({
      currentPlan: shop.plan,
      planStartDate: shop.planStartDate,
      trialEndDate: shop.trialEndDate,
      // Add billing history from separate model if available
    });
  } catch (error) {
    console.error('Error fetching plan history:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};