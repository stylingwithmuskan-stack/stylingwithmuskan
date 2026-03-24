import mongoose from "mongoose";

const EnquiryItemSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    category: String,
    serviceType: String,
    quantity: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const CustomEnquirySchema = new mongoose.Schema(
  {
    userId: String,
    name: String,
    phone: String,
    eventType: String,
    noOfPeople: String,
    peopleCount: { type: Number, default: 0 },
    scheduledAt: { date: String, timeSlot: String },
    items: [EnquiryItemSchema],
    notes: String,
    address: { houseNo: String, area: String, landmark: String, lat: Number, lng: Number, city: String },
    status: { type: String, default: "enquiry_created" }, // enquiry_created -> quote_submitted -> admin_approved -> waiting_for_customer_payment -> advance_paid -> provider_assigned -> service_completed
    quote: {
      items: [EnquiryItemSchema],
      totalAmount: { type: Number, default: 0 },
      discountPrice: { type: Number, default: 0 },
      notes: String,
      prebookAmount: { type: Number, default: 0 },
      totalServiceTime: { type: String, default: "" },
      expiryAt: { type: Date, default: null },
    },
    paymentStatus: { type: String, default: "pending" }, // pending | paid | refunded
    prebookPaidAt: { type: Date, default: null },
    prebookAmountPaid: { type: Number, default: 0 },
    bookingId: { type: String, default: "" },
    maintainerProvider: String,
    assignedProvider: { type: String, default: "" },
    providerAssignedAt: { type: Date, default: null },
    teamMembers: [
      {
        id: String,
        name: String,
        serviceType: String,
      },
    ],
    timeline: [
      {
        at: { type: Date, default: Date.now },
        action: String,
        meta: Object,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.CustomEnquiry || mongoose.model("CustomEnquiry", CustomEnquirySchema);
