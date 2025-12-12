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
  toggleBlockShop


} from "../controllers/adminController.js";
import { authenticateAdmin } from "../middlewares/adminAuthMiddleware.js";
import { upload } from "../middlewares/upload.js";
const router = express.Router();





// Auth
router.post("/login", adminLogin);
router.post("/verify-otp", verifyOtp);   
router.post("/resend-otp", resendOtp);   


// Dashboard
router.use(authenticateAdmin);
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
router.get("/shops/:shopId", getShopById);
router.put("/shops/:shopId/status", updateShopStatus);


//customer routes
router.get("/customers/stats", getCustomerStats);
router.get("/customers", getAllCustomers);
router.get("/customers/:customerId", getCustomerById);


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






export default router;