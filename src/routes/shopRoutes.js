import express from "express";
import { registerShop, verifyOtp, signInShop, completeRegistration, updateShopProfile, signin, forgotPassword, resetPassword} from "../controllers/shopAuthController.js";
import { getAvailableBidsForShops, makeOffer } from "../controllers/shopController.js";
import { upload } from "../middlewares/upload.js"
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




// bids
router.post("/offers", authenticateShop, makeOffer);
router.get("/available-bids",authenticateShop, getAvailableBidsForShops);


export default router;
