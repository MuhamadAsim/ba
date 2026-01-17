// import jwt from "jsonwebtoken";
// import Customer from "../models/customerModel.js";
// import Partner from "../models/shopModel.js";

// export const authMiddleware = async (req, res, next) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];

//     if (!token) {
//       return res.status(401).json({ error: "No token provided" });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     let user;
//     let userId;

//     if (decoded.role === "customer") {
//       userId = decoded.customerId;
//       user = await Customer.findById(userId);
//       if (!user) {
//         return res.status(404).json({ error: "Customer not found" });
//       }
//     } else if (decoded.role === "shop") {
//       userId = decoded.shopId;
//       user = await Partner.findById(userId);
//       if (!user) {
//         return res.status(404).json({ error: "Shop not found" });
//       }
//     } else {
//       return res.status(400).json({ error: "Invalid role in token" });
//     }

//     req.user = {
//       _id: userId,
//       role: decoded.role,
//       name: user?.name || user?.shopName,
//     };

//     next();
//   } catch (error) {
//     console.error("Auth error:", error);
//     res.status(401).json({ error: "Invalid or expired token" });
//   }
// };






import jwt from "jsonwebtoken";
import Customer from "../models/customerModel.js";
import Shop from "../models/shopModel.js";
import ShopUser from "../models/shopUserModel.js";




export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user;
    let userId;
    let shopId;

    if (decoded.role === "customer") {
      // Customer login
      userId = decoded.customerId;
      user = await Customer.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      req.user = {
        _id: userId,
        role: "customer",
        name: user?.name || user?.shopName,
      };
      
    } else if (decoded.role === "shop" || decoded.role === "owner") {
      // Shop owner login
      userId = decoded.shopId;
      user = await Shop.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "Shop not found" });
      }
      
      req.user = {
        _id: userId,
        role: "shop", // Ensure it's "shop" not "owner"
        name: user?.businessName || user?.shopName,
      };
      
      req.shopId = userId;
      
    } else if (decoded.userType === "staff" || decoded.role === "staff" || decoded.role === "manager") {
      // Staff/Manager login
      const staffUserId = decoded.userId;
      shopId = decoded.shopId;
      
      if (!shopId) {
        return res.status(400).json({ error: "Shop ID not found in token" });
      }
      
      // Verify staff user exists
      const staffUser = await ShopUser.findById(staffUserId).populate('shop');
      if (!staffUser || !staffUser.isActive) {
        return res.status(404).json({ error: "Staff user not found or inactive" });
      }
      
      // Get the shop
      user = await Shop.findById(shopId);
      if (!user) {
        return res.status(404).json({ error: "Shop not found" });
      }
      
      // Check shop status
      if (user.isBlocked || user.status !== "active") {
        return res.status(401).json({ error: "Shop account is inactive or blocked" });
      }
      
      // CRITICAL: Set role as "shop" for compatibility with existing code
      req.user = {
        _id: shopId, // Use shop ID
        role: "shop", // ← SET AS "shop" NOT "staff" or "manager"
        name: user?.businessName || user?.shopName,
      };
      
      req.shopId = shopId;
      
    } else {
      return res.status(400).json({ error: "Invalid role in token" });
    }

    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};