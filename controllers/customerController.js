import Bid from "../models/bidModel.js";
import Offer from "../models/offerModel.js";
import Event from "../models/eventModel.js";
import Shop from "../models/shopModel.js";
import { notifyCounterOffer } from "../utils/notifyCounterOffer.js";
import { offerAccepted } from "../utils/offerAccepted.js";
import Review from "../models/reviewModel.js"
import mongoose from "mongoose";



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
          select: "businessName legalEntityName email phone address",
        },
      })
      .populate({
        path: "acceptedOffer",
        populate: {
          path: "shopId",
          model: "Shop",
          select: "businessName legalEntityName email phone address",
        },
      })
      .populate("user_id", "name address zip") // ⭐ FIX ADDED HERE
      .sort({ createdAt: -1 });

    if (!bids || bids.length === 0) {
      return res.status(404).json({ message: "No bids found for this user" });
    }
    const formattedBids = bids.map((bid) => ({
      bidId: bid._id,
      product: {
        title: bid.productTitle,
        description: bid.productDescription,
        quantity: bid.quantity,
        unit: bid.unit,
      },
      user: {
        id: bid.user_id?._id,
        name: bid.user_id?.name,
        address: bid.user_id?.address,
        zip: bid.user_id?.zip,
      },
      offers: bid.offers.map((offer) => ({
        offerId: offer._id,
        price: offer.price,
        description: offer.description,
        shop: {
          id: offer.shopId?._id,
          businessName: offer.shopId?.businessName,
          legalEntityName: offer.shopId?.legalEntityName,
          email: offer.shopId?.email,
          phone: offer.shopId?.phone,
          address: offer.shopId?.address,
        },
      })),
      acceptedOffer: bid.acceptedOffer
        ? {
            offerId: bid.acceptedOffer._id,
            price: bid.acceptedOffer.price,
            shop: {
              id: bid.acceptedOffer.shopId?._id,
              businessName: bid.acceptedOffer.shopId?.businessName,
            },
          }
        : null,
      status: bid.status,
      createdAt: bid.createdAt,
    }));

    res.status(200).json({
      success: true,
      count: bids.length,
      bids,
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

    // 2️⃣ Fetch all offers for this bid
    const offers = await Offer.find({ bidId })
      .populate({
        path: "shopId",
        select:
          "businessName email phone address serviceArea website socialMedia profilePic storeFrontPhoto workSpacePhoto plan",
      })
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

    // 5️⃣ Build final response
    const formattedOffers = offers.map((offer) => {
      const shopId = offer.shopId?._id?.toString();
      const shopRating = ratingsMap[shopId] || {
        averageRating: "0.0",
        totalReviews: 0,
      };

      return {
        _id: offer._id,
        price: offer.price,
        message: offer.message || "",
        status: offer.status,
        createdAt: offer.createdAt,
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

    res.status(200).json({
      success: true,
      count: formattedOffers.length,
      offers: formattedOffers,
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
    const customerId = req.customer._id; // authenticated customer

    // 1️⃣ Find the offer
    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    // 2️⃣ Find the associated bid
    const bid = await Bid.findById(offer.bidId);
    if (!bid) return res.status(404).json({ message: "Bid not found" });

    // 3️⃣ Ensure this bid belongs to the current customer
    if (bid.user_id.toString() !== customerId.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized: This bid does not belong to you" });
    }

    // 4️⃣ Accept the offer: update bid and track current shop
    bid.acceptedOffer = offer._id;
    bid.status = "in_progress";
    bid.currentShopId = offer.shopId; // 👈 track which shop owns the bid now
    await bid.save();

    // 5️⃣ Update offer status to accepted
    offer.status = "accepted";
    await offer.save();

    // 6️⃣ Reject all other offers for this bid
    await Offer.updateMany(
      { bidId: bid._id, _id: { $ne: offer._id } },
      { $set: { status: "rejected" } }
    );

    // -------------------- SAVE EVENT --------------------
    await Event.create({
      customerId: customerId,
      shopId: offer.shopId,
      bidId: bid._id,
      type: "offer-accepted",
      message: `Offer is accepted (${offer.price})`,
      metadata: {
        offerId: offer._id,
        shopId: offer.shopId,
        bidId: bid._id,
        newStatus: "in_progress",
      },
    });


     // -------------------- SEND NOTIFICATION TO SHOP --------------------
    await offerAccepted({
      shopId: offer.shopId,
      customerId,
      subject: "Your Offer Has Been Accepted!",
      message: `The customer has accepted your offer of $${offer.price}.`,
      bid,
      offer
    });

    // 7️⃣ Respond with updated bid and offer
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
  try {
    const { bidId } = req.body;
    const userId = req.customer._id;

    const bid = await Bid.findById(bidId);
    if (!bid) return res.status(404).json({ message: "Bid not found" });

    if (bid.user_id.toString() !== userId.toString())
      return res.status(403).json({ message: "Not authorized" });

    // Reset bid for repost
    bid.status = "active";
    bid.dueDate = null;
    bid.offers = [];
    bid.acceptedOffer = null;
    bid.createdAt = new Date();

    await bid.save();

    // -------------------- SAVE EVENT --------------------
    await Event.create({
      customerId: userId, // customer who reposted
      shopId: null, // no shop involved
      bidId: bid._id,
      type: "bid-reposted",
      message: `You reposted the bid ${bid.serviceDescription}`,
      metadata: {
        bidId: bid._id,
      },
    });

    res.status(200).json({ message: "Bid reposted successfully" });
  } catch (err) {
    console.error("Error reposting bid:", err);
    res.status(500).json({ message: "Server error" });
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
