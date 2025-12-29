//src/routes/bidRoutes.js
import express from "express";
import { upload } from "../middlewares/upload.js";

import { createBid} from "../controllers/bidController.js";

const router = express.Router();

// Handle multiple file fields with Multer
const uploadFields = upload.fields([
  { name: "vehicleImages", maxCount: 5 },
  { name: "artworkFiles", maxCount: 3 },
  { name: "exampleFiles", maxCount: 3 },
  { name: "coatingPhotos", maxCount: 3 },
  { name: "ppfPhotos", maxCount: 3 }
]);


// POST /api/bids  → create a new bid
router.post("/", uploadFields, createBid);


export default router;
