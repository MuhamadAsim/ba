import jwt from "jsonwebtoken";
import Shop from "../models/shopModel.js";

export const authenticateShop = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // We assume you encoded the shop ID as "shopId" in the JWT payload
    const shop = await Shop.findById(decoded.shopId);
    if (!shop) {
      return res.status(401).json({ message: "Unauthorized: Shop not found" });
    }

    // Attach shop info to request object
    req.shop = shop;
    req.shopId = shop._id;

    next();
  } catch (error) {
    console.error("Shop authentication middleware error:", error);
    res.status(500).json({ message: "Server error during shop authentication" });
  }
};
