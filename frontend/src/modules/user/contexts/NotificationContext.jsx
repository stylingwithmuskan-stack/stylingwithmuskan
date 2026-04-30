import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api, API_BASE_URL } from "@/modules/user/lib/api";
import { safeStorage } from "@/modules/user/lib/safeStorage";
import { io } from "socket.io-client";
import { ProviderAuthContext } from "@/modules/serviceprovider/contexts/ProviderAuthContext";
import { VenderAuthContext } from "@/modules/vender/contexts/VenderAuthContext";
import { AdminAuthContext } from "@/modules/admin/contexts/AdminAuthContext";
import { AuthContext } from "@/modules/user/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { setupForegroundHandler } from "@/services/pushNotificationService";
import { toast } from "sonner";

const SOUND_FILES = {
    ringtone: "/sounds/ringtone.mp3",
    notification: "/sounds/massege_ting.mp3",
    emergency: "/sounds/sos_tone.mp3",
    alert: "/sounds/alert.mp3",
    success: "/sounds/massege_ting.mp3", // Fallback to ting
};


const NotificationContext = createContext();

const insertUniqueNotification = (prev, nextNotification) => {
    if (!nextNotification?._id) return prev;
    const exists = prev.some((item) => item._id === nextNotification._id);
    if (exists) {
        return prev.map((item) => (item._id === nextNotification._id ? { ...item, ...nextNotification } : item));
    }
    return [nextNotification, ...prev];
};

