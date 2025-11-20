// ============================================
// server.js (CORRECTED)
// ============================================
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.IO to the HTTP server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// Middleware to attach io to requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Socket.IO: handle connections
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Join a specific chat room
  socket.on("joinChat", ({ chatId }) => {
    socket.join(chatId);
    console.log(`Socket ${socket.id} joined chat ${chatId}`);
    socket.broadcast.to(chatId).emit("userJoined", { userId: socket.id });
  });

  // Handle new messages
  socket.on("newMessage", (message) => {
    io.to(message.chatId).emit("newMessage", message);
  });

  // Handle typing indicator
  socket.on("typing", ({ chatId, isTyping, userType }) => {
    socket.broadcast.to(chatId).emit("typing", { isTyping, userType });
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Start server with HTTP + Socket.IO
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default server;