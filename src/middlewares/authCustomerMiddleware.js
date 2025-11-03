import jwt from "jsonwebtoken";
import Customer from "../models/customerModel.js";

export const authenticateCustomer = async (req, res, next) => {
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

    const customer = await Customer.findById(decoded.customerId);
    if (!customer) {
      return res.status(401).json({ message: "Unauthorized: Customer not found" });
    }

    // Attach customer to request object
    req.customer = customer;

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({ message: "Server error during authentication" });
  }
};
