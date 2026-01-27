import Stripe from "stripe";
import Plan from "../models/planModel.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);






/* =====================================================
   GET ALL PLANS (ADMIN)
   - Excludes soft-deleted plans
===================================================== */
export const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isDeleted: false })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("Fetch Plans Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
    });
  }
};









/* =====================================================
   CREATE PLAN
===================================================== */
export const createPlan = async (req, res) => {
  try {
    const {
      name,
      price,
      currency,
      isActive = true,
      tags = [],
      features = {},
      descriptionPoints,
    } = req.body;

    // 1️⃣ Validation
    if (!name || !price || !currency) {
      return res.status(400).json({
        success: false,
        message: "Name, price and currency are required",
      });
    }

    // Check for duplicate plan name
    const existingPlan = await Plan.findOne({ 
      name, 
      isDeleted: false 
    });
    
    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: `A plan with name "${name}" already exists. Please choose a different name.`,
      });
    }

    // 2️⃣ Create Stripe Product
    const product = await stripe.products.create({
      name,
      description: descriptionPoints ? descriptionPoints.join(" • ") : "",
      metadata: {
        tags: JSON.stringify(tags),
        features: JSON.stringify({
          ...features,
          // Ensure notificationDelay is included in metadata
          notificationDelay: features.notificationDelay || 0,
        })
      }
    });

    // 3️⃣ Create Stripe Price (MONTHLY)
    const stripePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(Number(price) * 100),
      currency: currency.toLowerCase(),
      recurring: { interval: "month" },
    });

    // 4️⃣ Save Plan
    const plan = await Plan.create({
      name,
      descriptionPoints: descriptionPoints || [],
      tags: Array.isArray(tags) ? tags : [],
      stripeProductId: product.id,
      stripePriceId: stripePrice.id,
      price: Number(price),
      currency,
      interval: "month",
      isActive,
      features: {
        subAccounts: features.subAccounts || 0,
        bidsPerMonth: features.unlimitedBids ? -1 : features.bidsPerMonth || 0,
        unlimitedBids: features.unlimitedBids || false,
        notificationDelay: features.notificationDelay || 0,
      },
    });

    res.status(201).json({
      success: true,
      message: "Plan created successfully",
      plan,
    });
  } catch (error) {
    console.error("Create Plan Error:", error);
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        message: error.message || "Invalid Stripe request",
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create plan",
    });
  }
};



export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      price,       // will NOT be allowed
      currency,    // will NOT be allowed
      isActive,
      tags,
      features = {},
      descriptionPoints,
    } = req.body;

    const plan = await Plan.findOne({ _id: id, isDeleted: false });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // 🚫 Block price or currency changes
    if (
      (price !== undefined && price !== plan.price) ||
      (currency !== undefined && currency !== plan.currency)
    ) {
      return res.status(400).json({
        success: false,
        message: "Plan price and currency cannot be changed after creation",
      });
    }

    // Check for duplicate plan name (excluding current plan)
    if (name && name !== plan.name) {
      const existingPlan = await Plan.findOne({
        name,
        _id: { $ne: id },
        isDeleted: false,
      });

      if (existingPlan) {
        return res.status(400).json({
          success: false,
          message: `A plan with name "${name}" already exists. Please choose a different name.`,
        });
      }

      // Update Stripe product name
      await stripe.products.update(plan.stripeProductId, {
        name,
        metadata: {
          tags: tags ? JSON.stringify(tags) : JSON.stringify(plan.tags || []),
          features: JSON.stringify({
            ...plan.features.toObject(),
            ...features,
            // Ensure notificationDelay is updated in metadata
            notificationDelay: features.notificationDelay !== undefined 
              ? features.notificationDelay 
              : plan.features.notificationDelay,
          }),
        },
      });
    }

    // Update Stripe metadata even if name didn't change
    if (tags || features) {
      await stripe.products.update(plan.stripeProductId, {
        metadata: {
          tags: tags ? JSON.stringify(tags) : JSON.stringify(plan.tags || []),
          features: JSON.stringify({
            ...plan.features.toObject(),
            ...features,
            notificationDelay: features.notificationDelay !== undefined 
              ? features.notificationDelay 
              : plan.features.notificationDelay,
          }),
        },
      });
    }

    // ✅ Allowed updates
    plan.name = name ?? plan.name;
    plan.isActive = isActive ?? plan.isActive;
    plan.tags = tags !== undefined ? (Array.isArray(tags) ? tags : []) : plan.tags;
    plan.descriptionPoints = descriptionPoints ?? plan.descriptionPoints;

    plan.features = {
      subAccounts: features.subAccounts ?? plan.features.subAccounts,
      bidsPerMonth: features.unlimitedBids
        ? -1
        : features.bidsPerMonth ?? plan.features.bidsPerMonth,
      unlimitedBids: features.unlimitedBids ?? plan.features.unlimitedBids,
      notificationDelay: features.notificationDelay !== undefined 
        ? features.notificationDelay 
        : plan.features.notificationDelay,
    };

    await plan.save();

    return res.status(200).json({
      success: true,
      message: "Plan updated successfully",
      plan,
    });

  } catch (error) {
    console.error("Update Plan Error:", error);

    if (error.type === "StripeInvalidRequestError") {
      return res.status(400).json({
        success: false,
        message: error.message || "Invalid Stripe request",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update plan",
    });
  }
};






/* =====================================================
   SOFT DELETE PLAN
===================================================== */
export const softDeletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await Plan.findById(id);

    if (!plan || plan.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    plan.isDeleted = true;
    plan.isActive = false;
    plan.deletedAt = new Date();

    await plan.save();

    res.status(200).json({
      success: true,
      message: "Plan deleted (archived) successfully",
    });
  } catch (error) {
    console.error("Delete Plan Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete plan",
    });
  }
};




/* =====================================================
   TOGGLE ACTIVE / INACTIVE
   (Used by admin switch or action)
===================================================== */
export const togglePlanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const plan = await Plan.findOne({ _id: id, isDeleted: false });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    plan.isActive = Boolean(isActive);
    await plan.save();

    res.status(200).json({
      success: true,
      message: `Plan ${plan.isActive ? "activated" : "deactivated"} successfully`,
      plan,
    });
  } catch (error) {
    console.error("Toggle Plan Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update plan status",
    });
  }
};













/* =====================================================
   GET PLAN BY ID (PUBLIC)
   - Fetches a single plan by ID
   - Only returns active plans
===================================================== */
export const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID format",
      });
    }

    // Find plan by ID (isDeleted is excluded by default due to select: false in schema)
    const plan = await Plan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // Check if plan is active
    if (!plan.isActive) {
      return res.status(403).json({
        success: false,
        message: "This plan is currently not available",
      });
    }
    res.status(200).json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("❌ Fetch Plan By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch plan details",
      error: error.message,
    });
  }
};