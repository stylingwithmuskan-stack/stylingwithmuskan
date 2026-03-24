import mongoose from "mongoose";

const SpotlightSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    title: { type: String, default: "" },
    category: { type: String, default: "" },
    video: { type: String, default: "" }, // mp4 URL
    poster: { type: String, default: "" }, // image URL
    gender: { type: String, default: "" }, // "women" | "men" | "" (all)
    priority: { type: Number, default: 1 },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const GalleryItemSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    title: { type: String, default: "" },
    image: { type: String, default: "" }, // image URL
    priority: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const TestimonialSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    name: { type: String, default: "" },
    rating: { type: Number, default: 5 },
    feedback: { type: String, default: "" },
    image: { type: String, default: "" }, // image URL
    priority: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Spotlight = mongoose.models.Spotlight || mongoose.model("Spotlight", SpotlightSchema);
export const GalleryItem = mongoose.models.GalleryItem || mongoose.model("GalleryItem", GalleryItemSchema);
export const Testimonial = mongoose.models.Testimonial || mongoose.model("Testimonial", TestimonialSchema);

