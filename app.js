// ============================================
// app.js
// ============================================
import express from "express";
import cors from "cors";
import morgan from "morgan";

// Import routes
import bidRoutes from "./routes/bidRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import shopRoutes from "./routes/shopRoutes.js";
import googleRoutes from "./routes/googleRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";
import adminChatRoutes from "./routes/adminSupportRoutes.js";
import stripewebhookRoutes from "./routes/stripeWebhookRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import adminPlanRoutes from "./routes/adminPlanRoutes.js";
import frontendRoutes from "./routes/frontendRoutes.js";
import twilioRoutes from "./routes/twilioRoutes.js";




import { errorHandler } from "./middlewares/errorHandlerMiddleware.js";

// Create Express app
const app = express();

//webhook
app.use("/api/webhook", stripewebhookRoutes);

// ✅ MIDDLEWARE (BEFORE ROUTES)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));



// ✅ ATTACH SOCKET.IO TO REQ (BEFORE ROUTES)
app.use((req, res, next) => {
  req.io = req.app.get("io");
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
app.use("/api/support", adminChatRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/plans", adminPlanRoutes);
app.use("/api/frontend", frontendRoutes);
app.use("/api/twilio", express.urlencoded({ extended: false }), twilioRoutes);







// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// Error handler
app.use(errorHandler);

export default app;