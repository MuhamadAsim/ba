
import bcrypt from "bcryptjs";
import Shop from "../models/shopModel.js";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import Bid from "../models/bidModel.js";
import Customer from "../models/customerModel.js";
import Offer from "../models/offerModel.js";

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






// // get the bids to search and make offers
// export const getAvailableBidsForShops = async (req, res) => {
//   try {
//     await updateExpiredBids();

//     const shopId = req.shopId; // ✅ from authenticateShop middleware

//     const bids = await Bid.find({ status: "active" })
//       .populate("user_id", "name address zip")
//       .sort({ createdAt: -1 });

//     // 🔹 Fetch all offers made by this shop once
//     const shopOffers = await Offer.find({ shopId }).select("bidId");

//     // 🔹 Convert to Set for O(1) lookup
//     const offeredBidIds = new Set(shopOffers.map(o => o.bidId.toString()));

//     // 🔹 Add `hasOffered` flag for each bid
//     const bidsWithOfferStatus = bids.map(bid => ({
//       ...bid.toObject(),
//       hasOffered: offeredBidIds.has(bid._id.toString()),
//     }));

//     res.status(200).json({
//       success: true,
//       total: bids.length,
//       bids: bidsWithOfferStatus,
//     });

//   } catch (error) {
//     console.error("❌ Error fetching bids for shops:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch bids" });
//   }
// };




export const getAvailableBidsForShops = async (req, res) => {
  try {
    await updateExpiredBids();

    const shopId = req.shopId;

    // 1️⃣ Get all active bids
    const bids = await Bid.find({ status: "active" })
      .populate("user_id", "name address zip")
      .sort({ createdAt: -1 });

    // 2️⃣ Get all offers by this shop
    const shopOffers = await Offer.find({ shopId })
      .populate("counterOffers.createdBy", "name") // optional
      .lean();

    // 3️⃣ Make quick lookup table
    const offerMap = {};
    shopOffers.forEach((offer) => {
      offerMap[offer.bidId.toString()] = offer;
    });

    // 4️⃣ Attach hasOffered + myOffer (without changing old flow)
    const bidsWithOfferStatus = bids.map((bid) => {
      const bidObj = bid.toObject();
      const bidIdStr = bid._id.toString();

      const myOffer = offerMap[bidIdStr] || null;

      return {
        ...bidObj,
        hasOffered: !!myOffer,   // 👈 OLD FLOW (unchanged)
        myOffer: myOffer         // 👈 NEW DATA (safe addition)
      };
    });

    res.status(200).json({
      success: true,
      total: bids.length,
      bids: bidsWithOfferStatus,
    });

  } catch (error) {
    console.error("❌ Error fetching bids for shops:", error);
    res.status(500).json({ success: false, message: "Failed to fetch bids" });
  }
};








export const makeOffer = async (req, res) => {
  try {
    console.log("📥 Incoming offer request:", req.body);
    const { bidId, price, note } = req.body;
    const shopId = req.user?._id || req.shopId;

    console.log("🔍 Parsed data =>", { bidId, price, note, shopId });

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
      message: note || "",
      status: "pending",
    });

    await offer.save();

    console.log("✅ Offer saved:", offer._id);

    // 6️⃣ Link offer to bid
    bid.offers.push(offer._id);
    await bid.save();

    console.log("🔗 Linked offer to bid successfully");

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
















// controllers/shopController.js
export const getAllShops = async (req, res) => {
  try {

    console.log("Called");
    const shops = [
      {
        _id: "1",
        businessName: "Elite Auto Wraps",
        address: "123 Main St, New York, NY",
        zipcode: "10001",
        country: "USA",
        coordinates: { lat: 40.7128, lng: -74.006 },
        services: ["PPF", "Wraps", "Tinting"],
        phone: "(555) 123-4567",
        rating: 4.8,
        reviews: 124,
        image: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400",
      },
      {
        _id: "2",
        businessName: "Precision Detail Studio",
        address: "456 Oak Ave, Brooklyn, NY",
        zipcode: "11201",
        country: "USA",
        coordinates: { lat: 40.650002, lng: -73.949997 },
        services: ["Ceramic Coating", "PPF", "Detailing"],
        phone: "(555) 987-6543",
        rating: 4.9,
        reviews: 89,
        image: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=400",
      },
     
    ];

    res.status(200).json({ shops });
  } catch (error) {
    console.error("Error fetching shops:", error);
    res.status(500).json({ message: "Server error fetching shops" });
  }
};











// // ---------------------- GET ALL SHOPS ----------------------
// export const getShops = async (req, res) => {
//   try {
//     const {
//       lat,
//       lng,
//       radius, // in kilometers
//       services, // comma-separated services filter
//       zipcode,
//       country,
//       search, // search by business name
//       page = 1,
//       limit = 20,
//     } = req.query;

//     let query = {
//       status: "active",
//       isVerified: true,
//       isEmailVerified: true,
//     };

//     // Filter by services
//     if (services) {
//       const serviceArray = services.split(",").map((s) => s.trim());
//       query.services = { $in: serviceArray };
//     }