export const NotificationProvider = ({ children, role }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const location = useLocation();

    const providerContext = useContext(ProviderAuthContext);
    const vendorContext = useContext(VenderAuthContext);
    const adminContext = useContext(AdminAuthContext);
    const userContext = useContext(AuthContext);

    const provider = providerContext?.provider;
    const vendor = vendorContext?.vendor;
    const admin = adminContext?.admin;
    const user = userContext?.user;

    const activeRole = useMemo(() => {
        const path = location?.pathname || "";
        if (path.startsWith("/provider")) return "provider";
        if (path.startsWith("/vender")) return "vendor";
        if (path.startsWith("/admin")) return "admin";
        return "user";
    }, [location?.pathname]);

    const activeToken = useMemo(() => {
        try {
            if (activeRole === "provider") return localStorage.getItem("swm_provider_token") || "";
            if (activeRole === "vendor") return localStorage.getItem("swm_vendor_token") || "";
            if (activeRole === "admin") return localStorage.getItem("swm_admin_token") || "";
            return localStorage.getItem("swm_token") || "";
        } catch {
            return "";
        }
    }, [activeRole]);

    const [userInteracted, setUserInteracted] = useState(false);
    const lastSoundPlayedRef = useRef(0); // Debounce ref to prevent double-plays

    const currentUserId = activeRole === "provider"
        ? (provider?._id || provider?.id)
        : activeRole === "vendor"
            ? (vendor?._id || vendor?.id)
            : activeRole === "admin"
                ? (admin?._id || admin?.id)
                : (user?._id || user?.id);

    // Audio context "warm up" to bypass browser autoplay policies
    useEffect(() => {
        const handleInteraction = () => {
            console.log("[NotificationContext] User interacted, audio unlocked");
            setUserInteracted(true);
            window.removeEventListener("click", handleInteraction);
            window.removeEventListener("touchstart", handleInteraction);
            window.removeEventListener("keydown", handleInteraction);
        };
        window.addEventListener("click", handleInteraction);
        window.addEventListener("touchstart", handleInteraction);
        window.addEventListener("keydown", handleInteraction);
        return () => {
            window.removeEventListener("click", handleInteraction);
            window.removeEventListener("touchstart", handleInteraction);
            window.removeEventListener("keydown", handleInteraction);
        };
    }, []);

    /** Stop any currently active looping sound (ringtone/emergency) */
    const stopActiveSound = useCallback(() => {
        try {
            if (window.__swm_active_ringtone__) {
                window.__swm_active_ringtone__.pause();
                window.__swm_active_ringtone__.currentTime = 0;
                window.__swm_active_ringtone__ = null;
            }
        } catch {}
    }, []);

    const playNotificationSound = useCallback((soundType) => {
        console.log(`[NotificationContext] Attempting to play sound: ${soundType}`);
        if (!soundType) return;
        const file = SOUND_FILES[soundType];
        if (!file) {
            console.warn(`[NotificationContext] No sound file mapped for: ${soundType}`);
            return;
        }

        // Debounce: skip if a sound was played within the last 500ms
        const now = Date.now();
        if (now - lastSoundPlayedRef.current < 500) {
            console.log(`[NotificationContext] Sound debounced (too soon): ${soundType}`);
            return;
        }
        lastSoundPlayedRef.current = now;

        try {
            const audio = new Audio(file);
            audio.volume = 1.0;
            
            // Loop for ringtones (providers)
            if (soundType === "ringtone" || soundType === "emergency") {
                // Stop any existing looping sound first
                stopActiveSound();
                audio.loop = true;
                // Store globally so other contexts (e.g. ProviderBookingContext) can stop it
                window.__swm_active_ringtone__ = audio;
                // Auto-stop after 30 seconds to prevent infinite ringing if unattended
                setTimeout(() => {
                    console.log(`[NotificationContext] Auto-stopping loop for: ${soundType}`);
                    stopActiveSound();
                }, 30000);
            }

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log(`[NotificationContext] Sound playing: ${soundType}`);
                }).catch((error) => {
                    console.error("[NotificationContext] Audio play failed:", error.message);
                    console.info("[NotificationContext] Note: Audio usually requires a user click on the page first.");
                    toast.info("New notification! (Click anywhere to enable sounds)");
                });
            }
            
            return audio; // Return for manual stop if needed
        } catch (err) {
            console.error("[NotificationContext] Audio error:", err);
        }
    }, [stopActiveSound]);


    const fetchNotifications = useCallback(async () => {
        if (!currentUserId || !activeToken) return;
        setLoading(true);
        try {
            const data = await api.notifications.list({ role: activeRole, token: activeToken });
            if (data?.notifications) {
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (err) {
            console.error("[NotificationContext] Fetch failed", err);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, activeRole, activeToken]);

    useEffect(() => {
        // Expose to window for testing
        window.__DEBUG_PLAY_SOUND__ = playNotificationSound;
        
        if (!currentUserId || !activeToken) {
            console.log("[NotificationContext] Socket skipped: Missing userId or token");
            return;
        }

        console.log(`[NotificationContext] Connecting socket for ${activeRole}: ${currentUserId}`);
        const socket = io(`${API_BASE_URL}/bookings`, {
            auth: { token: activeToken },
            transports: ["websocket", "polling"], // Ensure websocket is tried first
        });

        socket.on("connect", () => {
            console.log("[NotificationContext] Socket connected!");
        });

        socket.on("connect_error", (err) => {
            console.error("[NotificationContext] Socket connection error:", err.message);
        });

        socket.on("new_notification", (payload) => {
            console.log("[NotificationContext] Received socket notification:", payload);
            const targetId = String(payload.recipientId);
            const myId = String(currentUserId);
            const targetRole = payload?.notification?.recipientRole || payload?.recipientRole;

            if (targetId === myId && (!targetRole || targetRole === activeRole)) {
                console.log("[NotificationContext] Notification matches current user. Updating UI.");
                setNotifications((prev) => insertUniqueNotification(prev, payload.notification));
                setUnreadCount((prev) => prev + (payload.notification?.isRead ? 0 : 1));

                // Trigger audio alert
                if (payload.notification?.sound) {
                    playNotificationSound(payload.notification.sound);
                } else {
                    console.log("[NotificationContext] Notification has no sound assigned.");
                }
            } else {
                console.log("[NotificationContext] Notification ignored (ID or Role mismatch)", { targetId, myId, targetRole, activeRole });
            }
        });

        // Wire FCM foreground handler — refreshes notification list on foreground push
        setupForegroundHandler(() => {
            fetchNotifications();
        });

        return () => {
            socket.disconnect();
        };
    }, [currentUserId, activeRole, activeToken]);

    useEffect(() => {
        if (activeRole && currentUserId && activeToken) {
            fetchNotifications();
            const interval = setInterval(() => {
                if (document.visibilityState === "visible") {
                    fetchNotifications();
                }
            }, 60000);
            return () => clearInterval(interval);
        }
    }, [role, activeRole, activeToken, fetchNotifications, currentUserId]);

    const markAllAsRead = async () => {
        try {
            await api.notifications.markAllAsRead({ role: activeRole, token: activeToken });
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error("[NotificationContext] Read-all failed", err);
        }
    };

    const markAsRead = async (id) => {
        try {
            await api.notifications.markAsRead(id, { role: activeRole, token: activeToken });
            setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (err) {
            console.error("[NotificationContext] Mark single read failed", err);
        }
    };

    const deleteNotification = async (id) => {
        try {
            await api.notifications.delete(id, { role: activeRole, token: activeToken });
            setNotifications((prev) => prev.filter((n) => n._id !== id));
            fetchNotifications();
        } catch (err) {
            console.error("[NotificationContext] Delete failed", err);
        }
    };

    const deleteAllNotifications = async () => {
        try {
            await api.notifications.deleteAll({ role: activeRole, token: activeToken });
            setNotifications([]);
            setUnreadCount(0);
        } catch (err) {
            console.error("[NotificationContext] Delete-all failed", err);
        }
    };

    const deleteMultipleNotifications = async (ids) => {
        if (!ids || ids.length === 0) return;
        try {
            await api.notifications.deleteMultiple(ids, { role: activeRole, token: activeToken });
            setNotifications((prev) => prev.filter((n) => !ids.includes(n._id)));
            fetchNotifications();
        } catch (err) {
            console.error("[NotificationContext] Delete-multiple failed", err);
        }
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            activeRole,
            fetchNotifications,
            markAllAsRead,
            markAsRead,
            deleteNotification,
            deleteAllNotifications,
            deleteMultipleNotifications,
            stopActiveSound,
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error("useNotifications must be used within NotificationProvider");
    return context;
};
