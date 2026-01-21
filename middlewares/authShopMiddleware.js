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

    // 🔍 DEBUG: Log what's in the token
    console.log("🔑 JWT Decoded Payload:", {
      userId: decoded.userId,
      shopId: decoded.shopId,
      role: decoded.role,
      userType: decoded.userType,
      email: decoded.email
    });

    // Find the shop
    const shop = await Shop.findById(decoded.shopId);
    if (!shop) {
      return res.status(401).json({ message: "Unauthorized: Shop not found" });
    }

    // Attach shop info to request object
    req.shop = shop;
    req.shopId = shop._id;
    
    // ✅ CRITICAL: Attach user info from JWT to req.user
    req.user = {
      _id: decoded.userId,
      email: decoded.email,
      role: decoded.role || decoded.userType, // Use both fields
      userType: decoded.userType,
      shopId: decoded.shopId,
      status: decoded.status,
      isBlocked: decoded.isBlocked,
      hasActiveSubscription: decoded.hasActiveSubscription,
      subscriptionStatus: decoded.subscriptionStatus
    };

    // 🔍 DEBUG: Confirm what was attached
    console.log("📋 Attached req.user:", req.user);

    next();
  } catch (error) {
    console.error("❌ Shop authentication middleware error:", error);
    res.status(500).json({ message: "Server error during shop authentication" });
  }
};