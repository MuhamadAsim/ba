import Chat from "../models/chatRoomModel.js";
import Customer from "../models/customerModel.js";
import Shop from "../models/shopModel.js";
import Offer from "../models/offerModel.js";
import Bid from "../models/bidModel.js";
import cloudinary from 'cloudinary';

// ==================== SEARCH SHOPS ====================
export const searchShops = async (req, res) => {
  try {
    console.log("🔍 Search request received:", {
      query: req.query.q,
      limit: req.query.limit,
      page: req.query.page,
      timestamp: new Date().toISOString()
    });

    const q = (req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 10, 50); // Max 50 results per page
    const page = Math.max(Number(req.query.page) || 1, 1);

    // Validate inputs
    if (q.length < 2) {
      return res.json({
        shops: [],
        total: 0,
        page: page,
        totalPages: 0,
        hasMore: false,
        message: q.length === 0 ?
          "Enter a search term to find shops" :
          "Search term must be at least 2 characters"
      });
    }

    // Validate limit
    if (limit < 1 || limit > 50) {
      return res.status(400).json({
        error: "Limit must be between 1 and 50",
        shops: [],
        total: 0
      });
    }

    // Validate page
    if (page < 1) {
      return res.status(400).json({
        error: "Page number must be at least 1",
        shops: [],
        total: 0
      });
    }

    const searchRegex = new RegExp(q, "i");

    // Expanded search fields for better results
    const filter = {
      status: "active",
      isBlocked: false,
      $or: [
        { businessName: searchRegex },
        { ownerName: searchRegex },
        { services: { $regex: searchRegex } }, // Search within services array
        { "services.serviceName": searchRegex }, // If services is an array of objects
        { category: searchRegex },
        { description: searchRegex },
        { country: searchRegex },
        { city: searchRegex },
        { address: searchRegex },
        { zipCode: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { tags: searchRegex }, // If you have tags field
      ],
    };

    const skip = (page - 1) * limit;

    const [shops, total] = await Promise.all([
      Shop.find(filter)
        .select("businessName ownerName profilePic avatar address services category description rating reviewCount createdAt")
        .sort({ rating: -1, reviewCount: -1, createdAt: -1 }) // Sort by rating, then reviews, then newest
        .limit(limit)
        .skip(skip)
        .lean(),
      Shop.countDocuments(filter),
    ]);

    // Format the response with additional info
    const result = {
      shops: shops.map(shop => ({
        _id: shop._id,
        businessName: shop.businessName,
        ownerName: shop.ownerName,
        avatar: shop.profilePic || shop.avatar,
        description: shop.description,
        category: shop.category,
        services: shop.services || [],
        address: shop.address,
        rating: shop.rating || 0,
        reviewCount: shop.reviewCount || 0,
        createdAt: shop.createdAt
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: total > skip + shops.length,
      searchTerm: q,
      message: total === 0 ?
        `No shops found for "${q}"` :
        `Found ${total} shop${total !== 1 ? 's' : ''} matching "${q}"`
    };

    res.json(result);

  } catch (err) {
    console.error("❌ Search error:", {
      error: err.message,
      stack: err.stack,
      query: req.query,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      error: "Search failed due to server error",
      shops: [],
      total: 0,
      page: 1,
      totalPages: 0,
      hasMore: false,
      message: "An error occurred while searching. Please try again."
    });
  }
};
// controllers/chatController.js - uploadChatImage function
export const uploadChatImage = async (req, res) => {
  try {
    const { chatId } = req.body;
    const userRole = req.user.role;
    const userId = req.user._id.toString();

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    if (!chatId) {
      return res.status(400).json({ error: "Chat ID is required" });
    }

    // ----- VALIDATE CHAT ACCESS -----
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Check if user is a participant in this chat
    let isParticipant = false;

    if (userRole === "customer") {
      isParticipant = (chat.customerId.toString() === userId && chat.customerModel === "Customer");
    } else if (userRole === "shop") {
      if (chat.isShopToShop) {
        // For shop-to-shop, user can be either shopId or customerId
        isParticipant = (chat.shopId.toString() === userId ||
          (chat.customerId.toString() === userId && chat.customerModel === "Shop"));
      } else {
        // Regular customer-shop chat
        isParticipant = (chat.shopId.toString() === userId);
      }
    }

    if (!isParticipant) {
      return res.status(403).json({ error: "You are not a participant in this chat" });
    }

    // ----- GET FILE INFORMATION -----
    // Cloudinary storage returns file info in different structure
    // Check different possible locations for the public_id
    const publicId = req.file.public_id ||
      req.file.filename ||
      req.file.originalname.split('.')[0];

    const fileUrl = req.file.path ||
      req.file.url ||
      req.file.secure_url;

    const fileSize = req.file.size || 0;

    if (!publicId || !fileUrl) {
      console.error("Missing Cloudinary data:", req.file);
      return res.status(500).json({ error: "Failed to process uploaded image" });
    }

    // Try to get image info, but don't fail if we can't
    let imageInfo = { width: null, height: null };
    try {
      // Use the correct public_id format (remove folder path if present)
      const cleanPublicId = publicId.replace(/^chat-images\//, '');
      const resource = await cloudinary.v2.api.resource(cleanPublicId, {
        resource_type: 'image'
      });
      imageInfo.width = resource.width;
      imageInfo.height = resource.height;
    } catch (cloudinaryError) {
      console.warn("Could not get image dimensions from Cloudinary:", cloudinaryError.message);
      // Continue without dimensions - not critical
    }

    // Create image data object for response
    const imageData = {
      url: fileUrl,
      publicId: publicId,
      fileName: req.file.originalname || `image-${Date.now()}`,
      fileSize: fileSize,
      fileType: req.file.mimetype,
      width: imageInfo.width,
      height: imageInfo.height,
      thumbnailUrl: cloudinary.url(publicId, {
        width: 300,
        height: 300,
        crop: "fill",
        quality: "auto",
        format: "webp"
      }),
      uploadedAt: new Date()
    };

    // Return success response
    res.status(200).json({
      success: true,
      image: imageData,
      message: "Image uploaded successfully"
    });

  } catch (error) {
    console.error("Error uploading chat image:", error);

    // Handle specific errors
    if (error.message.includes("Invalid file type")) {
      return res.status(400).json({ error: error.message });
    }

    if (error.message.includes("File too large")) {
      return res.status(400).json({ error: "File size exceeds 5MB limit" });
    }

    res.status(500).json({ error: "Failed to upload image" });
  }
};

// ==================== DELETE CHAT IMAGE ====================
export const deleteChatImage = async (req, res) => {
  try {
    const { publicId, chatId } = req.body;
    const userRole = req.user.role;
    const userId = req.user._id.toString();

    if (!publicId || !chatId) {
      return res.status(400).json({ error: "Public ID and Chat ID are required" });
    }

    // ----- VALIDATE CHAT ACCESS -----
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Check if user is a participant in this chat
    let isParticipant = false;

    if (userRole === "customer") {
      isParticipant = (chat.customerId.toString() === userId && chat.customerModel === "Customer");
    } else if (userRole === "shop") {
      if (chat.isShopToShop) {
        isParticipant = (chat.shopId.toString() === userId ||
          (chat.customerId.toString() === userId && chat.customerModel === "Shop"));
      } else {
        isParticipant = (chat.shopId.toString() === userId);
      }
    }

    if (!isParticipant) {
      return res.status(403).json({ error: "You are not a participant in this chat" });
    }

    // Check if image is in use in any message
    const isImageInUse = chat.messages.some(message =>
      message.images && message.images.some(img => img.publicId === publicId)
    );

    if (isImageInUse) {
      return res.status(400).json({
        error: "Cannot delete image that is being used in a message"
      });
    }

    // Delete from Cloudinary
    try {
      const result = await cloudinary.v2.uploader.destroy(publicId);
      if (result.result !== "ok") {
        return res.status(400).json({ error: "Failed to delete image from Cloudinary" });
      }
    } catch (cloudinaryError) {
      console.error("Cloudinary delete error:", cloudinaryError);
      return res.status(500).json({ error: "Error deleting image from Cloudinary" });
    }

    res.status(200).json({
      success: true,
      message: "Image deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting chat image:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
};

// ==================== GET CHAT IMAGES ====================
export const getChatImages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userRole = req.user.role;
    const userId = req.user._id.toString();

    // ----- VALIDATE CHAT ACCESS -----
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Check if user is a participant in this chat
    let isParticipant = false;

    if (userRole === "customer") {
      isParticipant = (chat.customerId.toString() === userId && chat.customerModel === "Customer");
    } else if (userRole === "shop") {
      if (chat.isShopToShop) {
        isParticipant = (chat.shopId.toString() === userId ||
          (chat.customerId.toString() === userId && chat.customerModel === "Shop"));
      } else {
        isParticipant = (chat.shopId.toString() === userId);
      }
    }

    if (!isParticipant) {
      return res.status(403).json({ error: "You are not a participant in this chat" });
    }

    // Collect all images from messages
    const allImages = [];

    chat.messages.forEach(message => {
      if (message.images && message.images.length > 0) {
        message.images.forEach(image => {
          allImages.push({
            ...image.toObject(),
            messageId: message._id,
            senderId: message.senderId,
            senderType: message.senderType,
            senderName: message.senderName,
            createdAt: message.createdAt
          });
        });
      }
    });

    // Sort by creation date (newest first)
    allImages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      images: allImages,
      total: allImages.length
    });

  } catch (error) {
    console.error("Error fetching chat images:", error);
    res.status(500).json({ error: "Failed to fetch chat images" });
  }
};

// ==================== GET OR CREATE CHAT ====================
export const getOrCreateChat = async (req, res) => {
  try {
    const {
      customerId,
      shopId,
      offerId,
      bidId,
      counterOfferId,
      isShopToShop = false
    } = req.body;

    const userRole = req.user.role;
    const userId = req.user._id.toString();

    // ----- VALIDATE INPUT -----
    if (!customerId || !shopId) {
      return res.status(400).json({ error: "customerId and shopId are required" });
    }

    // For shop-to-shop chats, customerId is the other shop's ID
    let customerModel = "Customer";
    let shopModel = "Shop";

    if (isShopToShop) {
      customerModel = "Shop"; // The "customer" in this case is another shop

      // Verify the other shop exists
      const otherShop = await Shop.findById(customerId);
      if (!otherShop) {
        return res.status(404).json({ error: "Shop not found" });
      }
    }

    // ----- AUTH CHECK -----
    if (userRole === "customer" && userId !== customerId) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    if (userRole === "shop") {
      // For shop-to-shop, current shop must be either the shopId OR the customerId (if they initiated)
      if (isShopToShop) {
        // Shop can be either the main shop or the "customer" shop in shop-to-shop chat
        if (userId !== shopId && userId !== customerId) {
          return res.status(403).json({ error: "Unauthorized access" });
        }
      } else {
        // Regular customer-shop chat
        if (userId !== shopId) {
          return res.status(403).json({ error: "Unauthorized access" });
        }
      }
    }

    if (!isShopToShop && customerId === shopId) {
      return res.status(400).json({ error: "Invalid chat participants" });
    }

    // For shop-to-shop, both IDs should be different shops
    if (isShopToShop && customerId === shopId) {
      return res.status(400).json({ error: "Cannot create chat with yourself" });
    }

    // ----- CHECK IF CHAT EXISTS -----
    let chat = await Chat.findOne({
      customerId,
      shopId,
      isShopToShop,
      customerModel
    });

    if (chat) {
      // Add new reference to existing chat if provided
      if (offerId && !chat.relatedOffers.includes(offerId)) {
        chat.relatedOffers.push(offerId);
        await chat.save();
      }
      if (bidId && !chat.relatedBids.includes(bidId)) {
        chat.relatedBids.push(bidId);
        await chat.save();
      }
      if (counterOfferId && !chat.relatedCounterOffers.includes(counterOfferId)) {
        chat.relatedCounterOffers.push(counterOfferId);
        await chat.save();
      }

      return res.status(200).json(chat);
    }

    // ----- GET PARTICIPANT DETAILS -----
    let customer = null;
    let shop = null;

    if (isShopToShop) {
      // For shop-to-shop, customer is actually another shop
      customer = await Shop.findById(customerId).select("businessName email profilePic");
    } else {
      // Regular customer
      customer = await Customer.findById(customerId).select("name email avatar");
    }

    shop = await Shop.findById(shopId).select("businessName email profilePic");

    if (!customer || !shop) {
      return res.status(404).json({ error: "Participant not found" });
    }

    // ----- CREATE CHAT -----
    chat = await Chat.create({
      customerId,
      customerModel,
      shopId,
      isShopToShop,

      // Initialize related arrays
      relatedOffers: offerId ? [offerId] : [],
      relatedBids: bidId ? [bidId] : [],
      relatedCounterOffers: counterOfferId ? [counterOfferId] : [],

      // Customer Fields (could be Customer or Shop)
      customerName: isShopToShop ? customer.businessName : customer.name,
      customerAvatar: isShopToShop ? customer.profilePic : customer.avatar,

      // Shop Fields
      shopName: shop.businessName,
      shopAvatar: shop.profilePic,

      // Defaults
      messages: [],
      unreadCountCustomer: 0,
      unreadCountShop: 0,
    });

    res.status(201).json(chat);
  } catch (error) {
    console.error("Error in getOrCreateChat:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET CHAT CONTEXT DATA ====================
export const getChatContext = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Verify authorization
    const isCustomer = chat.customerId.toString() === userId.toString();
    const isShop = chat.shopId.toString() === userId.toString();

    if (!isCustomer && !isShop) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const contextData = {
      offers: [],
      bids: [],
      counterOffers: [],
    };

    // ----- FETCH ALL RELATED OFFERS -----
    if (chat.relatedOffers && chat.relatedOffers.length > 0) {
      try {
        const offers = await Offer.find({
          _id: { $in: chat.relatedOffers }
        }).select("price description status createdAt");

        contextData.offers = offers.map(offer => ({
          _id: offer._id,
          price: offer.price,
          description: offer.description,
          status: offer.status,
          createdAt: offer.createdAt,
        }));
      } catch (err) {
        console.error("Error fetching offers:", err);
      }
    }

    // ----- FETCH ALL RELATED BIDS -----
    if (chat.relatedBids && chat.relatedBids.length > 0) {
      try {
        const bids = await Bid.find({
          _id: { $in: chat.relatedBids }
        }).select("serviceDescription requestCategory vehicleYear vehicleMake vehicleModel createdAt");

        contextData.bids = bids.map(bid => {
          const vehicle = [bid.vehicleYear, bid.vehicleMake, bid.vehicleModel]
            .filter(Boolean)
            .join(" ");
          return {
            _id: bid._id,
            service: bid.serviceDescription || bid.requestCategory,
            vehicle: vehicle || "Vehicle information not provided",
            createdAt: bid.createdAt,
          };
        });
      } catch (err) {
        console.error("Error fetching bids:", err);
      }
    }

    // ----- FETCH ALL RELATED COUNTER OFFERS -----
    if (chat.relatedCounterOffers && chat.relatedCounterOffers.length > 0) {
      try {
        const offers = await Offer.find({
          "counterOffers._id": { $in: chat.relatedCounterOffers }
        });

        offers.forEach(offer => {
          offer.counterOffers.forEach(co => {
            if (chat.relatedCounterOffers.some(id => id.toString() === co._id.toString())) {
              contextData.counterOffers.push({
                _id: co._id,
                proposedPrice: co.counterPrice,
                message: co.message,
                status: co.status,
                createdBy: co.createdBy,
                createdAt: co.createdAt,
              });
            }
          });
        });
      } catch (err) {
        console.error("Error fetching counter offers:", err);
      }
    }

    res.status(200).json(contextData);
  } catch (error) {
    console.error("Error in getChatContext:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET MESSAGES WITH PAGINATION ====================
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Get pagination params from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Verify user is part of this chat
    const isCustomer = chat.customerId.toString() === userId.toString();
    const isShop = chat.shopId.toString() === userId.toString();

    if (!isCustomer && !isShop) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Calculate pagination
    const totalMessages = chat.messages.length;
    const totalPages = Math.ceil(totalMessages / limit);
    const skip = (page - 1) * limit;

    // Get messages for this page (most recent first, so we reverse, slice, then reverse back)
    const allMessages = [...chat.messages].reverse(); // newest first
    const paginatedMessages = allMessages.slice(skip, skip + limit).reverse(); // get page, then chronological

    // Mark messages as read for this user
    let unreadCount = 0;
    if (userRole === "customer") {
      chat.messages.forEach((msg) => {
        if (msg.senderType === "shop" && !msg.isRead) {
          msg.isRead = true;
          unreadCount++;
        }
      });
      if (unreadCount > 0) {
        chat.unreadCountCustomer = Math.max(0, chat.unreadCountCustomer - unreadCount);
      }
    } else if (userRole === "shop") {
      chat.messages.forEach((msg) => {
        if (msg.senderType === "customer" && !msg.isRead) {
          msg.isRead = true;
          unreadCount++;
        }
      });
      if (unreadCount > 0) {
        chat.unreadCountShop = Math.max(0, chat.unreadCountShop - unreadCount);
      }
    }

    if (unreadCount > 0) {
      await chat.save();
    }

    res.status(200).json({
      messages: paginatedMessages,
      pagination: {
        currentPage: page,
        totalPages,
        totalMessages,
        hasMore: page < totalPages,
        limit
      }
    });
  } catch (error) {
    console.error("Error in getChatMessages:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== SEND MESSAGE (UPDATED FOR IMAGES) ====================
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text = "", images = [], references = [] } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const userName = req.user.name || req.user.businessName || "User";

    // Validation: At least text or images should be present
    if (!text.trim() && (!images || images.length === 0)) {
      return res.status(400).json({ error: "Message text or images are required" });
    }

    // Validate images array structure
    if (images && images.length > 0) {
      const maxImages = 5;
      if (images.length > maxImages) {
        return res.status(400).json({
          error: `Maximum ${maxImages} images allowed per message`
        });
      }

      // Validate each image object
      for (const image of images) {
        if (!image.url || !image.publicId) {
          return res.status(400).json({
            error: "Each image must have url and publicId"
          });
        }
      }
    }

    // Validate references
    if (references && references.length > 0) {
      for (const ref of references) {
        if (!ref.type || !ref.referenceId) {
          return res.status(400).json({
            error: "Each reference must have type and referenceId"
          });
        }
      }
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Verify user is part of this chat
    const isCustomer = chat.customerId.toString() === userId.toString();
    const isShop = chat.shopId.toString() === userId.toString();

    if (!isCustomer && !isShop) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Determine sender type
    let senderType = userRole;
    let senderName = userName;

    // For shop-to-shop chats, adjust sender type if needed
    if (chat.isShopToShop) {
      if (chat.customerId.toString() === userId.toString() && chat.customerModel === "Shop") {
        senderType = "customer"; // In shop-to-shop, the "customer" is actually another shop
      }
    }

    // Process references and fetch their data
    const processedReferences = [];

    if (references && Array.isArray(references)) {
      for (const ref of references) {
        let refData = {};

        try {
          if (ref.type === "offer") {
            const offer = await Offer.findById(ref.referenceId).select("price description status");
            if (offer) {
              refData = {
                price: offer.price,
                description: offer.description,
                status: offer.status,
              };

              if (!chat.relatedOffers.includes(ref.referenceId)) {
                chat.relatedOffers.push(ref.referenceId);
              }
            }
          } else if (ref.type === "bid") {
            const bid = await Bid.findById(ref.referenceId).select(
              "serviceDescription requestCategory vehicleYear vehicleMake vehicleModel"
            );
            if (bid) {
              const vehicle = [bid.vehicleYear, bid.vehicleMake, bid.vehicleModel]
                .filter(Boolean)
                .join(" ");
              refData = {
                service: bid.serviceDescription || bid.requestCategory,
                vehicle: vehicle || "Vehicle information not provided",
              };

              if (!chat.relatedBids.includes(ref.referenceId)) {
                chat.relatedBids.push(ref.referenceId);
              }
            }
          } else if (ref.type === "counterOffer") {
            const offer = await Offer.findOne({
              "counterOffers._id": ref.referenceId
            });

            if (offer) {
              const counterOffer = offer.counterOffers.find(
                co => co._id.toString() === ref.referenceId.toString()
              );

              if (counterOffer) {
                refData = {
                  proposedPrice: counterOffer.counterPrice,
                  message: counterOffer.message,
                  status: counterOffer.status,
                };

                if (!chat.relatedCounterOffers.includes(ref.referenceId)) {
                  chat.relatedCounterOffers.push(ref.referenceId);
                }
              }
            }
          }

          processedReferences.push({
            type: ref.type,
            referenceId: ref.referenceId,
            data: refData,
          });
        } catch (err) {
          console.error(`Error processing reference ${ref.referenceId}:`, err);
        }
      }
    }

    // Prepare image data
    const imageData = images.map(img => ({
      url: img.url,
      publicId: img.publicId,
      fileName: img.fileName || `image-${Date.now()}`,
      fileSize: img.fileSize || 0,
      fileType: img.fileType || "image/jpeg",
      width: img.width || null,
      height: img.height || null,
      thumbnailUrl: img.thumbnailUrl || null,
      uploadedAt: new Date()
    }));

    // Create message object
    const message = {
      senderId: userId,
      senderType,
      senderName,
      text: text.trim(),
      images: imageData,
      references: processedReferences,
      isRead: false,
      createdAt: new Date(),
    };

    // Add message to chat
    chat.messages.push(message);

    // Update last message info
    if (imageData.length > 0) {
      chat.lastMessage = `📷 ${imageData.length} image${imageData.length > 1 ? 's' : ''}`;
      chat.lastMessageType = "image";
      chat.lastMessageImages = imageData.slice(0, 3).map(img => img.url);
    } else if (references.length > 0) {
      chat.lastMessage = `📎 ${references.length} attachment${references.length > 1 ? 's' : ''}`;
      chat.lastMessageType = "reference";
    } else {
      chat.lastMessage = text.trim();
      chat.lastMessageType = "text";
    }

    chat.lastMessageTime = new Date();
    chat.updatedAt = new Date();

    // Update unread count for the other participant
    if (senderType === "customer") {
      chat.unreadCountShop += 1;
    } else {
      chat.unreadCountCustomer += 1;
    }

    // Save chat to get the message ID
    await chat.save();

    // Get the saved message with its _id
    const savedMessage = chat.messages[chat.messages.length - 1];

    // Emit socket event to other users (not the sender)
    if (req.io) {
      req.io.to(chatId).emit("newMessage", {
        _id: savedMessage._id,
        senderId: savedMessage.senderId,
        senderType: savedMessage.senderType,
        senderName: savedMessage.senderName,
        text: savedMessage.text,
        images: savedMessage.images,
        references: savedMessage.references,
        isRead: savedMessage.isRead,
        createdAt: savedMessage.createdAt,
        chatId,
      });

      req.io.to(chatId).emit("chatUpdated", {
        chatId,
        lastMessage: chat.lastMessage,
        lastMessageTime: chat.lastMessageTime,
        lastMessageType: chat.lastMessageType,
        lastMessageImages: chat.lastMessageImages,
        unreadCountCustomer: chat.unreadCountCustomer,
        unreadCountShop: chat.unreadCountShop
      });
    } else {
      console.warn("⚠️ req.io not available");
    }

    // Return message to sender immediately
    res.status(201).json({
      success: true,
      message: savedMessage,
      chatId,
    });
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ALL CHATS ====================
export const getUserChats = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query;

    if (userRole === "customer") {
      // Customer: only see chats where they are the customer
      query = {
        customerId: userId,
        customerModel: "Customer",
        isActive: true
      };

    } else if (userRole === "shop") {
      // Shop: see all chats involving this shop
      query = {
        $and: [
          { isActive: true },
          {
            $or: [
              { shopId: userId }, // Shop is the service provider
              { customerId: userId, isShopToShop: true } // Shop is chatting as "customer" with another shop
            ]
          }
        ]
      };

    } else {
      return res.status(403).json({ error: "Invalid user role" });
    }

    // Execute query with population for better data
    const chats = await Chat.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    // Enrich chat data with participant info
    const enrichedChats = await Promise.all(chats.map(async (chat) => {
      let otherParticipant = null;

      if (userRole === "customer") {
        // For customer, get shop info
        otherParticipant = await Shop.findById(chat.shopId)
          .select('businessName profilePic category location')
          .lean();
      } else if (userRole === "shop") {
        // For shop, determine if it's a shop-to-shop or regular chat
        if (chat.isShopToShop) {
          // Shop-to-shop chat
          if (chat.shopId.toString() === userId.toString()) {
            // Current shop is the shop, other participant is customer (another shop)
            otherParticipant = await Shop.findById(chat.customerId)
              .select('businessName profilePic category location')
              .lean();
          } else {
            // Current shop is the customer, other participant is shop (another shop)
            otherParticipant = await Shop.findById(chat.shopId)
              .select('businessName profilePic category location')
              .lean();
          }
        } else {
          // Regular chat, other participant is customer
          otherParticipant = await Customer.findById(chat.customerId)
            .select('name avatar email')
            .lean();
        }
      }

      return {
        ...chat,
        otherParticipant,
        chatType: chat.isShopToShop ? "shop-to-shop" : "customer-to-shop",
        // Determine unread count for current user
        unreadCount: userRole === "customer" ? chat.unreadCountCustomer : chat.unreadCountShop
      };
    }));

    res.status(200).json(enrichedChats);

  } catch (error) {
    console.error("Error in getUserChats:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET SINGLE CHAT ====================
export const getChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Verify user is part of this chat
    const isCustomer = chat.customerId.toString() === userId.toString();
    const isShop = chat.shopId.toString() === userId.toString();

    if (!isCustomer && !isShop) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Mark messages as read for this user
    if (userRole === "customer") {
      chat.messages.forEach((msg) => {
        if (msg.senderType === "shop") {
          msg.isRead = true;
        }
      });
      chat.unreadCountCustomer = 0;
    } else if (userRole === "shop") {
      chat.messages.forEach((msg) => {
        if (msg.senderType === "customer") {
          msg.isRead = true;
        }
      });
      chat.unreadCountShop = 0;
    }

    await chat.save();

    res.status(200).json(chat);
  } catch (error) {
    console.error("Error in getChat:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== DELETE CHAT ====================
export const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const isCustomer = chat.customerId.toString() === userId.toString();
    const isShop = chat.shopId.toString() === userId.toString();

    if (!isCustomer && !isShop) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Delete all images from Cloudinary before deleting chat
    if (chat.messages && chat.messages.length > 0) {
      for (const message of chat.messages) {
        if (message.images && message.images.length > 0) {
          for (const image of message.images) {
            try {
              await cloudinary.v2.uploader.destroy(image.publicId);
            } catch (cloudinaryError) {
              console.error(`Error deleting image ${image.publicId}:`, cloudinaryError);
            }
          }
        }
      }
    }

    chat.isActive = false;
    await chat.save();

    res.status(200).json({ success: true, message: "Chat deleted and images removed" });
  } catch (error) {
    console.error("Error in deleteChat:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET UNREAD COUNT ====================
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let totalUnread = 0;

    if (userRole === "customer") {
      const chats = await Chat.find({ customerId: userId }).lean();
      totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCountCustomer, 0);
    } else if (userRole === "shop") {
      const chats = await Chat.find({ shopId: userId }).lean();
      totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCountShop, 0);
    }

    res.status(200).json({ unreadCount: totalUnread });
  } catch (error) {
    console.error("Error in getUnreadCount:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== CLEAR CHAT MESSAGES ====================
export const clearChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Verify user is part of this chat
    const isCustomer = chat.customerId.toString() === userId.toString();
    const isShop = chat.shopId.toString() === userId.toString();

    if (!isCustomer && !isShop) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Delete all images from Cloudinary before clearing messages
    if (chat.messages && chat.messages.length > 0) {
      for (const message of chat.messages) {
        if (message.images && message.images.length > 0) {
          for (const image of message.images) {
            try {
              await cloudinary.v2.uploader.destroy(image.publicId);
            } catch (cloudinaryError) {
              console.error(`Error deleting image ${image.publicId}:`, cloudinaryError);
            }
          }
        }
      }
    }

    // Clear messages but keep the chat
    chat.messages = [];
    chat.lastMessage = "";
    chat.lastMessageTime = null;
    chat.lastMessageType = "text";
    chat.lastMessageImages = [];
    chat.unreadCountCustomer = 0;
    chat.unreadCountShop = 0;

    await chat.save();

    res.status(200).json({ success: true, message: "Chat messages and images cleared" });
  } catch (error) {
    console.error("Error in clearChatMessages:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== SEARCH CHATS ====================
export const searchChats = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Search query is required" });
    }

    const searchRegex = new RegExp(query.trim(), "i");

    let chats;
    if (userRole === "customer") {
      chats = await Chat.find({
        customerId: userId,
        isActive: true,
        $or: [
          { shopName: searchRegex },
          { lastMessage: searchRegex },
          { "messages.text": searchRegex },
        ],
      })
        .sort({ updatedAt: -1 })
        .lean();
    } else if (userRole === "shop") {
      chats = await Chat.find({
        shopId: userId,
        isActive: true,
        $or: [
          { customerName: searchRegex },
          { lastMessage: searchRegex },
          { "messages.text": searchRegex },
        ],
      })
        .sort({ updatedAt: -1 })
        .lean();
    } else {
      return res.status(403).json({ error: "Invalid user role" });
    }

    res.status(200).json(chats);
  } catch (error) {
    console.error("Error in searchChats:", error);
    res.status(500).json({ error: error.message });
  }
};