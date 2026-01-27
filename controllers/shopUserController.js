import ShopUser from "../models/shopUserModel.js";
import Shop from "../models/shopModel.js";






/**
 * Create sub-account
 * Owner only
 */
export const createChildAccount = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 🔐 Only owner
        if (req.user.role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Only shop owner can create sub-accounts",
            });
        }

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required",
            });
        }

        // Fetch shop with populated plan
        const shop = await Shop.findById(req.user.shopId).populate('plan');
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: "Shop not found",
            });
        }

        // 🔒 Subscription / access check
        const blockedStatuses = ["inactive", "canceled", "incomplete_expired", "unpaid", "paused"];
        if (shop.isBlocked || blockedStatuses.includes(shop.subscriptionStatus)) {
            return res.status(403).json({
                success: false,
                message: shop.isBlocked
                    ? "Your account has been blocked by admin."
                    : "Your subscription is not active. Please update or renew your plan.",
            });
        }

        // Check if shop's plan allows sub-accounts
        if (!shop.plan) {
            return res.status(400).json({
                success: false,
                message: "Your current plan does not support sub-accounts",
            });
        }

        const subAccountLimit = shop.plan.features?.subAccounts || 0;
        if (subAccountLimit <= 0) {
            return res.status(400).json({
                success: false,
                message: "Your current plan does not support sub-accounts",
            });
        }

        // 🧮 Count existing sub-accounts
        const childCount = await ShopUser.countDocuments({
            shop: shop._id,
            role: { $ne: "owner" },
        });

        if (childCount >= subAccountLimit) {
            return res.status(400).json({
                success: false,
                message: `You can only create up to ${subAccountLimit} sub-accounts with your current plan`,
            });
        }

        // ❌ Prevent duplicate email in same shop
        const existingUser = await ShopUser.findOne({
            shop: shop._id,
            email: email.toLowerCase(),
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User with this email already exists",
            });
        }

        // ✅ Create sub-account user
        const childUser = await ShopUser.create({
            shop: shop._id,
            name,
            email: email.toLowerCase(),
            password,
            role: "staff",
            permissions: {
                viewDashboard: true,
                manageBids: true,
                manageProfile: true,
                manageBilling: false,
                manageSubscription: false,
            },
            isActive: true,
            createdBy: req.user.userId,
        });

        res.status(201).json({
            success: true,
            message: "Sub-account created successfully",
            data: {
                _id: childUser._id,
                name: childUser.name,
                email: childUser.email,
                isActive: childUser.isActive,
                createdAt: childUser.createdAt,
                role: childUser.role,
            },
        });
    } catch (error) {
        console.error("❌ Create sub-account error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create sub-account",
        });
    }
};






/**
 * Delete sub-account
 * Owner only
 */
export const deleteChildAccount = async (req, res) => {
    try {
        const { userId } = req.params;

        if (req.user.role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Only owner can delete sub-accounts",
            });
        }

        const user = await ShopUser.findOne({
            _id: userId,
            shop: req.user.shopId,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (user.role === "owner") {
            return res.status(400).json({
                success: false,
                message: "Owner account cannot be deleted",
            });
        }

        await user.deleteOne();

        res.status(200).json({
            success: true,
            message: "Sub-account deleted successfully",
        });
    } catch (error) {
        console.error("❌ Delete sub-account error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete sub-account",
        });
    }
};



/**
 * Toggle sub-account status (enable/disable)
 * Owner only
 */
