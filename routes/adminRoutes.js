import express from "express";
import {
  adminLogin,
  verifyOtp,
  resendOtp,
  getDashboardOverview,
  getDashboardStats,
  getUnverifiedShops,
  acceptShop,
  rejectShop,
  getCustomerStats,
  getAllCustomers,
  getCustomerById,
  getShopStats,
  getAllShops,
  getShopsForMap,
  getShopById,
  updateShopStatus,
  getPendingVerificationRequests,
  getAllVerificationRequests,
  getVerificationRequestDetails,
  approveVerificationRequest,
  rejectVerificationRequest,
  getActiveBids,
  getCompletedBids,
  getAllBids,
  getInProgressBids,
  getBidDetails,
  getBidStats,
  createShopByAdmin,
  toggleBlockShop,
  sendEmail_To_User,
  extendShopTrial,
  bulkExtendTrial,
  getShopTrialInfo
} from "../controllers/adminController.js";
import {
  getAllStories,
  getStoryById,
  createStory,
  updateStory,
  deleteStory,
  deactivateStory,
  reorderStories
} from '../controllers/happyStoryController.js';


import { authenticateAdmin } from "../middlewares/adminAuthMiddleware.js";
import { upload } from "../middlewares/upload.js";
import { sendEmail } from "../utils/sendEmail.js";
const router = express.Router();





// Auth
router.post("/login", adminLogin);
router.post("/verify-otp", verifyOtp);   
router.post("/resend-otp", resendOtp);


//happstories
router.get('/happy-stories', getAllStories);
router.get('/happy-stories/:id', getStoryById);



//Authenticate
router.use(authenticateAdmin);


// Dashboard
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/overview", getDashboardOverview);


//shop registeration
router.post(
  '/shops/create',
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "insuranceCertificate", maxCount: 1 },
    { name: "storeFrontPhoto", maxCount: 1 },
    { name: "workSpacePhoto", maxCount: 1 },
    { name: "certificateFiles", maxCount: 5 },
  ]),
  createShopByAdmin
);
router.get("/shops/unverified", getUnverifiedShops);
router.put("/shops/:shopId/accept", acceptShop);//
router.put("/shops/:shopId/reject", rejectShop);
router.patch("/shops/:shopId/block", toggleBlockShop);



//shop page
router.get("/shops/stats", getShopStats);
router.get("/shops", getAllShops);
router.get("/shops/map", getShopsForMap);
// router.get("/shops/:shopId", getShopById);
router.get("/shops/:shopId", getShopById);
// Shop trial management routes
router.post('/shops/:shopId/extend-trial', extendShopTrial);
router.get('/shops/:shopId/trial-info', getShopTrialInfo);
router.post('/shops/bulk-extend-trial', bulkExtendTrial);


router.put("/shops/:shopId/status", updateShopStatus);


//customer routes
router.get("/customers/stats", getCustomerStats);
router.get("/customers", getAllCustomers);
router.get("/customers/:id/details", getCustomerById);


//update requests
router.get(
  "/pending",
  getPendingVerificationRequests
);

// Get all verification requests (with optional filters)
router.get(
  "/verification/all",
  getAllVerificationRequests
);

// Get single verification request details
router.get(
  "/:requestId",
  getVerificationRequestDetails
);

// Approve verification request
router.post(
  "/:requestId/approve",
  approveVerificationRequest
);

// Reject verification request
router.post(
  "/:requestId/reject",
  rejectVerificationRequest
);





// Bid management routes
router.get("/bids/active", getActiveBids);
router.get("/bids/in-progress", getInProgressBids);
router.get("/bids/completed", getCompletedBids);
router.get("/bids/all", getAllBids);
router.get("/bids/stats", getBidStats);
router.get("/bids/:bidId", getBidDetails);



//stories
router.post('/happy-stories', upload.single('image'), createStory);
router.put('/happy-stories/:id', upload.single('image'), updateStory);
router.delete('/happy-stories/:id', deleteStory);
router.patch('/happy-stories/:id/deactivate', deactivateStory);
router.patch('/happy-stories/reorder',  reorderStories);



//send email
router.post("/send-email", sendEmail_To_User);


export default router;