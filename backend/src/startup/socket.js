import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server as IOServer } from "socket.io";
import { ALLOWED_ORIGINS, JWT_SECRET } from "../config.js";
import Booking from "../models/Booking.js";

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
            console.warn(`[Socket CORS] Rejected origin: ${origin}`);
            callback(new Error("Not allowed by CORS"));
          }
        },
        credentials: true,
        methods: ["GET", "POST"]
      },
      transports: ["polling", "websocket"]
    });

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
  }
  return io;
}

export function getIO() {
  return io;
}
