import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Admin from "../models/adminModel.js";

dotenv.config();




const ADMIN_BLOCKED_PATHS = [
  "/api/admin/create-shop",
];

export async function authenticateAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Missing Authorization header"
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid Authorization header"
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);


    // Method 2: DB admin
    let adminFromDb = null;
    try {
      adminFromDb = await Admin.findOne({
        email: payload.email,
        isActive: true
      });
    } catch (dbError) {
      console.warn(
        "Admin model lookup failed, falling back to env check:",
        dbError.message
      );
    }

    const isValidAdmin = adminFromDb || isEnvAdmin;

    if (!isValidAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden - Admin not found or disabled"
      });
    }



    // Attach admin info
    req.admin = {
      email: payload.email,
      id: adminFromDb?._id || null,
      isActive: true,
      role: payload.role || "admin" 
    };


    // ===== ROLE-BASED URL BLOCKING =====
    if (
      req.admin.role === "admin" &&
      ADMIN_BLOCKED_PATHS.some(path =>
        req.originalUrl.startsWith(path)
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: insufficient privileges for this action"
      });
    }

    console.log("asdasdsadaspoiunytghvbtrfgvb", req.admin.role, req.originalUrl);

    next();
  } catch (err) {
    console.error("Authentication error:", err.message);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired"
      });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
}







