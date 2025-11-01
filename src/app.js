import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import connectDB from "./configs/db.js";
import bidRoutes from "./routes/bidRoutes.js";
import { errorHandler } from "./middlewares/errorHandlerMiddleware.js";

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/bids", bidRoutes);

// Error handler
app.use(errorHandler);

export default app;
