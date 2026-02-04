import express from "express";
import {
  adminLogin,
  verifyOtp,
  resendOtp,
  requestPasswordChange,
  verifyPasswordChangeOtp,
  changePassword,
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
  adminRepostBidWithRadius,
  createShopByAdmin,
  toggleBlockShop,
  sendEmail_To_User,
  extendShopTrial,
  getAdminActivities,
  getActivityTypes,
  updateShopByAdmin,
  getShops,
  blockCustomer,
} from "../controllers/adminController.js";
import {
  getAllStories,
  getStoryById,
  createStory,
  updateStory,
  deleteStory,
  deactivateStory,
  reorderStories,
  getStoriesOnly,
  getBillboardsOnly
} from '../controllers/happyStoryController.js';
import { getAllAdmins, createAdmin, updateAdmin, toggleAdminStatus } from "../controllers/adminAccountController.js";

import { authenticateAdmin } from "../middlewares/adminAuthMiddleware.js";
import {superAdminOnly} from "../middlewares/superAdminOnlyMiddleware.js"
import { upload } from "../middlewares/upload.js";
import { shopUpload } from "../middlewares/shopUpload.js";

const router = express.Router();

// Auth (no authentication required)
router.post("/login", adminLogin);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

// Password Change Routes
router.post("/request-password-change", requestPasswordChange);
router.post("/verify-password-change-otp", verifyPasswordChangeOtp);
router.put("/change-password", authenticateAdmin, changePassword);

// Happy stories (public)
router.get('/happy-stories', getAllStories);
router.get('/happy-stories/:id', getStoryById);
router.get('/happy-stories/type/stories', getStoriesOnly); 
router.get('/happy-stories/type/billboards', getBillboardsOnly); 





// ⚠️ ALL ROUTES BELOW REQUIRE AUTHENTICATION
router.use(authenticateAdmin);





// Dashboard
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/overview", getDashboardOverview);





// Activity routes
router.get("/activities", getAdminActivities);
router.get("/activity-types", getActivityTypes);
router.get("/shops-list", getShops);





// Shop registration
router.post(
  '/shops/create',
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "insuranceCertificate", maxCount: 1 },
    { name: "storeFrontPhoto", maxCount: 1 },
    { name: "workSpacePhoto", maxCount: 1 },
    { name: "certificateFiles", maxCount: 5 },
  ]),
  superAdminOnly,
  createShopByAdmin
);
router.get("/shops/unverified", getUnverifiedShops);
router.put("/shops/:shopId/accept", acceptShop);
router.put("/shops/:shopId/reject", rejectShop);
router.patch("/shops/:shopId/toggleblock", toggleBlockShop);




// Shop page
router.get("/shops/stats", getShopStats);
router.get("/shops", getAllShops);
router.get("/shops/map", getShopsForMap);
router.get("/shops/:shopId", getShopById);





// Shop trial management routes
router.post('/shops/:shopId/extend-trial', extendShopTrial);
router.put("/shops/:shopId/status", updateShopStatus);
router.put("/shops/update", shopUpload.fields([
  { name: "profilePic", maxCount: 1 },
  { name: "insuranceCertificate", maxCount: 1 },
  { name: "storeFrontPhoto", maxCount: 1 },
  { name: "workSpacePhoto", maxCount: 1 },
  { name: "certificateFiles", maxCount: 5 },
]), updateShopByAdmin);




// Customer routes
router.get("/customers/stats", getCustomerStats);
router.get("/customers", getAllCustomers);
router.get("/customers/:id/details", getCustomerById);
router.post("/customers/:id/block", blockCustomer);




// Verification requests - SPECIFIC ROUTES FIRST
router.get("/pending", getPendingVerificationRequests);
router.get("/verification/all", getAllVerificationRequests);




// Bid management routes
router.get("/bids/active", getActiveBids);
router.get("/bids/in-progress", getInProgressBids);
router.get("/bids/completed", getCompletedBids);
router.get("/bids/all", getAllBids);
router.get("/bids/stats", getBidStats);
router.get("/bids/:bidId", getBidDetails);
router.post("/bids/:bidId/repost",adminRepostBidWithRadius );





// Happy stories (admin)
router.post('/happy-stories', upload.single('image'), createStory);
router.put('/happy-stories/:id', upload.single('image'), updateStory);
router.delete('/happy-stories/:id', deleteStory);
router.patch('/happy-stories/:id/deactivate', deactivateStory);
router.patch('/happy-stories/reorder', reorderStories);



// Send email
router.post("/send-email", sendEmail_To_User);




// 🔐 ADMIN ACCOUNT MANAGEMENT (Super Admin only)
router.get("/get-admins", superAdminOnly, getAllAdmins);
router.post("/create-admins", superAdminOnly, createAdmin);
router.put("/update-admins/:id", superAdminOnly, updateAdmin);
router.put("/admins/:id/toggle-status", superAdminOnly, toggleAdminStatus);




// Verification request actions (with :requestId parameter)
router.get("/:requestId", getVerificationRequestDetails);
router.post("/:requestId/approve_request", approveVerificationRequest);
router.post("/:requestId/reject_request", rejectVerificationRequest);




export default router;