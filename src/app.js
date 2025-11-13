import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import connectDB from "./configs/db.js";
import bidRoutes from "./routes/bidRoutes.js";
import customerRoutes from "./routes/customerRoutes.js"
import shopRoutes from "./routes/shopRoutes.js"
import googleRoutes from "./routes/googleRoutes.js"
import { errorHandler } from "./middlewares/errorHandlerMiddleware.js";

dotenv.config();
connectDB();
const app = express();

// Middleware//
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/bids", bidRoutes);
app.use("/api/customer",customerRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/OAuth", shopRoutes);


// Error handler
app.use(errorHandler);

export default app;
