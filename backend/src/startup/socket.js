import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server as IOServer } from "socket.io";
import { ALLOWED_ORIGINS, JWT_SECRET } from "../config.js";
import Booking from "../models/Booking.js";
import ProviderAccount from "../models/ProviderAccount.js";

let io = null;

export function initSocket(httpServer) {
  if (!io) {
    io = new IOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          const allowed = (ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
          if (!origin || allowed.includes("*") || allowed.includes(origin) || allowed.length === 0) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
        credentials: true,
        methods: ["GET", "POST"]
      },
      transports: ["polling", "websocket"]
    });

    // Bookings namespace
    io.of("/bookings").use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token || "";
        if (!token) return next(new Error("Unauthorized"));
        const payload = jwt.verify(token, JWT_SECRET);
        socket.data.userId = payload.sub;
        next();
      } catch {
        next(new Error("Unauthorized"));
      }
    }).on("connection", (socket) => {
      socket.on("join:booking", async (payload) => {
        try {
          const bookingId = String(payload?.bookingId || "").trim();
          if (!mongoose.isValidObjectId(bookingId)) return;
          const booking = await Booking.findOne({ _id: bookingId, customerId: socket.data.userId }).select("_id").lean();
          if (!booking) {
            socket.emit("booking:error", { error: "Unauthorized" });
            return;
          }
          socket.join(`booking:${bookingId}`);
          socket.emit("booking:joined", { bookingId });
        } catch {}
      });
      socket.on("leave:booking", (payload) => {
        const bookingId = String(payload?.bookingId || "").trim();
        if (!bookingId) return;
        socket.leave(`booking:${bookingId}`);
      });
    });

    // Provider location tracking namespace
    io.of("/provider-location").use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token || "";
        if (!token) return next(new Error("Unauthorized"));
        const payload = jwt.verify(token, JWT_SECRET);
        socket.data.providerId = payload.sub;
        socket.data.role = payload.role || "provider";
        next();
      } catch {
        next(new Error("Unauthorized"));
      }
    }).on("connection", (socket) => {
      console.log(`[Socket] Provider ${socket.data.providerId} connected for location tracking`);

      // Provider sends location updates
      socket.on("location:update", async (payload) => {
        try {
          const { lat, lng } = payload;
          
          // Validate coordinates
          if (typeof lat !== 'number' || typeof lng !== 'number') {
            socket.emit("location:error", { error: "Invalid coordinates" });
            return;
          }

          if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            socket.emit("location:error", { error: "Coordinates out of range" });
            return;
          }

          // Update provider location in database
          const provider = await ProviderAccount.findByIdAndUpdate(
            socket.data.providerId,
            {
              currentLocation: { lat, lng },
              lastLocationUpdate: new Date()
            },
            { new: true }
          ).select("_id name currentLocation").lean();

          if (!provider) {
            socket.emit("location:error", { error: "Provider not found" });
            return;
          }

          // Broadcast location to users tracking this provider
          socket.broadcast.emit(`provider:${socket.data.providerId}:location`, {
            providerId: socket.data.providerId,
            location: { lat, lng },
            timestamp: new Date()
          });

          // Acknowledge update
          socket.emit("location:updated", {
            success: true,
            location: { lat, lng },
            timestamp: new Date()
          });

          console.log(`[Socket] Provider ${socket.data.providerId} location updated: (${lat}, ${lng})`);
        } catch (error) {
          console.error('[Socket] Error updating provider location:', error);
          socket.emit("location:error", { error: "Failed to update location" });
        }
      });

      // User/Admin subscribes to provider location updates
      socket.on("track:provider", (payload) => {
        try {
          const providerId = String(payload?.providerId || "").trim();
          if (!mongoose.isValidObjectId(providerId)) {
            socket.emit("track:error", { error: "Invalid provider ID" });
            return;
          }

          socket.join(`track:${providerId}`);
          socket.emit("track:started", { providerId });
          console.log(`[Socket] User tracking provider ${providerId}`);
        } catch (error) {
          socket.emit("track:error", { error: "Failed to start tracking" });
        }
      });

      // User/Admin unsubscribes from provider location updates
      socket.on("untrack:provider", (payload) => {
        const providerId = String(payload?.providerId || "").trim();
        if (!providerId) return;
        socket.leave(`track:${providerId}`);
        socket.emit("track:stopped", { providerId });
        console.log(`[Socket] User stopped tracking provider ${providerId}`);
      });

      socket.on("disconnect", () => {
        console.log(`[Socket] Provider ${socket.data.providerId} disconnected from location tracking`);
      });
    });
  }
  return io;
}

export function getIO() {
  return io;
}
