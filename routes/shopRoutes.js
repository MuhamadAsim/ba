import express from "express";
import {
  registerShop,
  verifyOtp,
  completeRegistration,
  updateShopProfile,
  signin,
  forgotPassword,
  resetPassword,
  submitVerificationRequest,
  getMyVerificationRequests,
  changePassword
} from "../controllers/shopAuthController.js";
import {
  getAvailableBidsForShops,
  makeOffer,
  getShops,
  acceptCounterOffer,
  rejectCounterOffer,
  markBidCompleted,
  getShopStats,
  getPlanDetails,
  getBidActivities,
  getBidHistorySummary,
  getBidHistory,
  getAllPlans,
  subscribeShop,
  getSubscriptionDetails,
  cancelSubscription
} from "../controllers/shopController.js";
import {
  createChildAccount,
  deleteChildAccount,
  toggleChildAccountStatus,
  getChildAccounts,
  updateChildAccount
} from "../controllers/shopUserController.js";
import { upload } from "../middlewares/upload.js";
import { authenticateShop } from "../middlewares/authShopMiddleware.js";
import { ownerOnly } from "../middlewares/ownerOnlyMiddleware.js";
const router = express.Router();




//Auth
router.post("/signup", registerShop);
router.post("/verify-otp", verifyOtp);
router.post("/signin", signin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", authenticateShop, changePassword)



//Registration
router.post("/complete-registration",
  upload.fields([
    { name: "insuranceCertificate", maxCount: 1 },
    { name: "storeFrontPhoto", maxCount: 1 },
    { name: "workSpacePhoto", maxCount: 1 },
    { name: "certificateFiles", maxCount: 5 },
  ]),
  completeRegistration
);




//profile
router.put("/profile/:id",
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "insuranceCertificate", maxCount: 1 },
    { name: "storeFrontPhoto", maxCount: 1 },
    { name: "workSpacePhoto", maxCount: 1 },
    { name: "certificateFiles", maxCount: 5 },
  ]),
  authenticateShop, ownerOnly,
  updateShopProfile
);
router.get("/stats", authenticateShop, getShopStats);

router.put("/update-verified-info", authenticateShop, ownerOnly,
  upload.fields([
    { name: "certificateFiles", maxCount: 5 },
    { name: "insuranceCertificate", maxCount: 1 },
  ]),
  submitVerificationRequest
);
// Get own verification requests
router.get("/my-requests", authenticateShop, ownerOnly, getMyVerificationRequests);



// bids
router.get("/available-bids", authenticateShop, getAvailableBidsForShops);
router.post("/bids/:bidId/complete", authenticateShop, markBidCompleted);
// In your routes file (e.g., shopRoutes.js)
router.post("/offers",
  authenticateShop,
  upload.array("attachments", 5), // Allow up to 10 files
  makeOffer
); router.get("/bid-history", authenticateShop, getBidHistory);
router.get("/bid-history/summary", authenticateShop, getBidHistorySummary);
router.get("/bid-history/:bidId", authenticateShop, getBidActivities);




// counter offers
router.post("/counter-offers/:counterId/accept", authenticateShop, acceptCounterOffer);
router.post("/counter-offers/:counterId/reject", authenticateShop, rejectCounterOffer);




//plans
router.get("/get-plans", getAllPlans);
router.get("/plan", authenticateShop, ownerOnly, getPlanDetails);
router.post("/subscribe", authenticateShop, ownerOnly, subscribeShop);
router.get("/subscription-details", authenticateShop, ownerOnly, getSubscriptionDetails);
router.post("/cancel-subscription", authenticateShop, ownerOnly, cancelSubscription);





// Sub-accounts management 
router.post("/sub-accounts", authenticateShop, ownerOnly, createChildAccount);
router.get("/sub-accounts", authenticateShop, ownerOnly, getChildAccounts);
router.put("/sub-accounts/:userId", authenticateShop, ownerOnly, updateChildAccount);
router.delete("/sub-accounts/:userId", authenticateShop, ownerOnly, deleteChildAccount);
router.put("/sub-accounts/:userId/toggle-status", authenticateShop, ownerOnly, toggleChildAccountStatus);



//map//
router.get("/get-all-shops", getShops);

export default router;
