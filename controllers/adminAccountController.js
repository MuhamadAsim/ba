import Admin from "../models/adminModel.js";
import bcrypt from "bcryptjs";

// 📋 GET ALL ADMINS (Super Admin Only)
export const getAllAdmins = async (req, res) => {
  try {
    // Check if user is super_admin
    if (req.admin.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only super admins can view all admins.",
      });
    }

    const admins = await Admin.find()
      .select("-password") // Exclude password
      .sort({ createdAt: -1 }); // Newest first

    res.status(200).json({
      success: true,
      message: "Admins fetched successfully",
      data: admins,
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admins",
      error: error.message,
    });
  }
};

// ➕ CREATE NEW ADMIN (Super Admin Only)
export const createAdmin = async (req, res) => {
  try {
    // Check if user is super_admin
    if (req.admin.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only super admins can create new admins.",
      });
    }

    const { email, password, role } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin with this email already exists",
      });
    }

    // Validate role
    const validRoles = ["admin", "super_admin"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be 'admin' or 'super_admin'",
      });
    }

    // Create new admin
    const newAdmin = new Admin({
      email: email.toLowerCase(),
      password,
      role: role || "admin",
      createdBy: req.admin._id,
      isActive: true,
    });

    await newAdmin.save();

    // Return admin without password
    const adminData = newAdmin.toObject();
    delete adminData.password;

    res.status(201).json({
      success: true,
      message: `${role === "super_admin" ? "Super admin" : "Admin"} created successfully`,
      data: adminData,
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create admin",
      error: error.message,
    });
  }
};






// ✏️ UPDATE ADMIN (Super Admin Only)
export const updateAdmin = async (req, res) => {
  try {
    // Check if user is super_admin
    if (req.admin.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only super admins can update admins.",
      });
    }

    const { id } = req.params;
    const { email, password, role } = req.body;

    // Find admin
    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      // Check if email is already taken by another admin
      const existingAdmin = await Admin.findOne({
        email: email.toLowerCase(),
        _id: { $ne: id },
      });
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: "Email already in use by another admin",
        });
      }

      admin.email = email.toLowerCase();
    }

    // Update password if provided
    if (password && password.trim() !== "") {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }
      admin.password = password;
    }

    // Update role if provided
    if (role) {
      const validRoles = ["admin", "super_admin"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role. Must be 'admin' or 'super_admin'",
        });
      }
      admin.role = role;
    }

    await admin.save();

    // Return admin without password
    const adminData = admin.toObject();
    delete adminData.password;

    res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      data: adminData,
    });
  } catch (error) {
    console.error("Error updating admin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update admin",
      error: error.message,
    });
  }
};







// 🔄 TOGGLE ADMIN STATUS (Super Admin Only)
export const toggleAdminStatus = async (req, res) => {
    try {
      // Check if admin is authenticated
      if (!req.admin || !req.admin.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }
  
      // Check if user is super_admin
      if (req.admin.role !== "super_admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Only super admins can change admin status.",
        });
      }
  
      const { id } = req.params;
  
      // Find admin
      const admin = await Admin.findById(id);
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }
  
      // Prevent super admin from disabling themselves
      // ✅ Use req.admin.id (not _id)
      if (admin._id.toString() === req.admin.id.toString()) {
        return res.status(400).json({
          success: false,
          message: "You cannot disable your own account",
        });
      }
  
      // Toggle status
      admin.isActive = !admin.isActive;
      await admin.save();
  
      // Return admin without password
      const adminData = admin.toObject();
      delete adminData.password;
  
      res.status(200).json({
        success: true,
        message: `Admin ${admin.isActive ? "enabled" : "disabled"} successfully`,
        data: adminData,
      });
    } catch (error) {
      console.error("Error toggling admin status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle admin status",
        error: error.message,
      });
    }
  };