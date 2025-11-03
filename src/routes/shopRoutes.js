import express from "express";
import { registerShop, verifyOtp, signInShop, completeRegistration } from "../controllers/shopAuthController.js";
import {upload} from "../middlewares/upload.js"

const router = express.Router();


//Auth
router.post("/signup", registerShop);
router.post("/verify-otp", verifyOtp);
router.post("/signin", signInShop);


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

export default router;
