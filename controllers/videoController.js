// controllers/videoModelController.js
import videoModel from '../models/videoModel.js';

// @desc    Get all demo videos
// @route   GET /api/admin/demo-videos
// @access  Private/Admin
export const getAllVideos = async (req, res) => {
  try {
    const { targetAudience, isActive } = req.query;
    
    // Build filter
    const filter = {};
    if (targetAudience && ['customers', 'shops'].includes(targetAudience)) {
      filter.targetAudience = targetAudience;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const videos = await videoModel.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      status: 'success',
      data: videos,
      count: videos.length,
    });
  } catch (error) {
    console.error('Get all videos error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch demo videos',
      error: error.message,
    });
  }
};

// @desc    Get single demo video by ID
// @route   GET /api/admin/demo-videos/:id
// @access  Private/Admin
export const getVideoById = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await videoModel.findById(id);

    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: video,
    });
  } catch (error) {
    console.error('Get video by ID error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch video',
      error: error.message,
    });
  }
};

// @desc    Create new demo video
// @route   POST /api/admin/demo-videos
// @access  Private/Admin
export const createVideo = async (req, res) => {
  try {
    const { title, description, videoUrl, targetAudience } = req.body;

    // Validation
    if (!title || !videoUrl || !targetAudience) {
      return res.status(400).json({
        status: 'error',
        message: 'Title, video URL, and target audience are required',
      });
    }

    if (!['customers', 'shops'].includes(targetAudience)) {
      return res.status(400).json({
        status: 'error',
        message: 'Target audience must be either "customers" or "shops"',
      });
    }

    // Create video
    const video = await videoModel.create({
      title: title.trim(),
      description: description?.trim() || '',
      videoUrl: videoUrl.trim(),
      targetAudience,
    });

    res.status(201).json({
      status: 'success',
      message: 'Demo video created successfully',
      data: video,
    });
  } catch (error) {
    console.error('Create video error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        status: 'error',
        message: messages.join(', '),
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to create demo video',
      error: error.message,
    });
  }
};

// @desc    Update demo video
// @route   PUT /api/admin/demo-videos/:id
// @access  Private/Admin
export const updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, videoUrl, targetAudience, isActive } = req.body;

    const video = await videoModel.findById(id);

    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found',
      });
    }

    // Update fields
    if (title !== undefined) video.title = title.trim();
    if (description !== undefined) video.description = description.trim();
    if (videoUrl !== undefined) video.videoUrl = videoUrl.trim();
    if (targetAudience !== undefined) {
      if (!['customers', 'shops'].includes(targetAudience)) {
        return res.status(400).json({
          status: 'error',
          message: 'Target audience must be either "customers" or "shops"',
        });
      }
      video.targetAudience = targetAudience;
    }
    if (isActive !== undefined) video.isActive = isActive;

    await video.save();

    res.status(200).json({
      status: 'success',
      message: 'Demo video updated successfully',
      data: video,
    });
  } catch (error) {
    console.error('Update video error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        status: 'error',
        message: messages.join(', '),
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to update demo video',
      error: error.message,
    });
  }
};

// @desc    Delete demo video
// @route   DELETE /api/admin/demo-videos/:id
// @access  Private/Admin
export const deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await videoModel.findById(id);

    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found',
      });
    }

    await video.deleteOne();

    res.status(200).json({
      status: 'success',
      message: 'Demo video deleted successfully',
      data: { id },
    });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete demo video',
      error: error.message,
    });
  }
};

// @desc    Toggle video active status
// @route   PATCH /api/admin/demo-videos/:id/toggle-active
// @access  Private/Admin
export const toggleVideoActive = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await videoModel.findById(id);

    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found',
      });
    }

    video.isActive = !video.isActive;
    await video.save();

    res.status(200).json({
      status: 'success',
      message: `Video ${video.isActive ? 'activated' : 'deactivated'} successfully`,
      data: video,
    });
  } catch (error) {
    console.error('Toggle video active error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to toggle video status',
      error: error.message,
    });
  }
};

// @desc    Get videos by target audience (Public endpoint for frontend)
// @route   GET /api/demo-videos/:audience
// @access  Public
export const getVideosByAudience = async (req, res) => {
  try {
    const { audience } = req.params;

    if (!['customers', 'shops'].includes(audience)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid audience type. Must be "customers" or "shops"',
      });
    }

    const videos = await videoModel.find({
      targetAudience: audience,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .select('-__v')
      .lean();
    

    res.status(200).json({
      status: 'success',
      data: videos,
      count: videos.length,
    });
  } catch (error) {
    console.error('Get videos by audience error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch demo videos',
      error: error.message,
    });
  }
};

// @desc    Increment video view count
// @route   POST /api/demo-videos/:id/view
// @access  Public
export const incrementVideoView = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await videoModel.findById(id);

    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found',
      });
    }

    await video.incrementViews();

    res.status(200).json({
      status: 'success',
      message: 'View count updated',
      data: { views: video.views },
    });
  } catch (error) {
    console.error('Increment view error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update view count',
      error: error.message,
    });
  }
};


