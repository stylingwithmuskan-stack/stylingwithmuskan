import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { ProviderAuthContext } from "./ProviderAuthContext";
import { api } from "@/modules/user/lib/api";

const ProviderBookingContext = createContext(undefined);

export const useProviderBookings = () => {
    const context = useContext(ProviderBookingContext);
    if (!context) throw new Error("useProviderBookings must be used within ProviderBookingProvider");
    return context;
};

const STORAGE_KEY = null;

export const ProviderBookingProvider = ({ children }) => {
    const [bookings, setBookings] = useState([]);
    const [nowMs, setNowMs] = useState(Date.now());

    // Fast Refresh can briefly remount this provider before the auth provider rebinds.
    // Fall back to an empty auth state instead of crashing the entire app tree.
    const providerAuth = useContext(ProviderAuthContext);
    const provider = providerAuth?.provider || null;

    const providerId = provider?._id || provider?.id;
    const normalizeBooking = useCallback((b) => ({ ...b, id: b?.id || b?._id }), []);
    const acceptWindowMs = 10 * 60 * 1000;

    const refreshBookings = useCallback(async () => {
        try {
            let pid = providerId;
            if (!pid && provider?.phone) {
                const { provider: fresh } = await api.provider.me(provider.phone);
                pid = fresh?._id || fresh?.id || "";
            }
            if (!pid) {
                setBookings([]);
                return;
            }
            const { bookings } = await api.provider.bookings(pid);
            const normalized = (bookings || [])
                .map(normalizeBooking)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setBookings(normalized);
        } catch {
            setBookings([]);
        }
    }, [normalizeBooking, providerId, provider?.phone]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                let pid = providerId;
                if (!pid && provider?.phone) {
                    const { provider: fresh } = await api.provider.me(provider.phone);
                    pid = fresh?._id || fresh?.id || "";
                }
                if (!pid) return;
                const { bookings } = await api.provider.bookings(pid);
                const normalized = (bookings || []).map(normalizeBooking).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                if (!cancelled) setBookings(normalized);
            } catch {
                if (!cancelled) setBookings([]);
            }
        })();
        return () => { cancelled = true; };
    }, [providerId, provider?.phone]);

    useEffect(() => {
        const interval = setInterval(() => {
            setNowMs(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!providerId && !provider?.phone) return;
        const interval = setInterval(() => {
            refreshBookings();
        }, 30000);
        return () => clearInterval(interval);
    }, [providerId, provider?.phone, refreshBookings]);

    const isExpiredAssignmentForCurrentProvider = useCallback((booking) => {
        const normalizedStatus = String(booking?.status || "").toLowerCase();
        if (!["incoming", "pending", "final_approved"].includes(normalizedStatus)) return false;

        if (booking?.expiresAt) {
            const expiresAtMs = new Date(booking.expiresAt).getTime();
            return Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;
        }

        if (booking?.lastAssignedAt) {
            const lastAssignedMs = new Date(booking.lastAssignedAt).getTime();
            return Number.isFinite(lastAssignedMs) && (nowMs - lastAssignedMs) >= acceptWindowMs;
        }

        return false;
    }, [nowMs]);

    // Only show bookings explicitly assigned to this provider
    const myBookings = bookings.filter((b) => {
        const belongsToProvider = String(b.assignedProvider || "") === String(providerId || "");
        if (!belongsToProvider) return false;
        return !isExpiredAssignmentForCurrentProvider(b);
    });

    const incomingBookings = myBookings.filter(b => b.status === "incoming" || b.status === "pending" || b.status === "Pending" || b.status === "final_approved");
    const pendingBookings = myBookings.filter(b => b.status === "pending" || b.status === "Pending" || b.status === "final_approved");
    const activeBookings = myBookings.filter(b => ["accepted", "travelling", "arrived", "in_progress", "vendor_assigned", "vendor_reassigned"].includes(b.status));
    const assignedBookings = myBookings.filter(b => b.status === "vendor_assigned" || b.status === "vendor_reassigned");
    const completedBookings = myBookings.filter(b => b.status === "completed");
    const cancelledBookings = myBookings.filter(b => ["cancelled", "rejected", "provider_cancelled"].includes(b.status));

    const acceptBooking = useCallback(async (id) => {
        try {
            const { booking } = await api.provider.updateBookingStatus(id, "accepted");
            const normalized = normalizeBooking(booking);
            setBookings(prev => prev.map(b => b._id === normalized._id ? normalized : b));
        } catch (e) {
            refreshBookings();
            alert(e?.message || "Failed to accept");
        }
    }, [normalizeBooking, refreshBookings]);

    const rejectBooking = useCallback(async (id) => {
        try {
            const { booking } = await api.provider.updateBookingStatus(id, "rejected");
            const normalized = normalizeBooking(booking);
            setBookings(prev => prev.map(b => b._id === normalized._id ? normalized : b));
        } catch (e) {
            refreshBookings();
            alert(e?.message || "Failed to reject");
        }
    }, [normalizeBooking, refreshBookings]);

    const updateBookingStatus = useCallback(async (id, status) => {
        try {
            const { booking } = await api.provider.updateBookingStatus(id, status);
            const normalized = normalizeBooking(booking);
            setBookings(prev => prev.map(b => b._id === normalized._id ? normalized : b));
        } catch (e) {
            refreshBookings();
            alert(e?.message || "Failed to update");
        }
    }, [normalizeBooking, refreshBookings]);

    const requestPayment = useCallback(async (id) => {
        try {
            const { booking } = await api.provider.requestPayment(id);
            const normalized = normalizeBooking(booking);
            setBookings(prev => prev.map(b => b._id === normalized._id ? normalized : b));
            return normalized;
        } catch (e) {
            alert(e?.message || "Failed to request payment");
            return null;
        }
    }, [normalizeBooking]);

    const cancelBooking = useCallback(async (id) => {
        try {
            const { booking } = await api.provider.updateBookingStatus(id, "cancelled");
            const normalized = normalizeBooking(booking);
            setBookings(prev => prev.map(b => b._id === normalized._id ? normalized : b));
        } catch (e) {
            alert(e?.message || "Failed to cancel");
        }
    }, [normalizeBooking]);

    const verifyOTP = useCallback(async (id, enteredOtp) => {
        const { booking } = await api.provider.verifyBookingOtp(id, enteredOtp);
        const normalized = normalizeBooking(booking);
        setBookings(prev => prev.map(b => b._id === normalized._id ? normalized : b));
        return true;
    }, [normalizeBooking]);

    const uploadImages = useCallback(async (id, type, files) => {
        const { booking } = await api.provider.uploadBookingImages(id, type, files);
        const normalized = normalizeBooking(booking);
        setBookings(prev => prev.map(b => (b._id === normalized._id ? normalized : b)));
    }, [normalizeBooking]);

    const addBeforeImages = useCallback((id, files) => uploadImages(id, "before-images", files), [uploadImages]);
    const addAfterImages = useCallback((id, files) => uploadImages(id, "after-images", files), [uploadImages]);
    const addProductImages = useCallback((id, files) => uploadImages(id, "product-images", files), [uploadImages]);
    const addProviderImages = useCallback((id, files) => uploadImages(id, "provider-images", files), [uploadImages]);

    return (
        <ProviderBookingContext.Provider value={{
            bookings,
            incomingBookings,
            pendingBookings,
            activeBookings,
            assignedBookings,
            completedBookings,
            cancelledBookings,
            refreshBookings,
            acceptBooking,
            rejectBooking,
            updateBookingStatus,
            requestPayment,
            cancelBooking,
            verifyOTP,
            addBeforeImages,
            addAfterImages,
            addProductImages,
            addProviderImages,
        }}>
            {children}
        </ProviderBookingContext.Provider>
    );
};
