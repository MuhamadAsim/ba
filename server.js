// ============================================
// server.js
// ============================================
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import connectDB from "./configs/db.js";
import app from "./app.js";

dotenv.config();
connectDB();

const PORT = process.env.PORT || 4000;

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

// ✅ Store io instance in app for access in routes
app.set("io", io);

// ============================================
// SOCKET.IO HANDLERS
// ============================================
io.on("connection", (socket) => {

  // ========== REGULAR CHAT HANDLERS ==========
  socket.on("joinChat", (data) => {
    const chatId = typeof data === "string" ? data : data.chatId;
    socket.join(chatId);
    socket.chatId = chatId;
  });

  socket.on("leaveChat", (data) => {
    const chatId = typeof data === "string" ? data : data.chatId;
    socket.leave(chatId);
  });

  socket.on("typing", ({ chatId, isTyping, userType }) => {
    socket.broadcast.to(chatId).emit("typing", { isTyping, userType });
  });
  // ========== END REGULAR CHAT HANDLERS ==========

  // ========== ADMIN CHAT HANDLERS ==========
  // Shop joins their admin chat room
  socket.on("joinAdminChat", (shopId) => {
    if (shopId === "admin") {
      // Admin joining admin dashboard
      socket.join("admin-dashboard");
    } else {
      // Shop joining their admin chat room
      socket.join(`admin-chat-${shopId}`);
      socket.shopId = shopId;
    }
  });

  // Admin sends a message (optional - if using socket for sending)
  socket.on("adminMessage", (data) => {
    const { chatId, shopId, message } = data;
    
    // Send to the specific shop
    io.to(`admin-chat-${shopId}`).emit("newAdminMessage", {
      chatId,
      shopId,
      message
    });
  });

  socket.on("disconnect", () => {
  });
  // ========== END ADMIN CHAT HANDLERS ==========
});

// Start server
server.listen(PORT, () => {

});

export default server;