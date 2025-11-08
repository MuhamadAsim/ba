import Bid from "../models/bidModel.js";
import Customer from "../models/customerModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import Offer from "../models/offerModel.js";
import Shop from "../models/shopModel.js"; 






// get the status
export const getCustomerBidStats = async (req, res) => {
  try {
    const userId = req.customer?._id || req.params.userId;

    const [active, inProgress, completed, expired, canceled] = await Promise.all([
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
    res.status(500).json({ status: "error", message: "Server error fetching stats" });
  }
};




// 🟩 Controller to get all bids of a customer with offers + shop info
export const getUserBidsWithOffers = async (req, res) => {
  try {
    const userId = req.customer._id; // <-- use req.customer, not req.user

    const bids = await Bid.find({ user_id: userId })
      .populate({
        path: "offers",
        populate: {
          path: "shopId",
          model: "Shop",
          select: "name email phone address", // choose fields to include
        },
      })
      .populate({
        path: "acceptedOffer",
        populate: {
          path: "shopId",
          model: "Shop",
          select: "name email phone address",
        },
      })
      .sort({ createdAt: -1 }); // latest bids first

    if (!bids || bids.length === 0) {
      return res.status(404).json({ message: "No bids found for this user" });
    }
    // console.log(bids[0].offers);

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
      .sort({ createdAt: -1 });

    if (!offers || offers.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        offers: [],
        message: "No offers yet for this bid",
      });
    }

    // 3️⃣ Format and send data
    const formattedOffers = offers.map((offer) => ({
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
    }));

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







// Accwpt the offer
export const acceptOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const customerId = req.customer._id; // authenticated customer

    // 1️⃣ Find the offer
    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    // 2️⃣ Find the associated bid
    const bid = await Bid.findById(offer.bidId);
    if (!bid) {
      return res.status(404).json({ message: "Bid not found" });
    }

    // 3️⃣ Ensure this bid belongs to the current customer
    if (bid.user_id.toString() !== customerId.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized: This bid does not belong to you" });
    }

    // 4️⃣ Update bid with accepted offer
    bid.acceptedOffer = offer._id;
    bid.status = "in_progress";
    await bid.save();

    // 5️⃣ Update the offer status to "accepted"
    offer.status = "accepted";
    await offer.save();

    // 6️⃣ Optionally reject all other offers on this bid
    await Offer.updateMany(
      { bidId: bid._id, _id: { $ne: offer._id } },
      { $set: { status: "rejected" } }
    );

    res.status(200).json({
      success: true,
      message: "Offer accepted successfully",
      acceptedOffer: offer,
      updatedBid: {
        _id: bid._id,
        status: bid.status,
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





// Counter offer
export const submitCounterOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { counterPrice, message } = req.body;
    const userId = req.user._id; // assuming auth middleware

    if (!counterPrice || counterPrice <= 0) {
      return res.status(400).json({ message: "Invalid counter price" });
    }

    // Find the offer
    const offer = await Offer.findById(offerId).populate("bidId");

    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    // Check if logged-in user is the bid owner
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

    res.status(200).json({ message: "Counter offer submitted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};






// Cancel bid controller
export const cancelBid = async (req, res) => {
  try {
    const { bidId } = req.params;
    const userId = req.customer._id; // <-- updated to match your auth middleware

    // Find the bid
    const bid = await Bid.findById(bidId).populate("offers");

    if (!bid) {
      return res.status(404).json({ message: "Bid not found" });
    }

    // Only the owner can cancel
    if (bid.user_id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    console.log("Bid status:", bid.status);


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

    res.status(200).json({ message: "Bid canceled successfully" });
  } catch (err) {
    console.error("Error canceling bid:", err);
    res.status(500).json({ message: "Server error" });
  }
};





export const repostBid = async (req, res) => {
  try {
    const { bidId } = req.body; // <-- get it from body
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

    res.status(200).json({ message: "Bid reposted successfully" });
  } catch (err) {
    console.error("Error reposting bid:", err);
    res.status(500).json({ message: "Server error" });
  }
};
