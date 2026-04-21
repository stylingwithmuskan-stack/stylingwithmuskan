import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, API_BASE_URL } from "@/modules/user/lib/api";
import { io } from "socket.io-client";

const BookingContext = createContext(undefined);

export const useBookings = () => {
  const context = useContext(BookingContext);
  if (!context) throw new Error("useBookings must be used within a BookingProvider");
  return context;
};

export const BookingProvider = ({ children }) => {
  const [bookings, setBookings] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEnquiries, setLoadingEnquiries] = useState(true);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const { bookings } = await api.bookings.list(1, 50);
      const normalized = (bookings || [])
        .map((b) => ({ ...b, id: b.id || b._id }))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setBookings(normalized);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEnquiries = useCallback(async () => {
    setLoadingEnquiries(true);
    try {
      const { enquiries } = await api.bookings.custom.list();
      setEnquiries(enquiries || []);
    } catch {
      setEnquiries([]);
    } finally {
      setLoadingEnquiries(false);
    }
  }, []);

  const acceptCustomEnquiry = async (id) => {
    await api.bookings.custom.userAccept(id);
    await loadEnquiries();
    // Booking may appear later after admin final approve.
    await loadBookings();
  };

  const rejectCustomEnquiry = async (id) => {
    await api.bookings.custom.userReject(id);
    await loadEnquiries();
    await loadBookings();
  };

  const payAdvanceForCustomEnquiry = async (id, amount) => {
    await api.bookings.custom.advancePaid(id, amount);
    await loadEnquiries();
    await loadBookings();
  };

  const cancelBooking = async (id) => {
    try {
      await api.bookings.cancel(id);
      await loadBookings();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  useEffect(() => {
    loadBookings();
    loadEnquiries();

    // Poll for status updates every 15 seconds (fallback)
    const interval = setInterval(() => {
      loadBookings();
      loadEnquiries();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Socket sync logic separated for reactivity
  useEffect(() => {
    const token = localStorage.getItem("swm_token");
    if (!token) return;

    console.log("[BookingSync] 🔄 Connecting socket for real-time updates...");
    const socket = io(`${API_BASE_URL}/bookings`, {
      auth: { token },
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => console.log("[BookingSync] ✅ Socket connected"));
    
    // Listen for both global status updates and specific booking updates
    const handleUpdate = (payload) => {
      console.log("[BookingSync] 🔔 Status update received:", payload);
      loadBookings();
      loadEnquiries();
    };

    socket.on("status:update", handleUpdate);
    socket.on("booking:update", handleUpdate);

    return () => {
      socket.disconnect();
      console.log("[BookingSync] 🛑 Socket disconnected");
    };
  }, [loadBookings, loadEnquiries]);

  return (
    <BookingContext.Provider
      value={{
        bookings,
        enquiries,
        loading,
        loadingEnquiries,
        loadBookings,
        loadEnquiries,
        acceptCustomEnquiry,
        rejectCustomEnquiry,
        payAdvanceForCustomEnquiry,
        cancelBooking,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
};
