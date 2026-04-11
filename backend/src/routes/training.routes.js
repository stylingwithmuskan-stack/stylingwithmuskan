import { Router } from "express";
import TrainingVideo from "../models/TrainingVideo.js";
import { requireRole } from "../middleware/roles.js";
import { upload } from "../middleware/upload.js";
import { uploadBuffer } from "../startup/cloudinary.js";

const router = Router();

router.post("/upload-thumbnail", requireRole("admin"), upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image provided" });
    const result = await uploadBuffer(req.file.buffer, "training_thumbnails");
    res.json({ url: result.secure_url });
  } catch (error) {
    console.error("Upload thumbnail error:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// =======================
// ADMIN ROUTES
// =======================

router.get("/admin", requireRole("admin"), async (req, res) => {
  try {
    const videos = await TrainingVideo.find().sort({ createdAt: -1 });
    res.json(videos);
  } catch (error) {
    console.error("Fetch training videos error:", error);
    res.status(500).json({ error: "Failed to fetch training videos" });
  }
});

router.post("/admin", requireRole("admin"), async (req, res) => {
  try {
    const newVideo = await TrainingVideo.create(req.body);
    res.status(201).json(newVideo);
  } catch (error) {
    console.error("Create training video error:", error);
    res.status(500).json({ error: "Failed to create training video" });
  }
});

router.put("/admin/:id", requireRole("admin"), async (req, res) => {
  try {
    const updated = await TrainingVideo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Video not found" });
    res.json(updated);
  } catch (error) {
    console.error("Update training video error:", error);
    res.status(500).json({ error: "Failed to update training video" });
  }
});

router.delete("/admin/:id", requireRole("admin"), async (req, res) => {
  try {
    const deleted = await TrainingVideo.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Video not found" });
    res.json({ message: "Video deleted successfully" });
  } catch (error) {
    console.error("Delete training video error:", error);
    res.status(500).json({ error: "Failed to delete training video" });
  }
});

// =======================
// PROVIDER ROUTES
// =======================

router.get("/provider", requireRole("provider"), async (req, res) => {
  try {
    const videos = await TrainingVideo.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(videos);
  } catch (error) {
    console.error("Provider fetch training videos error:", error);
    res.status(500).json({ error: "Failed to fetch training videos" });
  }
});

export default router;
