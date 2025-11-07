import Bid from "../models/bidModel.js";
import Customer from "../models/customerModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";





// get the status
export const getCustomerBidStats = async (req, res) => {
  try {
    const userId = req.customer?._id || req.params.userId;

    const [active, inProgress, completed, expired, canceled] = await Promise.all([
      Bid.countDocuments({ user_id: userId, status: "active" }),
      Bid.countDocuments({ user_id: userId, status: "in_progress" }),
      Bid.countDocuments({ user_id: userId, status: "completed" }),
      Bid.countDocuments({ user_id: userId, status: "expired" }),
      Bid.countDocuments({ user_id: userId, status: "canceled" }),
    ]);

    const total = active + inProgress + completed + expired + canceled;

    res.json({
      status: "success",
      data: { total, active, inProgress, completed, expired, canceled },
    });
  } catch (error) {
    console.error("Error fetching bid stats:", error);
    res.status(500).json({ status: "error", message: "Server error fetching stats" });
  }
};