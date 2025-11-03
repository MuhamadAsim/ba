import Bid from "../models/bidModel.js";

export const createBid = async (req, res, next) => {
  try {
    const files = req.files || {};
    const { body } = req;

    const bid = new Bid({
      ...body,
      vehicleImages: files.vehicleImages?.map((f) => f.path) || [],
      artworkFiles: files.artworkFiles?.map((f) => f.path) || [],
      exampleFiles: files.exampleFiles?.map((f) => f.path) || [],
    });

    await bid.save();
    res.status(201).json({ success: true, bid });
  } catch (err) {
    next(err);
  }
};
