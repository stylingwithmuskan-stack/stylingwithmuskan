import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { ProviderAuthContext } from "./ProviderAuthContext";
import { api, API_BASE_URL } from "@/modules/user/lib/api";
import { io } from "socket.io-client";
import { toast } from "sonner";

const ProviderBookingContext = createContext(undefined);

export const useProviderBookings = () => {
    const context = useContext(ProviderBookingContext);
    if (!context) throw new Error("useProviderBookings must be used within ProviderBookingProvider");
    return context;
};

const STORAGE_KEY = null;
const RINGTONE_DURATION_MS = 30_000; // auto-stop after 30 seconds

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

    // ─── Booking tracking refs ───
    const knownBookingIdsRef = useRef(new Set());
    const isFirstLoadRef = useRef(true);
    const locationSocketRef = useRef(null);
    const chatSocketRef = useRef(null);

    /** Stop any currently playing ringtone (uses global ref from NotificationContext) */
    const stopRingtone = useCallback(() => {
        try {
            if (window.__swm_active_ringtone__) {
                window.__swm_active_ringtone__.pause();
                window.__swm_active_ringtone__.currentTime = 0;
                window.__swm_active_ringtone__ = null;
            }
        } catch {}
    }, []);

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



    const isSlotExpired = useCallback((booking) => {
        if (!booking?.slot?.date || !booking?.slot?.time) return false;
        try {
            const scheduledDate = new Date(booking.slot.date);
            const parts = booking.slot.time.split(' ');
            if (parts.length !== 2) return false;
            const [time, period] = parts;
            let [hours, minutes] = time.split(':').map(Number);
            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            scheduledDate.setHours(hours, minutes, 0, 0);
            return nowMs > scheduledDate.getTime();
        } catch (e) {
            return false;
        }
    }, [nowMs]);

    const isExpiredAssignmentForCurrentProvider = useCallback((booking) => {
        const normalizedStatus = String(booking?.status || "").toLowerCase();
        if (!["incoming", "pending", "final_approved", "payment_pending"].includes(normalizedStatus)) return false;

        // Use a 60-second grace period to handle clock skew between server and client
        const gracePeriodMs = 60000;
        const nowWithGrace = nowMs - gracePeriodMs;

        if (booking?.expiresAt) {
            const expiresAtMs = new Date(booking.expiresAt).getTime();
            return Number.isFinite(expiresAtMs) && expiresAtMs <= nowWithGrace;
        }

        if (booking?.lastAssignedAt) {
            const lastAssignedMs = new Date(booking.lastAssignedAt).getTime();
            return Number.isFinite(lastAssignedMs) && (nowWithGrace - lastAssignedMs) >= acceptWindowMs;
        }

        return false;
    }, [nowMs, acceptWindowMs]);

    // Only show bookings explicitly assigned to this provider
    const myBookings = bookings.filter((b) => {
        const belongsToProvider = String(b.assignedProvider || "") === String(providerId || "");
        if (!belongsToProvider) return false;
        return !isExpiredAssignmentForCurrentProvider(b);
    });

    const incomingBookings = myBookings.filter(b => ["incoming", "pending", "Pending", "final_approved", "payment_pending"].includes(b.status));
    const pendingBookings = myBookings.filter(b => ["pending", "Pending", "final_approved", "payment_pending"].includes(b.status));
    
    const lapsedBookings = myBookings.filter(b => {
        const isActiveStatus = ["accepted", "vendor_assigned", "vendor_reassigned"].includes(b.status);
        if (!isActiveStatus) return false;
        return isSlotExpired(b);
    });

    const activeBookings = myBookings.filter(b => {
        // Mandatory jobs stay in "Assigned" tab until they move beyond "accepted" state
        if (b.isMandatory && b.status === "accepted") return false;
        
        const isActiveStatus = ["accepted", "travelling", "arrived", "in_progress", "payment", "documentation"].includes(b.status);
        
        // Exclude lapsed bookings from primary active list (only if they haven't started yet)
        const isLapsed = ["accepted"].includes(b.status) && isSlotExpired(b);
        
        return isActiveStatus && !isLapsed;
    });

    const assignedBookings = myBookings.filter(b => {
        const isAssigned = b.status === "vendor_assigned" || b.status === "vendor_reassigned" || (b.isMandatory && b.status === "accepted");
        if (!isAssigned) return false;
        return !isSlotExpired(b);
    });
    const completedBookings = myBookings.filter(b => b.status === "completed");
    const cancelledBookings = myBookings.filter(b => ["cancelled", "rejected", "provider_cancelled"].includes(b.status));

    // ─── Real-time Socket Sync ───
    useEffect(() => {
        const token = localStorage.getItem("swm_provider_token");
        if (!providerId || !token) return;

        // 1. Bookings status sync
        console.log(`[ProviderBookings] 🔄 Connecting sync socket for provider: ${providerId}`);
        const socket = io(`${API_BASE_URL}/bookings`, {
            auth: { token },
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            console.log("[ProviderBookings] ✅ Sync socket connected");
            refreshBookings(); // Initial catch-up
        });

        // ... existing listeners ...
        socket.on("new_notification", (payload) => {
            const targetId = String(payload.recipientId);
            const myId = String(providerId);
            if (targetId === myId) {
                console.log("[ProviderBookings] 🔔 New notification received, refreshing bookings...");
                // Sound is handled by NotificationContext (single source of truth)
                refreshBookings();
            }
        });

        socket.on("assignment:changed", (payload) => {
            if (String(payload.toProvider) === String(providerId) || String(payload.fromProvider) === String(providerId)) {
                console.log("[ProviderBookings] 🚀 Assignment changed, refreshing bookings...");
                // Sound is handled by NotificationContext (single source of truth)
                refreshBookings();
            }
        });

        socket.on("status:update", () => {
            console.log("[ProviderBookings] 🔄 Status updated elsewhere, refreshing...");
            refreshBookings();
        });

        socket.on("booking:update", () => {
            console.log("[ProviderBookings] 🔄 Booking updated elsewhere, refreshing...");
            refreshBookings();
        });

        // 2. Booking Chat sync (Global)
        const chatSocket = io(`${API_BASE_URL}/booking-chat`, {
            auth: { token },
            transports: ["websocket"],
        });

        chatSocket.on("connect", () => {
             console.log("[ProviderBookings] 💬 Chat socket connected globally");
             chatSocketRef.current = chatSocket;
        });

        chatSocket.on("receive:message", (newMessage) => {
            // Sound for chat messages is handled by NotificationContext
            if (newMessage.senderRole === "customer") {
                console.log("[ProviderBookings] 💬 New chat message from customer");
            }
        });

        // 3. Provider Location tracking socket
        console.log(`[ProviderBookings] 📍 Connecting location socket for provider: ${providerId}`);
        const locationSocket = io(`${API_BASE_URL}/provider-location`, {
            auth: { token },
            transports: ["websocket"],
        });

        locationSocket.on("connect", () => {
            console.log("[ProviderBookings] ✅ Location socket connected");
            locationSocketRef.current = locationSocket;
        });

        return () => {
            socket.disconnect();
            chatSocket.disconnect();
            locationSocket.disconnect();
            locationSocketRef.current = null;
            chatSocketRef.current = null;
        };
    }, [providerId, refreshBookings]);

    // ─── Chat Room Management ───
    useEffect(() => {
        const cs = chatSocketRef.current;
        if (!cs || !cs.connected) return;

        // Join rooms for all current active and lapsed bookings
        [...activeBookings, ...lapsedBookings].forEach(b => {
            cs.emit("join:chat", { bookingId: b.id || b._id });
        });
    }, [activeBookings.length, lapsedBookings.length]);

    const updateLiveLocation = useCallback((lat, lng) => {
        if (locationSocketRef.current && locationSocketRef.current.connected) {
            locationSocketRef.current.emit("location:update", { lat, lng });
        }
    }, []);

    // ─── Detect new incoming bookings (for tracking, no duplicate sound) ───
    useEffect(() => {
        const currentIncomingIds = new Set(incomingBookings.map(b => b.id || b._id).filter(Boolean));
        const knownIds = knownBookingIdsRef.current;

        // On first load, just seed the known set
        if (isFirstLoadRef.current) {
            knownBookingIdsRef.current = currentIncomingIds;
            if (currentIncomingIds.size > 0) {
                isFirstLoadRef.current = false;
            }
            return;
        }

        // Check for genuinely new bookings
        let hasNew = false;
        for (const id of currentIncomingIds) {
            if (!knownIds.has(id)) {
                hasNew = true;
                break;
            }
        }

        // Update known set
        knownBookingIdsRef.current = currentIncomingIds;

        if (hasNew) {
            console.log("[ProviderBookings] 🔔 New incoming booking detected (sound handled by NotificationContext)");
        }
    }, [incomingBookings]);

    const acceptBooking = useCallback(async (id) => {
        stopRingtone(); // Stop ringtone when provider takes action
        try {
            const { booking } = await api.provider.updateBookingStatus(id, "accepted");
            const normalized = normalizeBooking(booking);
            setBookings(prev => prev.map(b => b._id === normalized._id ? normalized : b));
        } catch (e) {
            refreshBookings();
            alert(e?.message || "Failed to accept");
        }
    }, [normalizeBooking, refreshBookings, stopRingtone]);

    const rejectBooking = useCallback(async (id) => {
        stopRingtone(); // Stop ringtone when provider takes action
        try {
            const { booking } = await api.provider.updateBookingStatus(id, "rejected");
            const normalized = normalizeBooking(booking);
            setBookings(prev => prev.map(b => b._id === normalized._id ? normalized : b));
        } catch (e) {
            refreshBookings();
            alert(e?.message || "Failed to reject");
        }
    }, [normalizeBooking, refreshBookings, stopRingtone]);

    const updateBookingStatus = useCallback(async (id, status, payload = {}) => {
        try {
            const { booking } = await api.provider.updateBookingStatus(id, status, payload);
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

    const activateManualAssignment = useCallback(async (id) => {
        try {
            const res = await api.provider.activateManualAssignment(id);
            if (res.success) {
                toast.success("Job activated successfully!");
                refreshBookings();
                // Optionally update provider credits in auth context if needed
                if (res.credits !== undefined && providerAuth?.setProvider) {
                    providerAuth.setProvider(prev => ({ ...prev, credits: res.credits }));
                }
            }
            return res;
        } catch (e) {
            toast.error(e?.message || "Failed to activate job");
            throw e;
        }
    }, [refreshBookings, providerAuth]);

    return (
        <ProviderBookingContext.Provider value={{
            bookings,
            incomingBookings,
            pendingBookings,
            activeBookings,
            assignedBookings,
            lapsedBookings,
            completedBookings,
            cancelledBookings,
            refreshBookings,
            acceptBooking,
            rejectBooking,
            updateBookingStatus,
            activateManualAssignment,
            requestPayment,
            cancelBooking,
            verifyOTP,
            addBeforeImages,
            addAfterImages,
            addProductImages,
            addProviderImages,
            stopRingtone,
            updateLiveLocation,
        }}>
            {children}
        </ProviderBookingContext.Provider>
    );
};
