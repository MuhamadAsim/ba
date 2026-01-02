import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import Event from "../models/eventModel.js";
import Customer from "../models/customerModel.js";
import Shop from "../models/shopModel.js";
import { notifyCounterOffer } from "../utils/notifyCounterOffer.js";
import { offerAccepted } from "../utils/offerAccepted.js";
import Review from "../models/reviewModel.js"
import mongoose from "mongoose";
import { notifyShopsForBid } from "../utils/notifyShops.js";


// get the status
export const getCustomerBidStats = async (req, res) => {
  try {
    const userId = req.customer?._id || req.params.userId;

    const [active, inProgress, completed, expired, canceled] =
      await Promise.all([
        Bid.countDocuments({ user_id: userId, status: "active" }),
        Bid.countDocuments({ user_id: userId, status: "in_progress" }),
        Bid.countDocuments({ user_id: userId, status: "completed" }),
        Bid.countDocuments({ user_id: userId, status: "expired" }),
        Bid.countDocuments({ user_id: userId, status: "canceled" }),
      ]);

    const total = active + inProgress + completed + expired + canceled;

    res.json({
      status: "success",
      data: { total, active, inProgress, completed, expired, canceled },
    });
  } catch (error) {
    console.error("Error fetching bid stats:", error);
    res
      .status(500)
      .json({ status: "error", message: "Server error fetching stats" });
  }
};

// // 🟩 Controller to get all bids of a customer with offers + shop info
// export const getUserBidsWithOffers = async (req, res) => {
//   try {
//     const userId = req.customer._id;

//     const bids = await Bid.find({ user_id: userId })
//       .populate({
//         path: "offers",
//         populate: {
//           path: "shopId",
//           model: "Shop",
//           select: "businessName legalEntityName email phone address",
//         },
//       })
//       .populate({
//         path: "acceptedOffer",
//         populate: {
//           path: "shopId",
//           model: "Shop",
//           select: "businessName legalEntityName email phone address",
//         },
//       })
//       .populate("user_id", "name address zip") // ⭐ FIX ADDED HERE
//       .sort({ createdAt: -1 });

//     if (!bids || bids.length === 0) {
//       return res.status(404).json({ message: "No bids found for this user" });
//     }
//     const formattedBids = bids.map((bid) => ({
//       bidId: bid._id,
//       product: {
//         title: bid.productTitle,
//         description: bid.productDescription,
//         quantity: bid.quantity,
//         unit: bid.unit,
//       },
//       user: {
//         id: bid.user_id?._id,
//         name: bid.user_id?.name,
//         address: bid.user_id?.address,
//         zip: bid.user_id?.zip,
//       },
//       offers: bid.offers.map((offer) => ({
//         offerId: offer._id,
//         price: offer.price,
//         description: offer.description,
//         shop: {
//           id: offer.shopId?._id,
//           businessName: offer.shopId?.businessName,
//           legalEntityName: offer.shopId?.legalEntityName,
//           email: offer.shopId?.email,
//           phone: offer.shopId?.phone,
//           address: offer.shopId?.address,
//         },
//       })),
//       acceptedOffer: bid.acceptedOffer
//         ? {
//             offerId: bid.acceptedOffer._id,
//             price: bid.acceptedOffer.price,
//             shop: {
//               id: bid.acceptedOffer.shopId?._id,
//               businessName: bid.acceptedOffer.shopId?.businessName,
//             },
//           }
//         : null,
//       status: bid.status,
//       createdAt: bid.createdAt,
//     }));

//     res.status(200).json({
//       success: true,
//       count: bids.length,
//       bids,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching user bids:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error while fetching user bids",
//       error: error.message,
//     });
//   }
// };



