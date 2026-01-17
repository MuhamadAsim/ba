import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const shopUserSchema = new mongoose.Schema(
  {
    // 🔗 Relation
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },

    // 🔐 Auth
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    // 🧑 Role
    role: {
      type: String,
      enum: ["manager", "staff"],
      default: "staff",
    },

    // 🔒 Permissions (explicit = secure)
    permissions: {
      viewBids: { type: Boolean, default: true },
      manageBids: { type: Boolean, default: false },
      manageProfile: { type: Boolean, default: false },
      viewAnalytics: { type: Boolean, default: false },

      // ❌ NEVER for child users
      manageBilling: { type: Boolean, default: false },
      manageSubscription: { type: Boolean, default: false },
    },

    // 📌 Status
    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    // 👤 Audit
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShopUser",
      default: null,
    },
  },
  { timestamps: true }
);

/* ================= PASSWORD ================= */

shopUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

shopUserSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

/* ================= INDEXES ================= */

shopUserSchema.index({ shop: 1, email: 1 }, { unique: true });
shopUserSchema.index({ role: 1 });
shopUserSchema.index({ isActive: 1 });

const ShopUser = mongoose.model("ShopUser", shopUserSchema);

export default ShopUser;
