import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export function authenticateAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: "Missing Authorization header" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Invalid Authorization header" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Optional: check payload email matches ADMIN_EMAIL
    if (payload.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    req.admin = { email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}