//     // Filter by zipcode
//     if (zipcode) {
//       query.zipCode = zipcode;
//     }

//     // Filter by country
//     if (country) {
//       query.country = { $regex: country, $options: "i" };
//     }

//     // Search by business name
//     if (search) {
//       query.businessName = { $regex: search, $options: "i" };
//     }

//     let shops;

//     // Location-based search (if lat/lng provided)
//     if (lat && lng) {
//       const latitude = parseFloat(lat);
//       const longitude = parseFloat(lng);
//       const maxDistance = radius ? parseFloat(radius) * 1000 : 50000; // default 50km

//       shops = await Shop.aggregate([
//         {
//           $geoNear: {
//             near: {
//               type: "Point",
//               coordinates: [longitude, latitude],
//             },
//             distanceField: "distance",
//             maxDistance: maxDistance,
//             spherical: true,
//             query: query,
//           },
//         },
//         {
//           $skip: (parseInt(page) - 1) * parseInt(limit),
//         },
//         {
//           $limit: parseInt(limit),
//         },
//         {
//           $project: {
//             password: 0,
//             otp: 0,
//             otpExpiry: 0,
//             resetPasswordOtp: 0,
//             resetPasswordOtpExpiry: 0,
//             paymentInfo: 0,
//           },
//         },
//       ]);
//     } else {
//       // Regular query without location sorting
//       shops = await Shop.find(query)
//         .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordOtpExpiry -paymentInfo")
//         .limit(parseInt(limit))
//         .skip((parseInt(page) - 1) * parseInt(limit))
//         .sort({ createdAt: -1 });
//     }

//     // Format response to match frontend structure
//     const formattedShops = shops.map((shop) => ({
//       _id: shop._id || shop.id,
//       businessName: shop.businessName,
//       address: shop.address,
//       zipcode: shop.zipCode,
//       country: shop.country,
//       coordinates: {
//         lat: shop.latitude,
//         lng: shop.longitude,
//       },
//       services: shop.services || [],
//       phone: `${shop.countryCode} ${shop.phone}`,
//       rating: shop.rating || 0, // ⚠️ MISSING FIELD - Need to add to schema
//       reviews: shop.reviewCount || 0, // ⚠️ MISSING FIELD - Need to add to schema
//       image: shop.storeFrontPhoto || shop.profilePic || "",
//       distance: shop.distance ? (shop.distance / 1000).toFixed(2) : null, // Convert to km
      
//       // Additional useful data
//       ownerName: shop.ownerName,
//       website: shop.website,
//       vinylFilms: shop.vinylFilms,
//       certificates: shop.certificates,
//       socialMedia: shop.socialMedia,
//       workSpacePhoto: shop.workSpacePhoto,
//       plan: shop.plan,
//       startDate: shop.startDate,
//     }));

//     // Get total count for pagination
//     const total = await Shop.countDocuments(query);

//     res.json({
//       status: "success",
//       data: {
//         shops: formattedShops,
//         pagination: {
//           total,
//           page: parseInt(page),
//           limit: parseInt(limit),
//           pages: Math.ceil(total / parseInt(limit)),
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Get shops error:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Failed to fetch shops",
//       error: error.message,
//     });
//   }
// };



// controllers/shopController.js

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










// -------------------- ACCEPT COUNTER OFFER --------------------
export const acceptCounterOffer = async (req, res) => {
  try {
    const { counterId } = req.params;
    const { bidId } = req.body;
    const shopId = req.shop._id; // From auth middleware

    // Find the offer
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

    // Find the specific counter offer
    const counterOffer = offer.counterOffers.id(counterId);

    if (!counterOffer) {
      return res.status(404).json({
        success: false,
        message: "Counter offer not found",
      });
    }

    // Check if already responded to
    if (counterOffer.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Counter offer has already been ${counterOffer.status}`,
      });
    }

    // Update counter offer status
    counterOffer.status = "accepted";
    counterOffer.respondedAt = new Date();

    // Update the main offer price to the counter offer price
    offer.price = counterOffer.counterPrice;
    offer.status = "accepted"; // Accept the main offer too

    await offer.save();

    // Update the bid status to "in_progress" and set acceptedOffer
    const bid = await Bid.findById(bidId);
    if (bid) {
      bid.status = "in_progress";
      bid.acceptedOffer = offer._id;
      await bid.save();

      // Optional: Reject all other offers for this bid
      await Offer.updateMany(
        {
          bidId: bidId,
          _id: { $ne: offer._id },
          status: "pending",
        },
        {
          $set: { status: "rejected" },
        }
      );
    }

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

    // Find the offer
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

    // Find the specific counter offer
    const counterOffer = offer.counterOffers.id(counterId);

    if (!counterOffer) {
      return res.status(404).json({
        success: false,
        message: "Counter offer not found",
      });
    }

    // Check if already responded to
    if (counterOffer.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Counter offer has already been ${counterOffer.status}`,
      });
    }

    // Update counter offer status
    counterOffer.status = "rejected";
    counterOffer.respondedAt = new Date();

    // Keep the original offer active (don't change main offer status)
    await offer.save();

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