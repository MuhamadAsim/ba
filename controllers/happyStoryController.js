import Story from '../models/happyStoriesModel.js';
import asyncHandler from 'express-async-handler';




// @desc    Get all stories
// @route   GET /api/stories
// @access  Public
export const getAllStories = asyncHandler(async (req, res) => {
  const { active, limit, page, isBillboard, type } = req.query;

  // Build query
  let query = {};
  
  // Filter by active status if specified
  if (active !== undefined) {
    query.isActive = active === 'true';
  } else {
    // Default to active stories only for public access
    query.isActive = true;
  }

  // Handle isBillboard filtering
  if (isBillboard !== undefined) {
    const isBillboardBool = isBillboard === 'true';
    query.isBillboard = isBillboardBool;
  }

  // Filter by type
  if (type === 'story') {
    query.isBillboard = false;
  } else if (type === 'billboard') {
    query.isBillboard = true;
  }

  // Pagination
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const skip = (pageNum - 1) * limitNum;

  try {
    // Execute query
    const stories = await Story.find(query)
      .sort({ order: 1, createdAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .select('-__v');

    // Get total count for pagination
    const total = await Story.countDocuments(query);

    res.status(200).json({
      success: true,
      count: stories.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: stories
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Database error',
      error: error.message
    });
  }
});


// @desc    Get single story by ID
// @route   GET /api/stories/:id
// @access  Public
export const getStoryById = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id);

  if (!story) {
    res.status(404);
    throw new Error('Story not found');
  }

  res.status(200).json({
    success: true,
    data: story
  });
});




// @desc    Create new story
// @route   POST /api/stories
// @access  Private/Admin
export const createStory = asyncHandler(async (req, res) => {
  const { 
    name, 
    rating, 
    story, 
    carModel, 
    wrapType, 
    isFeatured, 
    isApproved, 
    verifiedPurchase,
    isBillboard,
    isActive  // ADDED: Get isActive from request body
  } = req.body;

  // Parse isBillboard flag
  const isBillboardFlag = isBillboard === 'true' || isBillboard === true;
  
  // Parse isActive flag - default to true if not provided
  const isActiveFlag = isActive !== undefined 
    ? (isActive === 'true' || isActive === true)
    : true;

  // Validation - adjust based on whether it's a story or billboard
  if (!name) {
    // Clean up uploaded file if validation fails
    if (req.file && req.file.path) {
      // Cloudinary cleanup would go here
    }
    res.status(400);
    throw new Error('Please provide name');
  }

  // For stories (not billboards), require story text
  if (!isBillboardFlag && !story) {
    res.status(400);
    throw new Error('Story text is required for customer stories');
  }

  // Handle rating - for billboards, default to 1 if not provided
  let ratingNum = 5; // Default for stories
  if (isBillboardFlag) {
    ratingNum = 1; // Default for billboards
  }
  
  // If rating is provided, validate it
  if (rating) {
    ratingNum = Number(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400);
      throw new Error('Rating must be a number between 1 and 5');
    }
  }

  // Handle image - either from file upload or from body
  let imageUrl = '';
  if (req.file) {
    imageUrl = req.file.path;
  } else if (req.body.image) {
    imageUrl = req.body.image;
  } else {
    res.status(400);
    throw new Error('Image is required. Either upload a file or provide an image URL');
  }

  // Create story
  const newStory = await Story.create({
    name,
    rating: ratingNum,
    story: story || '', // For billboards, story can be empty
    image: imageUrl,
    carModel: carModel || '',
    wrapType: wrapType || '',
    isFeatured: isFeatured === 'true' || isFeatured === true,
    isApproved: isApproved !== 'false' && isApproved !== false,
    verifiedPurchase: verifiedPurchase === 'true' || verifiedPurchase === true,
    order: req.body.order || 0,
    isBillboard: isBillboardFlag,
    isActive: isActiveFlag  // ADDED: Save the isActive status
  });

  res.status(201).json({
    success: true,
    message: isBillboardFlag ? 'Billboard created successfully' : 'Story created successfully',
    data: newStory
  });
});










// @desc    Update story
// @route   PUT /api/stories/:id
// @access  Private/Admin
export const updateStory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    rating, 
    story, 
    carModel, 
    wrapType, 
    isFeatured, 
    isApproved, 
    verifiedPurchase,
    isBillboard,
    isActive  // ADDED: Get isActive from request body
  } = req.body;

  const storyToUpdate = await Story.findById(id);
  if (!storyToUpdate) {
    res.status(404);
    throw new Error('Story not found');
  }

  // Parse isBillboard flag if provided
  const isBillboardFlag = isBillboard !== undefined 
    ? (isBillboard === 'true' || isBillboard === true)
    : storyToUpdate.isBillboard;
    
  // Parse isActive flag if provided
  const isActiveFlag = isActive !== undefined 
    ? (isActive === 'true' || isActive === true)
    : storyToUpdate.isActive;

  // For stories (not billboards), require story text if provided
  if (!isBillboardFlag && story === '') {
    res.status(400);
    throw new Error('Story text is required for customer stories');
  }

  // Handle rating
  let ratingNum = storyToUpdate.rating;
  if (rating) {
    ratingNum = Number(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400);
      throw new Error('Rating must be a number between 1 and 5');
    }
  }

  // Handle image update
  let imageUrl = storyToUpdate.image;
  if (req.file) {
    imageUrl = req.file.path;
    // Optional: Delete old image from Cloudinary
  } else if (req.body.image) {
    imageUrl = req.body.image;
  }

  // Update story
  const updatedStory = await Story.findByIdAndUpdate(
    id,
    {
      name: name || storyToUpdate.name,
      rating: ratingNum,
      story: story !== undefined ? story : storyToUpdate.story,
      image: imageUrl,
      carModel: carModel !== undefined ? carModel : storyToUpdate.carModel,
      wrapType: wrapType !== undefined ? wrapType : storyToUpdate.wrapType,
      isFeatured: isFeatured !== undefined ? (isFeatured === 'true' || isFeatured === true) : storyToUpdate.isFeatured,
      isApproved: isApproved !== undefined ? (isApproved === 'true' || isApproved === true) : storyToUpdate.isApproved,
      verifiedPurchase: verifiedPurchase !== undefined ? (verifiedPurchase === 'true' || verifiedPurchase === true) : storyToUpdate.verifiedPurchase,
      isBillboard: isBillboardFlag,
      isActive: isActiveFlag  // ADDED: Update the isActive status
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: isBillboardFlag ? 'Billboard updated successfully' : 'Story updated successfully',
    data: updatedStory
  });
});







