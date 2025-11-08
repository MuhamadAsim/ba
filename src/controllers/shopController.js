
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




// get the bids to search and make offers
export const getAvailableBidsForShops = async (req, res) => {
  try {
    await updateExpiredBids();

    const shopId = req.shopId; // ✅ from authenticateShop middleware

    const bids = await Bid.find({ status: "active" })
      .populate("user_id", "name address zip")
      .sort({ createdAt: -1 });

    // 🔹 Fetch all offers made by this shop once
    const shopOffers = await Offer.find({ shopId }).select("bidId");

    // 🔹 Convert to Set for O(1) lookup
    const offeredBidIds = new Set(shopOffers.map(o => o.bidId.toString()));

    // 🔹 Add `hasOffered` flag for each bid
    const bidsWithOfferStatus = bids.map(bid => ({
      ...bid.toObject(),
      hasOffered: offeredBidIds.has(bid._id.toString()),
    }));

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
      {
        _id: "3",
        businessName: "Custom Wrap Co",
        address: "789 Pine Rd, Queens, NY",
        zipcode: "11368",
        country: "USA",
        coordinates: { lat: 40.742054, lng: -73.769417 },
        services: ["Custom Graphics", "Color Wraps", "Tinting"],
        phone: "(555) 456-7890",
        rating: 4.7,
        reviews: 156,
        image: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=400",
      },
      {
        _id: "4",
        businessName: "Auto Detailing Pros",
        address: "321 Sunset Blvd, Los Angeles, CA",
        zipcode: "90028",
        country: "USA",
        coordinates: { lat: 34.052235, lng: -118.243683 },
        services: ["Detailing", "Ceramic Coating", "Wraps"],
        phone: "(555) 111-2222",
        rating: 4.6,
        reviews: 202,
        image: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400",
      },
      {
        _id: "5",
        businessName: "Chicago Auto Customs",
        address: "555 Lake Shore Dr, Chicago, IL",
        zipcode: "60611",
        country: "USA",
        coordinates: { lat: 41.8781, lng: -87.6298 },
        services: ["Wraps", "Detailing", "Window Tint"],
        phone: "(555) 333-4444",
        rating: 4.9,
        reviews: 310,
        image: "https://images.unsplash.com/photo-1605559424843-9e4d1ccf3a47?w=400",
      },
        {
        _id: "8",
        businessName: "Precision Detail Studio",
        address: "456 Oak Ave, Brooklyn, NY",
        zipcode: "11201",
        country: "USA",
        coordinates: { lat: 41.650002, lng: -72.949997 },
        services: ["Ceramic Coating", "PPF", "Detailing"],
        phone: "(555) 987-6543",
        rating: 4.9,
        reviews: 89,
        image: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=400",
      },
      {
        _id: "7",
        businessName: "Custom Wrap Co",
        address: "789 Pine Rd, Queens, NY",
        zipcode: "11368",
        country: "USA",
        coordinates: { lat: 43.742054, lng: -71.769417 },
        services: ["Custom Graphics", "Color Wraps", "Tinting"],
        phone: "(555) 456-7890",
        rating: 4.7,
        reviews: 156,
        image: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=400",
      },
      {
        _id: "6",
        businessName: "Auto Detailing Pros",
        address: "321 Sunset Blvd, Los Angeles, CA",
        zipcode: "90028",
        country: "USA",
        coordinates: { lat: 32.052235, lng: -116.243683 },
        services: ["Detailing", "Ceramic Coating", "Wraps"],
        phone: "(555) 111-2222",
        rating: 4.6,
        reviews: 202,
        image: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400",
      },
    ];

    res.status(200).json({ shops });
  } catch (error) {
    console.error("Error fetching shops:", error);
    res.status(500).json({ message: "Server error fetching shops" });
  }
};
