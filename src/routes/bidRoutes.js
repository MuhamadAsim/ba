//src/routes/bidRoutes.js
import express from "express";
import upload from "../utils/upload.js";
import { createBid} from "../controllers/bidController.js";

const router = express.Router();

// Handle multiple file fields with Multer
const uploadFields = upload.fields([
  { name: "vehicleImages", maxCount: 10 },
  { name: "artworkFiles", maxCount: 5 },
  { name: "exampleFiles", maxCount: 5 },
]);

// POST /api/bids  → create a new bid
router.post("/", uploadFields, createBid);


export default router;
