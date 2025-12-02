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
  rejectVerificationRequest


} from "../controllers/adminController.js";
import { authenticateAdmin } from "../middlewares/adminAuthMiddleware.js";

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
router.get("/shops/unverified", getUnverifiedShops);
router.put("/shops/:shopId/accept", acceptShop);//
router.put("/shops/:shopId/reject", rejectShop);


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

export default router;