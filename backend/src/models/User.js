import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema(
  {
    houseNo: String,
    landmark: String,
    area: String,
    city: { type: String, default: "" },
    cityId: { type: String, default: "" },
    zone: { type: String, default: "" },
    zoneId: { type: String, default: "" },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    insideServiceArea: { type: Boolean, default: true },
    resolvedAt: { type: Date, default: null },
    type: { type: String, enum: ["home", "work", "other"], default: "home" },
  },
  { _id: true, timestamps: true }
);

const UserSchema = new mongoose.Schema(
  {
    phone: { type: String, unique: true, required: true },
    name: { type: String, default: "" },
    referralCode: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },
    avatar: { type: String, default: "" },
    addresses: [AddressSchema],
    favorites: { type: [String], default: [] },
    status: { type: String, enum: ["active", "blocked"], default: "active" },
    codDisabled: { type: Boolean, default: false },
    codDisabledAt: { type: Date, default: null },
    codDisabledBy: { type: String, default: "" },
    wallet: {
      balance: { type: Number, default: 0 },
      transactions: [
        {
          title: { type: String, default: "" },
          amount: { type: Number, required: true },
          type: { type: String, enum: ["credit", "debit", "refund", "topup", "booking_payment"], required: true },
          at: { type: Date, default: Date.now },
          balanceAfter: { type: Number, default: 0 },
          description: { type: String, default: "" },
          bookingId: { type: String, default: "" },
          refundId: { type: String, default: "" },
        },
      ],
    },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
