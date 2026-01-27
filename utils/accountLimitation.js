
import ShopUser from "../models/shopUserModel.js";



export const enforceSubAccountLimit = async ({
  shopId,
  oldPlan,
  newPlan,
}) => {
  // Unlimited → always OK
  if (newPlan.features.subAccounts === -1) return;

  const allowed = newPlan.features.subAccounts;

  // Count active sub-accounts (exclude owner/creator if needed)
  const activeUsers = await ShopUser.find({
    shop: shopId,
    isActive: true,
  }).sort({
    role: 1,          // staff first
    createdAt: -1,    // newest first
  });

  // If within limit → do nothing
  if (activeUsers.length <= allowed) return;

  const excess = activeUsers.length - allowed;

  // Pick users to disable (never disable managers if possible)
  const usersToDisable = [];

  for (const user of activeUsers) {
    if (usersToDisable.length >= excess) break;
    if (user.role === "staff") {
      usersToDisable.push(user._id);
    }
  }

  // Still excess? Disable managers (last resort)
  if (usersToDisable.length < excess) {
    for (const user of activeUsers) {
      if (usersToDisable.length >= excess) break;
      if (user.role === "manager") {
        usersToDisable.push(user._id);
      }
    }
  }

  if (usersToDisable.length) {
    await ShopUser.updateMany(
      { _id: { $in: usersToDisable } },
      { $set: { isActive: false } }
    );
  }
};