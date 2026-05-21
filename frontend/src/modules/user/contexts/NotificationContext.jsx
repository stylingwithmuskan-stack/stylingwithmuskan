import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api, API_BASE_URL, SOCKET_BASE_URL } from "@/modules/user/lib/api";
import { safeSessionStorage } from "@/modules/user/lib/safeSessionStorage";
import { io } from "socket.io-client";
import { ProviderAuthContext } from "@/modules/serviceprovider/contexts/ProviderAuthContext";
import { VenderAuthContext } from "@/modules/vender/contexts/VenderAuthContext";
import { AdminAuthContext } from "@/modules/admin/contexts/AdminAuthContext";
import { AuthContext } from "@/modules/user/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { setupForegroundHandler } from "@/services/pushNotificationService";
import { playFlutterSound, isFlutterWebView } from "@/utils/flutterBridge";
import { toast } from "sonner";

const SOUND_FILES = {
    ringtone: "/sounds/ringtone.mp3",
    notification: "/sounds/massege_ting.mp3",
    emergency: "/sounds/sos_tone.mp3",
    alert: "/sounds/alert.mp3",
    success: "/sounds/massege_ting.mp3",
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

        // 1. Explicit Path Context (Highest Priority)
        if (path.startsWith("/provider")) return "provider";
        if (path.startsWith("/vender") || path.startsWith("/vendor")) return "vendor";
        if (path.startsWith("/admin")) return "admin";

        // 2. User Context (Default for main site)
        if (user?._id || user?.id) return "user";

        // 3. Fallback to other logged in roles
        if (provider?._id || provider?.id) return "provider";
        if (vendor?._id || vendor?.id) return "vendor";
        if (admin?._id || admin?.id) return "admin";

        return "user";
    }, [location?.pathname, provider, vendor, admin, user]);

    const providerToken = providerContext?.providerToken || "";
    const vendorToken = vendorContext?.vendorToken || "";
    const adminToken = adminContext?.adminToken || "";
    const userToken = userContext?.token || ""; // Assuming AuthContext exposes token

    const activeToken = useMemo(() => {
        if (activeRole === "provider") return providerToken;
        if (activeRole === "vendor") return vendorToken;
        if (activeRole === "admin") return adminToken;
        return userToken;
    }, [activeRole, providerToken, vendorToken, adminToken, userToken]);

    const [userInteracted, setUserInteracted] = useState(false);
    const lastSoundPlayedRef = useRef(0);
    const audioRef = useRef(null);

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
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
            if (window.__swm_active_ringtone__) {
                window.__swm_active_ringtone__.pause();
                window.__swm_active_ringtone__.currentTime = 0;
                window.__swm_active_ringtone__ = null;
            }
        } catch { }
    }, []);

    const playNotificationSound = useCallback(async (soundKey = "notification") => {
        console.log(`[NotificationContext] Attempting to play sound: ${soundKey}`);
        if (!soundKey) return;

        // Debounce: skip if a sound was played within the last 500ms
        const now = Date.now();
        if (now - lastSoundPlayedRef.current < 500) {
            console.log(`[NotificationContext] Sound debounced (too soon): ${soundKey}`);
            return;
        }
        lastSoundPlayedRef.current = now;

        try {
            // First try Flutter bridge if in app
            if (isFlutterWebView()) {
                console.log("[NotificationContext] Running in App, trying Flutter Sound Bridge");
                const success = await playFlutterSound(soundKey);
                if (success) return;
            }

            // Fallback to HTML Audio
            stopActiveSound();
            const audioPath = SOUND_FILES[soundKey] || SOUND_FILES.notification;
            const audio = new Audio(audioPath);

            audioRef.current = audio;
            if (soundKey === "ringtone" || soundKey === "emergency") {
                audio.loop = true;
                window.__swm_active_ringtone__ = audio;
                // Auto-stop after 30 seconds
                setTimeout(() => {
                    stopActiveSound();
                }, 30000);
            }

            const audioPromise = audio.play();
            if (audioPromise !== undefined) {
                audioPromise.catch((error) => {
                    console.error("[NotificationContext] Autoplay blocked or audio failed:", error);
                });
            }

            return audio;
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

        console.log(`[NotificationContext] Init Effect. Role: ${activeRole}, User: ${currentUserId}, HasToken: ${!!activeToken}`);

        // Auto-initialize push notifications on mount if token exists
        if (activeToken && activeRole) {
            import("@/services/pushNotificationService").then(({ initPushNotifications }) => {
                initPushNotifications(activeToken, activeRole).catch(err => {
                    console.error("[NotificationContext] Push init failed on mount:", err);
                });
            });
        }

        if (!currentUserId || !activeToken) {
            console.log("[NotificationContext] Skipping socket connection (missing user or token)");
            return;
        }

        console.log(`[NotificationContext] Connecting to socket: ${SOCKET_BASE_URL}/bookings`);
        const socket = io(`${SOCKET_BASE_URL}/bookings`, {
            auth: { token: activeToken },
            transports: ["websocket", "polling"],
            reconnectionAttempts: 5,
        });

        socket.on("connect", () => {
            console.log("[NotificationContext] Socket connected successfully!");
        });

        socket.on("connect_error", (err) => {
            console.error("[NotificationContext] Socket connection error:", err.message);
        });

        socket.on("new_notification", (payload) => {
            console.log("[NotificationContext] 📥 RAW SOCKET DATA:", JSON.stringify(payload));
            console.log("[NotificationContext] Received new_notification:", payload);

            const targetId = String(payload.recipientId || payload.notification?.recipientId || "");
            const targetRole = String(payload.recipientRole || payload.notification?.recipientRole || "");
            const type = String(payload.type || payload.notification?.type || "");
            const myId = String(currentUserId || "");

            console.log(`[NotificationContext] 🔍 CHECKING: TargetRole=${targetRole} | ActiveRole=${activeRole}`);
            console.log(`[NotificationContext] 🔍 CHECKING: TargetID=${targetId} | MyID=${myId}`);

            const isRoleMatch = targetRole === activeRole;
            const isIdMatch = targetId === myId || targetId === "ADMIN001" || targetId.startsWith("GLOBAL_");
            const isNewOrderEscalation = type === "NEW_ORDER" && activeRole === "vendor";

            console.log(`[NotificationContext] Evaluation: RoleMatch=${isRoleMatch}, IdMatch=${isIdMatch}, Escalation=${isNewOrderEscalation}`);

            if (isNewOrderEscalation || (isRoleMatch && isIdMatch)) {
                console.log(`[NotificationContext] ✅ SUCCESS: Role Match=${isRoleMatch}, ID Match=${isIdMatch}, Escalation=${isNewOrderEscalation}`);
                setNotifications((prev) => insertUniqueNotification(prev, payload.notification || payload));
                setUnreadCount((prev) => prev + (payload.notification?.isRead ? 0 : 1));

                toast(payload.notification?.title || payload.title || "New Notification", {
                    description: payload.notification?.message || payload.message,
                    duration: 10000, // Extended duration for NEW_ORDER
                });

                // ✅ TRIGGER NATIVE BROWSER NOTIFICATION
                if ("Notification" in window && Notification.permission === "granted") {
                    const nativeTitle = payload.notification?.title || payload.title || "New Order";
                    const nativeOptions = {
                        body: payload.notification?.message || payload.message || "A new order needs attention.",
                        icon: "/logo.png",
                        requireInteraction: true, // Keep it visible until dismissed
                        tag: "new-order-escalation", // Deduplicate
                        silent: false
                    };
                    
                    try {
                        const notif = new Notification(nativeTitle, nativeOptions);
                        notif.onclick = () => {
                            window.focus();
                            const link = payload.notification?.link || payload.link || "/vender/bookings";
                            navigate(link);
                        };
                    } catch (err) {
                        console.error("[NotificationContext] Native notification failed:", err);
                    }
                }

                if (payload.notification?.sound || payload.sound) {
                    playNotificationSound(payload.notification?.sound || payload.sound);
                }
            } else {
                console.warn("[NotificationContext] ❌ Ignored: Role or ID Mismatch", { targetRole, activeRole, targetId, myId, type });
            }
        });

        setupForegroundHandler(() => {
            fetchNotifications();
        });

        return () => {
            console.log("[NotificationContext] Cleaning up socket connection");
            socket.disconnect();
        };
    }, [currentUserId, activeRole, activeToken, playNotificationSound, fetchNotifications]);

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
    }, [activeRole, activeToken, fetchNotifications, currentUserId]);

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
