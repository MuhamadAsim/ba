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
  getMyVerificationRequests
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
  cancelSubscription,
  changePlan,
} from "../controllers/shopController.js";
import { upload } from "../middlewares/upload.js";
import { authenticateShop } from "../middlewares/authShopMiddleware.js";
const router = express.Router();

//Auth
router.post("/signup", registerShop);
router.post("/verify-otp", verifyOtp);
router.post("/signin", signin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

//Registration
router.post(
  "/complete-registration",
  upload.fields([
    { name: "insuranceCertificate", maxCount: 1 },
    { name: "storeFrontPhoto", maxCount: 1 },
    { name: "workSpacePhoto", maxCount: 1 },
    { name: "certificateFiles", maxCount: 5 },
  ]),
  completeRegistration
);

//profile
router.put(
  "/profile/:id",
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "insuranceCertificate", maxCount: 1 },
    { name: "storeFrontPhoto", maxCount: 1 },
    { name: "workSpacePhoto", maxCount: 1 },
    { name: "certificateFiles", maxCount: 5 },
  ]),
  updateShopProfile
);
router.get("/stats", authenticateShop, getShopStats);
router.put(
  "/update-verified-info",
  authenticateShop,
  upload.fields([
    { name: "certificateFiles", maxCount: 5 },
    { name: "insuranceCertificate", maxCount: 1 },
  ]),
  submitVerificationRequest
);
// Get own verification requests
router.get(
  "/my-requests",
  authenticateShop,
  getMyVerificationRequests
);

// bids
router.post("/offers", authenticateShop, makeOffer);
router.get("/available-bids", authenticateShop, getAvailableBidsForShops);
router.post("/bids/:bidId/complete", authenticateShop, markBidCompleted);
// counter offers
router.post(
  "/counter-offers/:counterId/accept",
  authenticateShop,
  acceptCounterOffer
);
router.post(
  "/counter-offers/:counterId/reject",
  authenticateShop,
  rejectCounterOffer
);


//plans
router.get("/plan", authenticateShop, getPlanDetails);
router.put("/plan/change", authenticateShop, changePlan);



//map
router.get("/get-all-shops", getShops);

export default router;