export const toggleChildAccountStatus = async (req, res) => {
    try {
        const { userId } = req.params;

        // Check if user is owner
        if (req.user.role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Only owner can enable/disable accounts",
            });
        }

        // Find the user to toggle
        const user = await ShopUser.findOne({
            _id: userId,
            shop: req.user.shopId,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Check if trying to disable owner
        if (user.role === "owner") {
            return res.status(400).json({
                success: false,
                message: "Owner account cannot be disabled",
            });
        }

        // 🔥 NEW: Get shop with plan to check sub-account limits
        const shop = await Shop.findById(req.user.shopId)
            .populate('plan', 'name features.subAccounts');
        
        if (!shop || !shop.plan) {
            return res.status(400).json({
                success: false,
                message: "Shop does not have an active subscription plan",
            });
        }

        const plan = shop.plan;
        const maxSubAccounts = plan.features?.subAccounts || 0;

        // Count current active sub-accounts (excluding owner)
        const activeSubAccountsCount = await ShopUser.countDocuments({
            shop: req.user.shopId,
            isActive: true,
            role: { $ne: "owner" }
        });

        // If trying to ENABLE the user (changing from disabled to active)
        if (!user.isActive) {
            // Check if max limit would be exceeded
            if (activeSubAccountsCount >= maxSubAccounts) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot enable more sub-accounts. Your "${plan.name}" plan allows maximum ${maxSubAccounts} sub-account${maxSubAccounts !== 1 ? 's' : ''}.`,
                    data: {
                        maxAllowed: maxSubAccounts,
                        currentActive: activeSubAccountsCount,
                        planName: plan.name,
                        errorType: "LIMIT_EXCEEDED"
                    }
                });
            }
        }

        // If trying to DISABLE the user (changing from active to disabled)
        // No limit check needed for disabling

        // Toggle the status
        user.isActive = !user.isActive;
        await user.save();

        // Get updated count after toggle
        const updatedActiveCount = await ShopUser.countDocuments({
            shop: req.user.shopId,
            isActive: true,
            role: { $ne: "owner" }
        });

        res.status(200).json({
            success: true,
            message: `User ${user.isActive ? "enabled" : "disabled"} successfully`,
            data: {
                _id: user._id,
                isActive: user.isActive,
                name: user.name || user.email,
                role: user.role,
                // Include limit information for frontend
                limitInfo: {
                    maxSubAccounts: maxSubAccounts,
                    currentActive: updatedActiveCount,
                    remaining: Math.max(0, maxSubAccounts - updatedActiveCount),
                    planName: plan.name
                }
            },
        });
    } catch (error) {
        console.error("❌ Toggle account error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update account status",
        });
    }
};





/**
 * Get all sub-accounts
 * Owner only
 */
export const getChildAccounts = async (req, res) => {
    try {
        // 🔐 Only owner
        if (req.user.role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Only shop owner can view sub-accounts",
            });
        }

        // Fetch shop with populated plan
        const shop = await Shop.findById(req.user.shopId).populate('plan');
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: "Shop not found",
            });
        }

        // 🔒 Subscription / access check
        const allowedStatuses = ["active", "trialing", "past_due"];
        const blockedStatuses = ["inactive", "canceled", "incomplete_expired", "unpaid", "paused"];
        if (shop.isBlocked || blockedStatuses.includes(shop.subscriptionStatus)) {
            return res.status(403).json({
                success: false,
                message: shop.isBlocked
                    ? "Your account has been blocked by admin."
                    : "Your subscription is not active. Please update or renew your plan.",
            });
        }

        // Get sub-account limit from plan features
        const subAccountLimit = shop.plan?.features?.subAccounts || 0;

        // 🧮 Fetch all sub-accounts
        const subAccounts = await ShopUser.find({
            shop: shop._id,
            role: { $ne: "owner" },
        }).sort({ createdAt: -1 });

        // Calculate stats
        const activeCount = subAccounts.filter(acc => acc.isActive).length;

        res.json({
            success: true,
            data: subAccounts.map(acc => ({
                _id: acc._id,
                name: acc.name,
                email: acc.email,
                isActive: acc.isActive,
                createdAt: acc.createdAt,
                lastLogin: acc.lastLogin,
                role: acc.role,
                permissions: acc.permissions,
            })),
            stats: {
                total: subAccounts.length,
                active: activeCount,
                available: Math.max(0, subAccountLimit - subAccounts.length),
                limit: subAccountLimit,
            },
            planDetails: {
                planName: shop.plan?.name || 'No Plan',
                subAccountLimit: subAccountLimit,
                canCreateSubAccounts: subAccountLimit > 0,
            }
        });

    } catch (error) {
        console.error("❌ Get sub-accounts error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch sub-accounts",
        });
    }
};




/**
 * Update sub-account
 * Owner only
 */
export const updateChildAccount = async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, email, password } = req.body;

        // 🔐 Only owner
        if (req.user.role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Only shop owner can update sub-accounts",
            });
        }

        const user = await ShopUser.findOne({
            _id: userId,
            shop: req.user.shopId,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Sub-account not found",
            });
        }

        if (user.role === "owner") {
            return res.status(400).json({
                success: false,
                message: "Owner account cannot be updated this way",
            });
        }

        // Check if email is being changed and if it's already in use
        if (email && email !== user.email) {
            const existingUser = await ShopUser.findOne({
                shop: req.user.shopId,
                email: email.toLowerCase(),
                _id: { $ne: userId },
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Email already in use by another account",
                });
            }
            user.email = email.toLowerCase();
        }

        // Update name if provided
        if (name && name.trim() !== '') {
            user.name = name.trim();
        }

        // Update password if provided and not empty
        if (password && password.trim() !== '') {
            user.password = password;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: "Sub-account updated successfully",
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                isActive: user.isActive,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("❌ Update sub-account error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update sub-account",
        });
    }
};