// @desc    Delete story
// @route   DELETE /api/stories/:id
// @access  Private/Admin
export const deleteStory = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id);

  if (!story) {
    res.status(404);
    throw new Error('Story not found');
  }

  await story.deleteOne();

  res.status(200).json({
    success: true,
    message: story.isBillboard ? 'Billboard deleted successfully' : 'Story deleted successfully',
    data: {}
  });
});

// @desc    Soft delete story (set isActive to false)
// @route   PATCH /api/stories/:id/deactivate
// @access  Private/Admin
export const deactivateStory = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id);

  if (!story) {
    res.status(404);
    throw new Error('Story not found');
  }

  story.isActive = false;
  await story.save();

  res.status(200).json({
    success: true,
    message: story.isBillboard ? 'Billboard deactivated successfully' : 'Story deactivated successfully',
    data: story
  });
});


// @desc    Activate story (set isActive to true)
// @route   PATCH /api/stories/:id/activate
// @access  Private/Admin
export const activateStory = asyncHandler(async (req, res) => {
  const story = await Story.findById(req.params.id);

  if (!story) {
    res.status(404);
    throw new Error('Story not found');
  }

  story.isActive = true;
  await story.save();

  res.status(200).json({
    success: true,
    message: story.isBillboard ? 'Billboard activated successfully' : 'Story activated successfully',
    data: story
  });
});



// @desc    Bulk update story order
// @route   PATCH /api/stories/reorder
// @access  Private/Admin
export const reorderStories = asyncHandler(async (req, res) => {
  const { stories } = req.body;

  if (!stories || !Array.isArray(stories)) {
    res.status(400);
    throw new Error('Please provide an array of stories with id and order');
  }

  // Update each story's order
  const updatePromises = stories.map(({ id, order }) =>
    Story.findByIdAndUpdate(id, { order }, { new: true })
  );

  await Promise.all(updatePromises);

  res.status(200).json({
    success: true,
    message: 'Stories reordered successfully'
  });
});

// @desc    Get only stories (not billboards)
// @route   GET /api/stories/type/stories
// @access  Public
export const getStoriesOnly = asyncHandler(async (req, res) => {
  const { active, limit, page } = req.query;

  // Build query
  let query = { isBillboard: false };
  
  // Filter by active status if specified
  if (active !== undefined) {
    query.isActive = active === 'true';
  } else {
    // Default to active stories only for public access
    query.isActive = true;
  }

  // Pagination
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const skip = (pageNum - 1) * limitNum;

  // Execute query
  const stories = await Story.find(query)
    .sort({ order: 1, createdAt: -1 })
    .limit(limitNum)
    .skip(skip)
    .select('-__v');

  // Get total count for pagination
  const total = await Story.countDocuments(query);

  res.status(200).json({
    success: true,
    count: stories.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    data: stories
  });
});

// @desc    Get only billboards
// @route   GET /api/stories/type/billboards
// @access  Public
export const getBillboardsOnly = asyncHandler(async (req, res) => {
  const { active, limit, page } = req.query;

  // Build query
  let query = { isBillboard: true };
  
  // Filter by active status if specified
  if (active !== undefined) {
    query.isActive = active === 'true';
  } else {
    // Default to active billboards only for public access
    query.isActive = true;
  }

  // Pagination
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const skip = (pageNum - 1) * limitNum;

  // Execute query
  const billboards = await Story.find(query)
    .sort({ order: 1, createdAt: -1 })
    .limit(limitNum)
    .skip(skip)
    .select('-__v');

  // Get total count for pagination
  const total = await Story.countDocuments(query);

  res.status(200).json({
    success: true,
    count: billboards.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    data: billboards
  });
});









// @desc    Get all stories for admin (includes active and inactive)
// @route   GET /api/admin/happy-stories
// @access  Private/Admin
export const getAllStoriesAdmin = asyncHandler(async (req, res) => {
  const { limit, page, isBillboard, type } = req.query;

  // Build query - NO isActive filter for admin
  let query = {};

  // Handle isBillboard filtering
  if (isBillboard !== undefined) {
    const isBillboardBool = isBillboard === 'true';
    query.isBillboard = isBillboardBool;
  }

  // Filter by type
  if (type === 'story') {
    query.isBillboard = false;
  } else if (type === 'billboard') {
    query.isBillboard = true;
  }

  // Pagination
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const skip = (pageNum - 1) * limitNum;

  try {
    // Execute query - NO isActive filter, gets ALL
    const stories = await Story.find(query)
      .sort({ order: 1, createdAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .select('-__v');

    // Get total count for pagination
    const total = await Story.countDocuments(query);

    res.status(200).json({
      success: true,
      count: stories.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: stories
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Database error',
      error: error.message
    });
  }
});