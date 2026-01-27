// middlewares/superAdminOnly.js
export function superAdminOnly(req, res, next) {
  try {
    // Make sure req.admin exists (authenticateAdmin should run before this)
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No admin info found",
      });
    }

    // Only allow super-admin
    if (req.admin.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Super-admin access required",
      });
    }

    // Pass through
    next();
  } catch (err) {
    console.error("Super-admin middleware error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during super-admin verification",
    });
  }
}
