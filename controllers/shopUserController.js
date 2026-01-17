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

        const shop = await Shop.findById(req.user.shopId);
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: "Shop not found",
            });
        }

        // 🧮 Count existing sub-accounts
        const childCount = await ShopUser.countDocuments({
            shop: shop._id,
            role: { $ne: "owner" },
        });

        if (childCount >= shop.maxChildAccounts) {
            return res.status(400).json({
                success: false,
                message: `You can only create ${shop.maxChildAccounts} sub-accounts`,
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

        if (req.user.role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Only owner can enable/disable accounts",
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
                message: "Owner account cannot be disabled",
            });
        }

        user.isActive = !user.isActive;
        await user.save();

        res.status(200).json({
            success: true,
            message: `User ${user.isActive ? "enabled" : "disabled"} successfully`,
            data: {
                _id: user._id,
                isActive: user.isActive,
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
 * Get all sub-accounts for the shop
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

        const shop = await Shop.findById(req.user.shopId);
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: "Shop not found",
            });
        }

        // Get all sub-accounts (not owner)
        const childAccounts = await ShopUser.find({
            shop: shop._id,
            role: { $ne: "owner" },
        })
        .select('-password -permissions') // Don't send sensitive data
        .sort({ createdAt: -1 });

        // Format the response
        const formattedAccounts = childAccounts.map(account => ({
            _id: account._id,
            name: account.name || account.email.split('@')[0],
            email: account.email,
            isActive: account.isActive,
            createdAt: account.createdAt,
            lastLogin: account.lastLogin,
            role: account.role,
        }));

        // Get stats
        const activeCount = childAccounts.filter(acc => acc.isActive).length;
        const maxAllowed = shop.maxChildAccounts || 2;

        res.status(200).json({
            success: true,
            data: formattedAccounts,
            stats: {
                total: childAccounts.length,
                active: activeCount,
                available: maxAllowed - childAccounts.length,
                maxAllowed: maxAllowed,
            },
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
 * Get single sub-account details
 * Owner only
 */
export const getChildAccount = async (req, res) => {
    try {
        const { userId } = req.params;

        // 🔐 Only owner
        if (req.user.role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Only shop owner can view sub-accounts",
            });
        }

        const user = await ShopUser.findOne({
            _id: userId,
            shop: req.user.shopId,
            role: { $ne: "owner" },
        })
        .select('-password')
        .populate('createdBy', 'email name');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Sub-account not found",
            });
        }

        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                isActive: user.isActive,
                role: user.role,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin,
                createdBy: user.createdBy,
            },
        });
    } catch (error) {
        console.error("❌ Get sub-account error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch sub-account",
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

/**
 * Get sub-account permissions
 * For sub-account user
 */
export const getMyPermissions = async (req, res) => {
    try {
        const user = await ShopUser.findById(req.user.userId)
            .select('permissions role');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.status(200).json({
            success: true,
            data: {
                permissions: user.permissions,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("❌ Get permissions error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch permissions",
        });
    }
};