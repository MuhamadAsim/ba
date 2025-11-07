
import bcrypt from "bcryptjs";
import Shop from "../models/shopModel.js";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import Bid from "../models/bidModel.js";
import Customer from "../models/customerModel.js";

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
    const bids = await Bid.find({ status: "active" })
      .populate("user_id", "name adress zip")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, total: bids.length, bids });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch bids" });
  }
};