// 🟩 Controller to get all bids of a customer with offers + shop info
export const getUserBidsWithOffers = async (req, res) => {
  try {
    const userId = req.customer._id;


    const bids = await Bid.find({ user_id: userId })
      .populate({
        path: "offers",
        populate: {
          path: "shopId",
          model: "Shop",
          select: "businessName legalEntityName email phone address avatar ratings reviews",
        },
      })
      .populate({
        path: "acceptedOffer",
        populate: {
          path: "shopId",
          model: "Shop",
          select: "businessName legalEntityName email phone address avatar ratings reviews",
        },
      })
      .populate("user_id", "name email phone address zip")
      .sort({ createdAt: -1 });

    if (!bids || bids.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bids found for this user"
      });
    }

    const formattedBids = bids.map((bid) => ({
      // Bid Basic Info
      bidId: bid._id,
      requestCategory: bid.requestCategory,
      serviceDescription: bid.serviceDescription,

      // Vehicle Details
      vehicle: {
        year: bid.vehicleYear,
        make: bid.vehicleMake,
        model: bid.vehicleModel,
        trim: bid.vehicleTrim,
        condition: bid.vehicleCondition,
      },

      // Service-Specific Fields
      serviceDetails: {
        // Color Wrap & PPF
        desiredFinish: bid.desiredFinish,
        hasExistingWrap: bid.hasExistingWrap,
        wrapCoverage: bid.wrapCoverage,
        wrapType: bid.wrapType,
        desiredColor: bid.desiredColor,

        // Business Wrap
        brandingWrapCoverage: bid.brandingWrapCoverage,
        hasDesign: bid.hasDesign,
        hasLogo: bid.hasLogo,

        // Window Tinting
        hasExistingTint: bid.hasExistingTint,
        tintCoverage: bid.tintCoverage,
        tintType: bid.tintType,

        // Ceramic Coating
        paintFinish: bid.paintFinish,
        coatingPackage: bid.coatingPackage,
        coverageExterior: bid.coverageExterior,
        coverageInterior: bid.coverageInterior,
        coverageGlassTrims: bid.coverageGlassTrims,
        coverageWheelsBrakes: bid.coverageWheelsBrakes,

        // PPF
        ppfCoverage: bid.ppfCoverage,
        addCeramicCoating: bid.addCeramicCoating,
      },

      // File Uploads
      files: {
        vehicleImages: bid.vehicleImages || [],
        artworkFiles: bid.artworkFiles || [],
        exampleFiles: bid.exampleFiles || [],
        coatingPhotos: bid.coatingPhotos || [],
        ppfPhotos: bid.ppfPhotos || [],
      },

      // Location Info
      location: {
        zipCode: bid.zipCode,
        address: bid.address,
        latitude: bid.latitude,
        longitude: bid.longitude,
        country: bid.country,
      },

      // Contact Info
      contact: {
        firstName: bid.firstName,
        lastName: bid.lastName,
        email: bid.email,
        phone: bid.phone,
        contactMethod: bid.contactMethod,
      },

      // Offers
      offers: bid.offers?.map((offer) => ({
        offerId: offer._id,
        price: offer.price,
        description: offer.description,
        appointmentDate: offer.appointmentDate,
        appointmentTime: offer.appointmentTime,
        estimatedCompletionDays: offer.estimatedCompletionDays,
        workingHours: offer.workingHours,
        status: offer.status,
        createdAt: offer.createdAt,
        shop: {
          id: offer.shopId?._id,
          businessName: offer.shopId?.businessName,
          legalEntityName: offer.shopId?.legalEntityName,
          email: offer.shopId?.email,
          phone: offer.shopId?.phone,
          address: offer.shopId?.address,
          avatar: offer.shopId?.avatar,
          ratings: offer.shopId?.ratings,
          reviews: offer.shopId?.reviews,
        },
      })) || [],

      // Accepted Offer
      acceptedOffer: bid.acceptedOffer ? {
        offerId: bid.acceptedOffer._id,
        price: bid.acceptedOffer.price,
        description: bid.acceptedOffer.description,
        appointmentDate: bid.acceptedOffer.appointmentDate,
        appointmentTime: bid.acceptedOffer.appointmentTime,
        estimatedCompletionDays: bid.acceptedOffer.estimatedCompletionDays,
        workingHours: bid.acceptedOffer.workingHours,
        status: bid.acceptedOffer.status,
        createdAt: bid.acceptedOffer.createdAt,
        shop: {
          id: bid.acceptedOffer.shopId?._id,
          businessName: bid.acceptedOffer.shopId?.businessName,
          legalEntityName: bid.acceptedOffer.shopId?.legalEntityName,
          email: bid.acceptedOffer.shopId?.email,
          phone: bid.acceptedOffer.shopId?.phone,
          address: bid.acceptedOffer.shopId?.address,
          avatar: bid.acceptedOffer.shopId?.avatar,
        },
      } : null,

      // Bid Status & Dates
      status: bid.status,
      dueDate: bid.dueDate,
      createdAt: bid.createdAt,
      updatedAt: bid.updatedAt,
    }));




    res.status(200).json({
      success: true,
      count: formattedBids.length,
      bids: formattedBids,
    });
  } catch (error) {
    console.error("❌ Error fetching user bids:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user bids",
      error: error.message,
    });
  }
};



