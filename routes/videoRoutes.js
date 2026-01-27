// Add these imports at the top of your adminRoutes.js file
import * as videoController from '../controllers/videoController.js';
import express from "express";

const router = express.Router();



// Get all demo videos (with optional filters)
router.get('/demo-videos', videoController.getAllVideos);

// Get single video by ID
router.get('/demo-videos/:id', videoController.getVideoById);

// Create new demo video
router.post('/demo-videos', videoController.createVideo);

// Update demo video
router.put('/demo-videos/:id', videoController.updateVideo);

// Delete demo video
router.delete('/demo-videos/:id', videoController.deleteVideo);

// Toggle video active status
router.patch('/demo-videos/:id/toggle-active', videoController.toggleVideoActive);

// vieos by audience
router.get('/videos/:audience', videoController.getVideosByAudience);


export default router;