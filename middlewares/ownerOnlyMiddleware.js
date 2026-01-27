// middlewares/ownerOnly.js
export const ownerOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "owner") {
    return res.status(403).json({
      success: false,
      message: "Access denied: Only shop owner can perform this action",
    });
  }
  next();
};