export const getBidOffers = async (req, res) => {
  try {
    const { bidId } = req.params;
    const customerId = req.customer._id; // authenticated customer

    // 1️⃣ Ensure the bid belongs to this customer
    const bid = await Bid.findOne({ _id: bidId, user_id: customerId });
    if (!bid) {
      return res.status(404).json({ message: "Bid not found or unauthorized" });
    }

    // 2️⃣ Fetch all offers for this bid - INCLUDE APPOINTMENT FIELDS
    const offers = await Offer.find({ bidId })
      .populate({
        path: "shopId",
        select:
          "businessName email phone address serviceArea website socialMedia profilePic storeFrontPhoto workSpacePhoto plan",
      })
      .select('price message status appointmentDate appointmentTime estimatedCompletionDays workingHours createdAt')
      .sort({ createdAt: 1 });

    if (!offers.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        offers: [],
        message: "No offers yet for this bid",
      });
    }

    // 3️⃣ Get all shopIds for rating calculation
    const shopIds = offers
      .map((o) => o.shopId?._id)
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(id));

    // 4️⃣ Get rating summary for all shops in ONE DB query
    const ratingSummary = await Review.aggregate([
      { $match: { shop: { $in: shopIds } } },
      {
        $group: {
          _id: "$shop",
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    // convert to map for fast lookup
    const ratingsMap = {};
    ratingSummary.forEach((entry) => {
      ratingsMap[entry._id.toString()] = {
        averageRating: entry.averageRating?.toFixed(1) || "0.0",
        totalReviews: entry.totalReviews || 0,
      };
    });

    // 5️⃣ Build final response WITH APPOINTMENT FIELDS
    const formattedOffers = offers.map((offer) => {
      const shopId = offer.shopId?._id?.toString();
      const shopRating = ratingsMap[shopId] || {
        averageRating: "0.0",
        totalReviews: 0,
      };

      // Check if offer has appointment details
      const hasAppointmentDetails = !!(offer.appointmentDate || offer.appointmentTime);

      return {
        _id: offer._id,
        price: offer.price,
        message: offer.message || "",
        status: offer.status,
        createdAt: offer.createdAt,

        // ⭐ Appointment Fields - Include in response
        appointmentDate: offer.appointmentDate || null,
        appointmentTime: offer.appointmentTime || null,
        estimatedCompletionDays: offer.estimatedCompletionDays || null,
        workingHours: offer.workingHours || null,
        hasAppointment: hasAppointmentDetails, // Helper flag for frontend

        shopId: {
          _id: offer.shopId?._id,
          businessName: offer.shopId?.businessName,
          email: offer.shopId?.email,
          phone: offer.shopId?.phone,
          address: offer.shopId?.address,
          serviceArea: offer.shopId?.serviceArea,
          website: offer.shopId?.website || "",
          socialMedia: offer.shopId?.socialMedia || {},
          profilePic: offer.shopId?.profilePic || "",
          storeFrontPhoto: offer.shopId?.storeFrontPhoto || "",
          workSpacePhoto: offer.shopId?.workSpacePhoto || "",
          plan: offer.shopId?.plan || "basic",

        },
        shopRating, // ⭐ Send rating info here
      };
    });

    // 6️⃣ Add statistics about appointments (optional but useful)
    const offersWithAppointments = formattedOffers.filter(o => o.hasAppointment).length;
    const appointmentStats = {
      totalOffers: formattedOffers.length,
      offersWithAppointments,
      percentageWithAppointments: formattedOffers.length > 0
        ? Math.round((offersWithAppointments / formattedOffers.length) * 100)
        : 0,
    };

    res.status(200).json({
      success: true,
      count: formattedOffers.length,
      offers: formattedOffers,
      stats: appointmentStats, // Optional: include appointment statistics
    });

  } catch (error) {
    console.error("❌ Error fetching offers for bid:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching offers",
      error: error.message,
    });
  }
};



export const acceptOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const customerId = req.customer._id;

    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    const bid = await Bid.findById(offer.bidId);
    if (!bid) return res.status(404).json({ message: "Bid not found" });

    if (bid.user_id.toString() !== customerId.toString()) {
      return res.status(403).json({ message: "Unauthorized: This bid does not belong to you" });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    // Update bid and offer
    bid.acceptedOffer = offer._id;
    bid.status = "in_progress";
    bid.currentShopId = offer.shopId;
    await bid.save();

    offer.status = "accepted";
    await offer.save();

    // Reject other offers
    await Offer.updateMany(
      { bidId: bid._id, _id: { $ne: offer._id } },
      { $set: { status: "rejected" } }
    );

    // Save event
    await Event.create({
      customerId: customerId,
      shopId: offer.shopId,
      bidId: bid._id,
      type: "offer-accepted",
      message: `Offer accepted - $${offer.price}`,
      metadata: {
        offerId: offer._id,
        shopId: offer.shopId,
        bidId: bid._id,
        newStatus: "in_progress",
      },
    });

    // Build notification message with customer phone
    const phoneInfo = customer.phone && customer.phone.trim() !== ""
      ? ` Customer phone: ${customer.phone}.`
      : "";

    const vehicleInfo = bid.vehicleYear && bid.vehicleMake && bid.vehicleModel
      ? ` Vehicle: ${bid.vehicleYear} ${bid.vehicleMake} ${bid.vehicleModel}.`
      : "";

    await offerAccepted({
      shopId: offer.shopId,
      customerId,
      subject: "🎉 Offer Accepted!",
      message: `Great news! ${customer.name} has accepted your offer of $${offer.price}.${phoneInfo}${vehicleInfo}`,
      bid,
      offer,
      customerPhone: customer.phone
    });

    res.status(200).json({
      success: true,
      message: "Offer accepted successfully",
      acceptedOffer: offer,
      updatedBid: {
        _id: bid._id,
        status: bid.status,
        currentShopId: bid.currentShopId,
        acceptedOffer: bid.acceptedOffer,
      },
    });
  } catch (error) {
    console.error("❌ Error accepting offer:", error);
    res.status(500).json({
      success: false,
      message: "Server error while accepting offer",
      error: error.message,
    });
  }
};




