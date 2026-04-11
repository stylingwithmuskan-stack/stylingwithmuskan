import mongoose from "mongoose";
import TrainingVideo from "./src/models/TrainingVideo.js";
import { MONGO_URI } from "./src/config.js";

const DEFAULT_VIDEOS = [
  {
    title: "Advanced Hair Styling Techniques",
    category: "Hair Styling",
    duration: "15:30",
    status: "New",
    thumbnail: "https://images.unsplash.com/photo-1560869713-7d0a294308a3?auto=format&fit=crop&w=800&q=80",
    provider: "StylingwithMuskan Academy",
    description: "Learn the latest professional hair styling techniques including 3D braiding and advanced blowouts.",
    views: "1.2k",
    difficulty: "Advanced",
    isActive: true
  },
  {
    title: "Bridal Makeup Masterclass 2026",
    category: "Makeup",
    duration: "45:00",
    status: "New",
    thumbnail: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80",
    provider: "Senior Artist - Rhea",
    description: "A comprehensive guide to long-lasting bridal makeup for various skin types and tones.",
    views: "3.5k",
    difficulty: "Intermediate",
    isActive: true
  },
  {
    title: "Hygiene & Sanitization Standards",
    category: "Hygiene",
    duration: "12:15",
    status: "Mandatory",
    thumbnail: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
    provider: "SWM Compliance Team",
    description: "Official SWM standards for maintaining a clean and safe workspace during every appointment.",
    views: "10k+",
    difficulty: "Beginner",
    isActive: true
  }
];

async function seed() {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(MONGO_URI);
    console.log("Clearing existing training videos...");
    await TrainingVideo.deleteMany({});
    console.log("Seeding training videos...");
    await TrainingVideo.insertMany(DEFAULT_VIDEOS);
    console.log("Seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
