
// ============================================
// FILE: src/controllers/blogController.js
// ============================================
import Blog from "../models/blogModel.js";
import Event from "../models/eventModel.js";

// @desc    Upload blog image to Cloudinary
// @route   POST /api/blogs/upload-image
// @access  Admin
export const uploadBlogImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "No image file provided",
      });
    }

    // Cloudinary URL from multer upload
    const imageUrl = req.file.path;

    return res.status(200).json({
      status: "success",
      message: "Image uploaded successfully",
      data: {
        imageUrl,
      },
    });
  } catch (error) {
    console.error("❌ Error uploading blog image:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error while uploading image",
      error: error.message,
    });
  }
};

// @desc    Create a new blog post
// @route   POST /api/blogs
// @access  Admin
export const createBlog = async (req, res) => {
  try {
    const { title, content, author, imageUrl, tags } = req.body;

    // Validate required fields
    if (!title || !content || !author) {
      return res.status(400).json({
        status: "error",
        message: "Title, content, and author are required",
      });
    }

    // Create new blog
    const newBlog = new Blog({
      title,
      content,
      author,
      imageUrl: imageUrl || "",
      tags: tags || [],
    });

    await newBlog.save();

    // Save event asynchronously - Fixed to use req.admin instead of req.user
    Event.create({
      customerId: req.admin?.id || null,  // ✅ Use req.admin.id (set by authenticateAdmin middleware)
      shopId: null,
      bidId: null,
      type: "blog-created",
      title: "New Blog Post Created",
      message: `A new blog post titled "${title}" has been created by ${author}.`,
    }).catch((err) => {
      console.error("Failed to save event:", err);
    });

    return res.status(201).json({
      status: "success",
      message: "Blog post created successfully",
      data: newBlog,
    });
  } catch (error) {
    console.error("❌ Error creating blog:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error while creating blog post",
      error: error.message,
    });
  }
};

// // @desc    Get all blog posts
// // @route   GET /api/blogs
// // @access  Public
// export const getAllBlogs = async (req, res) => {
//   try {
//     const { status, tag, limit, page } = req.query;

//     // Build query
//     const query = {};
    
//     // Filter by status (default to published for public access)
//     if (status) {
//       query.status = status;
//     } else {
//       // If not admin, only show published blogs
//       if (!req.user || req.user.role !== "admin") {
//         query.status = "published";
//       }
//     }

//     // Filter by tag
//     if (tag) {
//       query.tags = { $in: [tag] };
//     }

//     // Pagination
//     const pageNum = parseInt(page) || 1;
//     const limitNum = parseInt(limit) || 10;
//     const skip = (pageNum - 1) * limitNum;

//     const blogs = await Blog.find(query)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limitNum);

//     const total = await Blog.countDocuments(query);

//     return res.status(200).json({
//       status: "success",
//       data: blogs,
//       pagination: {
//         total,
//         page: pageNum,
//         pages: Math.ceil(total / limitNum),
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error fetching blogs:", error);
//     return res.status(500).json({
//       status: "error",
//       message: "Server error while fetching blogs",
//       error: error.message,
//     });
//   }
// };





export const getAllBlogs = async (req, res) => {
  try {
    const { status, tag, limit = 10, page = 1, search } = req.query;

    // Build query
    const query = {};
    
    // Filter by status (default to published for public access)
    if (status) {
      query.status = status;
    } else {
      // If not admin, only show published blogs
      if (!req.user || req.user.role !== "admin") {
        query.status = "published";
      }
    }

    // Filter by tag
    if (tag) {
      query.tags = { $in: [tag] };
    }

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } }
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await Blog.countDocuments(query);

    // Get blogs with pagination
    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Add isLiked field for authenticated users
    const blogsWithLikeStatus = blogs.map(blog => {
      const blogObj = { ...blog };
      
      if (req.user) {
        // Check if current user has liked this blog
        // Convert likedBy to string for comparison
        const likedByStrings = blog.likedBy ? blog.likedBy.map(id => id.toString()) : [];
        blogObj.isLiked = likedByStrings.includes(req.user._id.toString());
      } else {
        blogObj.isLiked = false;
      }
      
      return blogObj;
    });

    return res.status(200).json({
      success: true,
      data: blogsWithLikeStatus,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching blogs:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching blogs",
      error: error.message,
    });
  }
};


// @desc    Get single blog post by ID
// @route   GET /api/blogs/:id
// @access  Public
export const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id).lean();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    // Add isLiked field for authenticated users
    let blogWithLikeStatus = { ...blog };
    
    if (req.user) {
      const likedByStrings = blog.likedBy ? blog.likedBy.map(id => id.toString()) : [];
      blogWithLikeStatus.isLiked = likedByStrings.includes(req.user._id.toString());
    } else {
      blogWithLikeStatus.isLiked = false;
    }

    return res.status(200).json({
      success: true,
      data: blogWithLikeStatus,
    });
  } catch (error) {
    console.error("❌ Error fetching blog:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching blog post",
      error: error.message,
    });
  }
};

// @desc    Update blog post
// @route   PUT /api/blogs/:id
// @access  Admin
export const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, author, imageUrl, tags, status } = req.body;

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        status: "error",
        message: "Blog post not found",
      });
    }

    // Update fields
    if (title) blog.title = title;
    if (content) blog.content = content;
    if (author) blog.author = author;
    if (imageUrl !== undefined) blog.imageUrl = imageUrl;
    if (tags) blog.tags = tags;
    if (status) blog.status = status;

    await blog.save();

    return res.status(200).json({
      status: "success",
      message: "Blog post updated successfully",
      data: blog,
    });
  } catch (error) {
    console.error("❌ Error updating blog:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error while updating blog post",
      error: error.message,
    });
  }
};

// @desc    Delete blog post
// @route   DELETE /api/blogs/:id
// @access  Admin
export const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        status: "error",
        message: "Blog post not found",
      });
    }

    await Blog.findByIdAndDelete(id);

    return res.status(200).json({
      status: "success",
      message: "Blog post deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting blog:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error while deleting blog post",
      error: error.message,
    });
  }
};

// @desc    Like/Unlike a blog post
// @route   POST /api/blogs/:id/like
// @access  Protected
// @desc    Increment blog view count
// @route   POST /api/blogs/:id/view
// @access  Public
export const incrementViewCount = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    ).lean();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "View count incremented",
      data: {
        views: blog.views,
      },
    });
  } catch (error) {
    console.error("❌ Error incrementing view count:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while incrementing view count",
      error: error.message,
    });
  }
};

// @desc    Like/Unlike a blog post
// @route   POST /api/blogs/:id/like
// @access  Private
export const likeBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userModel = req.user.model || "Customer"; // Assuming your user model has a 'model' field

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    // Check if user already liked the blog
    const userIndex = blog.likedBy.findIndex(
      (likeId) => likeId.toString() === userId.toString()
    );

    let isLiked;
    
    if (userIndex > -1) {
      // Unlike: Remove user from likedBy array
      blog.likedBy.splice(userIndex, 1);
      blog.likes = Math.max(0, blog.likes - 1);
      isLiked = false;
    } else {
      // Like: Add user to likedBy array
      blog.likedBy.push(userId);
      blog.likes += 1;
      isLiked = true;
    }

    await blog.save();

    return res.status(200).json({
      success: true,
      message: isLiked ? "Blog liked successfully" : "Blog unliked successfully",
      data: {
        likes: blog.likes,
        isLiked,
      },
    });
  } catch (error) {
    console.error("❌ Error liking blog:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while liking blog post",
      error: error.message,
    });
  }
};