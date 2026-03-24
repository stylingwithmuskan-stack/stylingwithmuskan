import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { ALLOWED_ORIGINS, JWT_SECRET } from "../config.js";
import Booking from "../models/Booking.js";

let io = null;

export function initSocket(httpServer) {
  let IOServer;
  try {
    IOServer = (globalThis.__SOCKET_IO__ || null) || null;
  } catch {}
  const makeServer = async () => {
    try {
      const mod = await import("socket.io");
      IOServer = mod.Server;
      globalThis.__SOCKET_IO__ = IOServer;
    } catch (e) {
      console.warn("[Socket] socket.io not installed, skipping WebSocket init");
      return null;
    }
    return new IOServer(httpServer, {
      cors: {
        origin: (ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean),
        credentials: true,
      },
    });
  };
  io = io || null;
  if (!io) {
    // fire and forget
    makeServer().then((server) => {
      if (!server) return;
      io = server;
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
    }).catch(() => {});
  }
  return io;
}

export function getIO() {
  return io;
}
