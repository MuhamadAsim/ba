import jwt from "jsonwebtoken";
import Customer from "../models/customerModel.js";
import Partner from "../models/shopModel.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user;
    let userId;

    if (decoded.role === "customer") {
      userId = decoded.customerId;
      user = await Customer.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "Customer not found" });
      }
    } else if (decoded.role === "shop") {
      userId = decoded.shopId;
      user = await Partner.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "Shop not found" });
      }
    } else {
      return res.status(400).json({ error: "Invalid role in token" });
    }

    req.user = {
      _id: userId,
      role: decoded.role,
      name: user?.name || user?.shopName,
    };

    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
