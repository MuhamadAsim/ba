// ============================================
// server.js (FINAL FIX)
// ============================================
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./configs/db.js";

// Import routes
import bidRoutes from "./routes/bidRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import shopRoutes from "./routes/shopRoutes.js";
import googleRoutes from "./routes/googleRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";

import { errorHandler } from "./middlewares/errorHandlerMiddleware.js";

dotenv.config();
connectDB();

const PORT = process.env.PORT || 5000;

// Create Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// ✅ MIDDLEWARE (BEFORE ROUTES)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));

// ✅ ATTACH SOCKET.IO TO REQ (BEFORE ROUTES)
app.use((req, res, next) => {
  req.io = io;
  console.log("✅ req.io attached");
  next();
});

// ✅ NOW ADD ROUTES (AFTER MIDDLEWARE)
app.use("/api/bids", bidRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/OAuth", googleRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/video", videoRoutes);


// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// Error handler
app.use(errorHandler);

// ============================================
// SOCKET.IO HANDLERS
// ============================================
io.on("connection", (socket) => {
  console.log("✅ New client connected:", socket.id);

 socket.on("joinChat", (data) => {
  const chatId = typeof data === "string" ? data : data.chatId;
  socket.join(chatId);
  socket.chatId = chatId; // Store for later reference
  console.log(`✅ Socket ${socket.id} joined chat ${chatId}`);
});

  socket.on("leaveChat", (data) => {
    const chatId = typeof data === "string" ? data : data.chatId;
    socket.leave(chatId);
    console.log(`✅ Socket ${socket.id} left chat ${chatId}`);
  });

  socket.on("typing", ({ chatId, isTyping, userType }) => {
    socket.broadcast.to(chatId).emit("typing", { isTyping, userType });
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO ready`);
});

export default server;