export const submitCounterOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { counterPrice, message } = req.body;
    const userId = req.user._id; // customer

    if (!counterPrice || counterPrice <= 0) {
      return res.status(400).json({ message: "Invalid counter price" });
    }

    // Find the offer + bid
    const offer = await Offer.findById(offerId).populate("bidId");

    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    // Check ownership
    if (offer.bidId.user_id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Add counter offer
    if (!offer.counterOffers) offer.counterOffers = [];
    offer.counterOffers.push({
      counterPrice,
      message,
      createdBy: userId,
      status: "pending",
      createdAt: new Date(),
    });

    await offer.save();

    // -------------------- SAVE EVENT --------------------
    await Event.create({
      customerId: userId, // customer who sent counter offer
      shopId: offer.shopId, // shop who will receive it
      bidId: offer.bidId._id,
      type: "counter-offer",
      message: `Counter offer is submitted on offer ${offer.price}`,
      metadata: {
        offerId: offer._id,
        bidId: offer.bidId._id,
        shopId: offer.shopId,
        counterPrice,
      },
    });

    notifyCounterOffer(offer, counterData);


    res.status(200).json({ message: "Counter offer submitted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const cancelBid = async (req, res) => {
  try {
    const { bidId } = req.params;
    const userId = req.customer._id; // authenticated customer

    // Find the bid + offers
    const bid = await Bid.findById(bidId).populate("offers");

    if (!bid) {
      return res.status(404).json({ message: "Bid not found" });
    }

    // Only the owner can cancel
    if (bid.user_id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Only active bids can be canceled
    if (bid.status !== "active") {
      return res
        .status(400)
        .json({ message: "Only active bids can be canceled" });
    }

    // Delete all associated offers (counterOffers are embedded inside offers)
    if (bid.offers && bid.offers.length > 0) {
      await Offer.deleteMany({ _id: { $in: bid.offers } });
    }

    // Update bid status and clear references
    bid.status = "canceled";
    bid.offers = [];
    bid.acceptedOffer = null;
    await bid.save();

    // -------------------- SAVE EVENT --------------------
    await Event.create({
      customerId: userId, // customer who canceled
      shopId: null, // no specific shop
      bidId: bid._id,
      type: "bid-canceled",
      message: `You canceled the bid ${bid.serviceDescription}`,
      metadata: {
        bidId: bid._id,
      },
    });

    res.status(200).json({ message: "Bid canceled successfully" });
  } catch (err) {
    console.error("Error canceling bid:", err);
    res.status(500).json({ message: "Server error" });
  }
};














export const repostBid = async (req, res) => {
  let session = null;
  try {
    const { bidId } = req.body;
    const userId = req.customer._id;

    // Get the customer/user details
    const customer = await Customer.findById(userId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    // Find the old bid
    const oldBid = await Bid.findById(bidId);
    if (!oldBid) return res.status(404).json({
      success: false,
      message: "Bid not found"
    });

    if (oldBid.user_id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to repost this bid"
      });
    }

    // ============================================
    // 🚫 CHECK DAILY BID LIMIT (MAX 2 BIDS PER DAY)
    // ============================================
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todaysBidCount = await Bid.countDocuments({
      user_id: userId,
      createdAt: {
        $gte: startOfToday,
        $lte: endOfToday
      }
    });

    if (todaysBidCount >= 2) {
      return res.status(429).json({
        success: false,
        message: "Daily limit reached",
        error: `You have already submitted ${todaysBidCount} bids today. The limit is 2 bids per day. Please try again tomorrow.`,
        limit: 2,
        used: todaysBidCount,
        resetsAt: new Date(endOfToday.getTime() + 1).toISOString()
      });
    }

    const bidsRemaining = 2 - todaysBidCount;

    // Store old bid data - Get ALL fields as plain object
    const oldBidData = oldBid.toObject();
    
    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // 1. Delete all offers associated with the old bid
    await Offer.deleteMany({ bidId: oldBid._id }).session(session);

    // 2. Delete any events associated with the old bid
    await Event.deleteMany({ bidId: oldBid._id }).session(session);

    // 3. Delete the old bid
    await Bid.findByIdAndDelete(oldBid._id).session(session);

    // 4. Create a COMPLETELY NEW BID with ALL data copied
    const newBidData = {
      // Copy ALL vehicle info
      vehicleYear: oldBidData.vehicleYear,
      vehicleMake: oldBidData.vehicleMake,
      vehicleModel: oldBidData.vehicleModel,
      vehicleTrim: oldBidData.vehicleTrim,
      vehicleCondition: oldBidData.vehicleCondition,
      vehicleImages: oldBidData.vehicleImages || [],

      // Copy ALL service info
      requestCategory: oldBidData.requestCategory,
      serviceDescription: oldBidData.serviceDescription,
      desiredFinish: oldBidData.desiredFinish,
      hasExistingWrap: oldBidData.hasExistingWrap,
      
      // Color Wrap & PPF fields
      wrapCoverage: oldBidData.wrapCoverage,
      wrapType: oldBidData.wrapType,
      desiredColor: oldBidData.desiredColor,
      
      // Business Wrap fields
      brandingWrapCoverage: oldBidData.brandingWrapCoverage,
      hasDesign: oldBidData.hasDesign,
      hasLogo: oldBidData.hasLogo,
      artworkFiles: oldBidData.artworkFiles || [],
      exampleFiles: oldBidData.exampleFiles || [],
      
      // Window Tinting fields
      hasExistingTint: oldBidData.hasExistingTint,
      tintCoverage: oldBidData.tintCoverage,
      tintType: oldBidData.tintType,
      
      // Ceramic Coating fields
      paintFinish: oldBidData.paintFinish,
      coatingPackage: oldBidData.coatingPackage,
      coverageExterior: oldBidData.coverageExterior || false,
      coverageInterior: oldBidData.coverageInterior || false,
      coverageGlassTrims: oldBidData.coverageGlassTrims || false,
      coverageWheelsBrakes: oldBidData.coverageWheelsBrakes || false,
      coatingPhotos: oldBidData.coatingPhotos || [],
      
      // PPF fields
      ppfCoverage: oldBidData.ppfCoverage,
      addCeramicCoating: oldBidData.addCeramicCoating,
      ppfPhotos: oldBidData.ppfPhotos || [],

      // Copy ALL contact info
      firstName: oldBidData.firstName,
      lastName: oldBidData.lastName,
      email: oldBidData.email,
      phone: oldBidData.phone,
      zipCode: oldBidData.zipCode,
      address: oldBidData.address,
      latitude: oldBidData.latitude,
      longitude: oldBidData.longitude,
      country: oldBidData.country,
      location: oldBidData.location,

      // Copy bid settings
      dueDate: null, // Reset due date
      contactMethod: oldBidData.contactMethod,

      // Reset status and references
      user_id: userId,
      status: "active",
      offers: [],
      acceptedOffer: null,
      currentShopId: null,
      reviewed: false,

      // 🔥 FRESH TIMESTAMPS - This is key!
      createdAt: new Date(),  // TODAY'S DATE
      updatedAt: new Date(),  // TODAY'S DATE
    };

    // Create the new bid
    const newBid = new Bid(newBidData);
    await newBid.save({ session });

    // 5. Create event for the NEW bid
    await Event.create([{
      customerId: userId,
      shopId: null,
      bidId: newBid._id,
      type: "bid-created",
      title: "New Bid Created",
      message: `A new bid has been submitted.`,
      metadata: {
        isRepost: true,
        originalBidId: oldBid._id,
        repostedAt: new Date(),
      },
    }], { session });

    // Commit transaction
    await session.commitTransaction();

    // ------------------------------------
    // 🚀 NOTIFY SHOPS ASYNCHRONOUSLY
    // ------------------------------------
    notifyShopsForBid(newBid, customer).catch(error => {
      console.error("Shop notification failed (non-critical):", error);
      Event.create({
        customerId: userId,
        shopId: null,
        bidId: newBid._id,
        type: "system-error",
        title: "Shop Notification Failed",
        message: `Failed to notify shops about new bid: ${error.message}`,
        metadata: {
          bidId: newBid._id,
          error: error.message,
        },
      }).catch(e => console.error("Failed to log notification error:", e));
    });

    // 🎯 IMMEDIATE RESPONSE TO USER
    res.status(200).json({
      success: true,
      message: "✅ Bid reposted successfully as a new bid",
      data: {
        bidId: newBid._id,
        status: newBid.status,
        serviceDescription: newBid.serviceDescription,
        vehicleInfo: `${newBid.vehicleYear} ${newBid.vehicleMake} ${newBid.vehicleModel}`,
        createdAt: newBid.createdAt,
        offersCount: 0,
      },
      note: "Local shops are being notified. You'll receive bids within 24-48 hours.",
      dailyLimit: {
        max: 2,
        used: todaysBidCount + 1,
        remaining: bidsRemaining - 1,
        resetsAt: new Date(endOfToday.getTime() + 1).toISOString()
      }
    });

  } catch (err) {
    // Abort transaction if it exists
    if (session) {
      await session.abortTransaction();
    }

    console.error("❌ Error reposting bid:", err);

    // Log error event
    Event.create({
      customerId: req.customer?._id || null,
      shopId: null,
      bidId: req.body?.bidId || null,
      type: "system-error",
      title: "Bid Repost Failed",
      message: `Error reposting bid: ${err.message}`,
      metadata: {
        error: err.message,
        bidId: req.body?.bidId,
        operation: "repost_as_new",
        stack: err.stack,
      },
    }).catch(e => console.error("Failed to log error event:", e));

    res.status(500).json({
      success: false,
      message: "Server error while reposting bid",
      error: process.env.NODE_ENV === 'development' ? err.message : "Internal server error",
    });
  } finally {
    // End session if it exists
    if (session) {
      session.endSession();
    }
  }
};












export const counterOffer = async (req, res) => {
  try {
    const customerId = req.customer._id;
    const { offerId } = req.params;
    const { counterPrice, message } = req.body;

    // 1️⃣ Fetch the offer
    const offer = await Offer.findById(offerId).populate("bidId");
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    // 2️⃣ Check if this customer already made a counter offer
    const alreadyCountered = offer.counterOffers.some(
      (co) => co.createdBy.toString() === customerId.toString()
    );

    if (alreadyCountered) {
      return res.status(400).json({
        success: false,
        message: "You already submitted a counter offer for this offer",
      });
    }

    // 3️⃣ Create new counter offer object
    const newCounterOffer = {
      counterPrice,
      message,
      createdBy: customerId,
      status: "pending",
      createdAt: new Date(),
    };

    // 4️⃣ Push to offer.counterOffers
    offer.counterOffers.push(newCounterOffer);

    // 5️⃣ Save the offer
    await offer.save();

    // -------------------- SAVE EVENT --------------------
    await Event.create({
      customerId: customerId,
      shopId: offer.shopId,
      bidId: offer.bidId._id,
      type: "counter-offer",
      message: `Counter offer ${counterPrice} is submitted for offer (${offer.price})`,
      metadata: {
        offerId: offer._id,
        counterPrice,
      },
    });

    notifyCounterOffer(offer, newCounterOffer);



    return res.status(200).json({
      success: true,
      message: "Counter offer submitted successfully",
      counterOffer: newCounterOffer,
    });
  } catch (error) {
    console.error("❌ Error submitting counter offer:", error);
    res.status(500).json({
      success: false,
      message: "Server error while submitting counter offer",
      error: error.message,
    });
  }
};




export const getShopProfile = async (req, res) => {
  try {
    const { shopId } = req.params;

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res
        .status(404)
        .json({ status: "error", message: "Shop not found" });
    }

    // Map the shop document to the frontend format
    const shopData = {
      _id: shop._id, // ✅ Important: Include the _id for rating fetch
      businessName: shop.businessName || "",
      ownerName: shop.ownerName || "",
      email: shop.email || "",
      countryCode: shop.countryCode || "",
      phone: shop.phone || "",
      website: shop.website || "",
      country: shop.country || "",
      services: shop.services || [],
      vinylFilms: shop.vinylFilms || "",
      certificates: shop.certificates || "",
      startDate: shop.startDate || "",
      instagramLink: shop.socialMedia?.instagram || "",
      facebookLink: shop.socialMedia?.facebook || "",
      linkedinLink: shop.socialMedia?.linkedin || "",
      bio: shop.additionalInfo || "",
      legalEntityName: shop.legalEntityName || "",
      address: shop.address || "",
      insuranceCarrier: shop.insuranceCarrier || "",
      policyNumber: shop.policyNumber || "",
      policyExpiration: shop.policyExpiration || "",
      plan: shop.plan || "",
      avatar: shop.profilePic || "",
      storeFrontPhoto: shop.storeFrontPhoto || "",
      workSpacePhoto: shop.workSpacePhoto || "",

      // ✅ ADDED: New fields required for the preview component
      financingOffered: shop.financingOffered || false,
      acceptedPayments: shop.acceptedPayments || [],
      yearsExperience: shop.yearsExperience || "",
      businessHours: shop.businessHours || {
        monday: { open: "", close: "", closed: false },
        tuesday: { open: "", close: "", closed: false },
        wednesday: { open: "", close: "", closed: false },
        thursday: { open: "", close: "", closed: false },
        friday: { open: "", close: "", closed: false },
        saturday: { open: "", close: "", closed: false },
        sunday: { open: "", close: "", closed: false }
      },

      // Optional: Include rating and review count if needed
      rating: shop.rating || 0,
      reviewCount: shop.reviewCount || 0,
    };

    res.json(shopData);
  } catch (error) {
    console.error("Error fetching shop profile:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

export const submitReview = async (req, res) => {
  try {
    const { bidId } = req.params;
    const { rating, comment } = req.body;

    const customerId = req.customer._id;

    // Validate bid belongs to logged-in customer
    const bid = await Bid.findOne({ _id: bidId, user_id: customerId }).populate("currentShopId");

    if (!bid) {
      return res.status(404).json({ message: "Bid not found" });
    }

    if (!bid.currentShopId) {
      return res.status(400).json({ message: "Cannot review: no shop assigned" });
    }

    if (bid.reviewed) {
      return res.status(400).json({ message: "Review already submitted" });
    }

    // Create a new review
    const review = await Review.create({
      bid: bid._id,
      shop: bid.currentShopId._id,
      customer: customerId,
      rating,
      comment,
    });


    // Update shop rating
    const shop = bid.currentShopId;
    const newReviewCount = shop.reviewCount + 1;

    shop.rating =
      (shop.rating * shop.reviewCount + rating) / newReviewCount;

    shop.reviewCount = newReviewCount;

    await shop.save();

    // Mark bid as reviewed
    bid.reviewed = true;
    await bid.save();

    return res.status(200).json({
      success: true,
      message: "Review submitted successfully",
    });
  } catch (err) {
    console.error("❌ Error submitting review:", err);
    return res.status(500).json({ message: "Server error while submitting review" });
  }
};





export const checkReviewStatus = async (req, res) => {
  try {
    const { bidId } = req.params;

    // Get logged-in customer from middleware
    const customerId = req.customer._id;

    // Find bid by id AND make sure it belongs to this customer
    const bid = await Bid.findOne({ _id: bidId, user_id: customerId });

    if (!bid) {
      return res.status(404).json({ message: "Bid not found" });
    }

    return res.status(200).json({
      success: true,
      hasReview: bid.reviewed || false, // Assuming bid.reviewed exists
    });
  } catch (err) {
    console.error("❌ Error checking review status:", err);
    return res.status(500).json({ message: "Server error checking review status" });
  }
};




export const getShopRatingSummary = async (req, res) => {
  try {
    const { shopId } = req.params;

    console.log("📩 Incoming shopId:", shopId);

    const stats = await Review.aggregate([
      { $match: { shop: new mongoose.Types.ObjectId(shopId) } },
      {
        $group: {
          _id: "$shop",
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    console.log("🔍 Aggregation Match Result:", stats);

    // If no reviews exist
    if (stats.length === 0) {
      console.log("ℹ️ No reviews found for shop:", shopId);
      return res.json({
        shopId,
        averageRating: 0,
        totalReviews: 0
      });
    }

    console.log("⭐ Calculated Rating Summary:", {
      averageRating: stats[0].averageRating,
      totalReviews: stats[0].totalReviews
    });

    res.json({
      shopId,
      averageRating: stats[0].averageRating.toFixed(1),
      totalReviews: stats[0].totalReviews
    });

  } catch (err) {
    console.error("❌ Error calculating shop rating:", err);
    res.status(500).json({ message: "Server error" });
  }
};
