import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/modules/user/lib/api";

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

  const loadBookings = async () => {
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
  };

  const loadEnquiries = async () => {
    setLoadingEnquiries(true);
    try {
      const { enquiries } = await api.bookings.custom.list();
      setEnquiries(enquiries || []);
    } catch {
      setEnquiries([]);
    } finally {
      setLoadingEnquiries(false);
    }
  };

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
  }, []);

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
