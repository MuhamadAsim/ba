//src/routes/bidRoutes.js
import express from "express";
import {
    createPlan,
    getAllPlans,
    updatePlan,
    togglePlanStatus,
    softDeletePlan,
    getPlanById,
} from '../controllers/planManagementController.js'
import { authenticateAdmin } from "../middlewares/adminAuthMiddleware.js"
import {superAdminOnly} from "../middlewares/superAdminOnlyMiddleware.js"


const router = express.Router();



router.get("/", getAllPlans);
router.get("/:id",getPlanById);



router.use(authenticateAdmin, superAdminOnly);

// POST /api/bids  → create a new bid
router.post("/", createPlan);
router.put("/:id", updatePlan);
router.patch("/:id/status", togglePlanStatus);
router.delete("/:id", softDeletePlan);


export default router;
