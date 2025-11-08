
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
