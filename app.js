// ============================================
// app.js (CLEAN - NO SOCKET.IO MIDDLEWARE)
// ============================================
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import connectDB from "./configs/db.js";
import bidRoutes from "./routes/bidRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import shopRoutes from "./routes/shopRoutes.js";
import googleRoutes from "./routes/googleRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

import { errorHandler } from "./middlewares/errorHandlerMiddleware.js";

dotenv.config();
connectDB();

const app = express();


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));
// ======================= DEBUG MIDDLEWARE =======================
app.use((req, res, next) => {
  console.log("🔥 Incoming Request:");
  console.log("  Method:", req.method);
  console.log("  URL:", req.originalUrl);
  console.log("  Body:", req.body);
  console.log("  Query:", req.query);
  console.log("  Headers:", req.headers['content-type']); // optional
  next();
});
// =================================================================



// Routes
app.use("/api/bids", bidRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/OAuth", googleRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);


// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;