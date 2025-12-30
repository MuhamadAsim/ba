import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Admin from "../models/adminModel.js"; // Add Admin model import
dotenv.config();

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
    
    // ===== BACKWARD COMPATIBILITY: Check both methods =====
    // Method 1: Check against environment variable (legacy support)
    const isEnvAdmin = payload.email === process.env.ADMIN_EMAIL;
    
    // Method 2: Check against Admin model database
    let adminFromDb = null;
    try {
      adminFromDb = await Admin.findOne({ 
        email: payload.email,
        isActive: true 
      });
    } catch (dbError) {
      console.warn("Admin model lookup failed, falling back to env check:", dbError.message);
      // Continue with env check only
    }
    
    // Determine if admin is valid
    const isValidAdmin = adminFromDb || isEnvAdmin;
    
    if (!isValidAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: "Forbidden - Admin not found or disabled" 
      });
    }
    
    // Attach admin info to request
    req.admin = { 
      email: payload.email,
      id: adminFromDb?._id || null,
      isActive: true,
      // Keep legacy compatibility - include role if present in token
      role: payload.role || "admin"
    };
    
    next();
  } catch (err) {
    console.error("Authentication error:", err.message);
    
    // Handle specific JWT errors
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

// ===== OPTIONAL: Enhanced middleware with more features =====
/**
 * Middleware to verify admin and attach full admin data
 * Use this for routes that need full admin object
 */
export async function authenticateAdminEnhanced(req, res, next) {
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
    
    // Always try to get admin from database first
    const admin = await Admin.findOne({ 
      email: payload.email,
      isActive: true 
    });
    
    // Fallback to env check only if no admin in DB
    if (!admin) {
      // Check if it's the legacy admin from env
      if (payload.email !== process.env.ADMIN_EMAIL) {
        return res.status(403).json({ 
          success: false, 
          message: "Forbidden - Admin not found or disabled" 
        });
      }
      
      // Legacy admin from env - attach minimal info
      req.admin = { 
        email: payload.email,
        id: null, // No ID for env admin
        isActive: true,
        role: payload.role || "admin",
        isLegacy: true // Flag to indicate this is legacy admin
      };
    } else {
      // Database admin - attach full info
      req.admin = { 
        email: admin.email,
        id: admin._id,
        isActive: admin.isActive,
        role: payload.role || "admin",
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt,
        isLegacy: false
      };
    }
    
    next();
  } catch (err) {
    console.error("Authentication error:", err.message);
    
    // Handle specific JWT errors
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false, 
        message: "Token expired. Please login again." 
      });
    }
    
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid authentication token" 
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      message: "Authentication failed" 
    });
  }
}

// ===== OPTIONAL: Role-based middleware =====
/**
 * Middleware to check for specific roles/permissions
 * Use this for advanced permission management
 */
export function requirePermission(permission) {
  return async function(req, res, next) {
    try {
      // First authenticate
      await authenticateAdminEnhanced(req, res, async () => {
        // Check if admin has the required permission
        // For now, all admins have all permissions
        // You can expand this based on your needs
        
        if (req.admin.isLegacy) {
          // Legacy admin from env - grant all permissions
          next();
        } else {
          // Database admin - check permissions
          // You can add permission checking logic here
          // Example: if (req.admin.role === 'superadmin' || req.admin.permissions.includes(permission))
          next();
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

// ===== OPTIONAL: Migration helper middleware =====
/**
 * Middleware that helps migrate legacy tokens to new format
 */
export async function migrateAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next(); // No auth header, skip migration
    
    const token = authHeader.split(" ")[1];
    if (!token) return next(); // No token, skip
    
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if this is a legacy admin (no adminId in token)
      if (payload.email && !payload.adminId) {
        // Try to find admin in database
        const admin = await Admin.findOne({ email: payload.email });
        
        if (admin) {
          // Admin exists in DB - we could optionally issue a new token here
          // Or just attach the adminId to the request
          req.hasLegacyToken = true;
          req.suggestTokenRefresh = true;
        }
      }
    } catch (tokenError) {
      // Token error - continue without migration
      console.warn("Token migration check failed:", tokenError.message);
    }
    
    next();
  } catch (error) {
    console.error("Migration middleware error:", error);
    next(); // Don't block request if migration fails
  }
}