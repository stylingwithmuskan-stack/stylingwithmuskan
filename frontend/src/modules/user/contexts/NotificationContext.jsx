import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { api, API_BASE_URL } from "@/modules/user/lib/api";
import { safeStorage } from "@/modules/user/lib/safeStorage";
import { io } from "socket.io-client";
import { ProviderAuthContext } from "@/modules/serviceprovider/contexts/ProviderAuthContext";
import { VenderAuthContext } from "@/modules/vender/contexts/VenderAuthContext";
import { AdminAuthContext } from "@/modules/admin/contexts/AdminAuthContext";
import { AuthContext } from "@/modules/user/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import {
    ensurePushRegistration,
    fetchPushStatus,
    getPushDeviceKey,
    isPushSupported,
    requestPushPermission,
    revokePushRegistration,
    setupForegroundPushListener,
    syncPushPreferences,
} from "@/modules/user/lib/firebasePush";

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
    const [pushState, setPushState] = useState({
        supported: isPushSupported(),
        permission: typeof Notification === "undefined" ? "default" : Notification.permission,
        registered: false,
        enabled: false,
        deviceKey: getPushDeviceKey(),
    });
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

    const currentUserId = activeRole === "provider"
        ? (provider?._id || provider?.id)
        : activeRole === "vendor"
            ? (vendor?._id || vendor?.id)
            : activeRole === "admin"
                ? (admin?._id || admin?.id)
                : (user?._id || user?.id);

    const refreshPushState = useCallback(async () => {
        const supported = isPushSupported();
        const permission = typeof Notification === "undefined" ? "default" : Notification.permission;
        const deviceKey = getPushDeviceKey();
        if (!supported || !activeToken || !currentUserId) {
            setPushState((prev) => ({ ...prev, supported, permission, registered: false, enabled: false, deviceKey }));
            return;
        }
        const status = await fetchPushStatus(activeRole);
        setPushState({
            supported,
            permission: status?.permission || permission,
            registered: !!status?.registered,
            enabled: status?.enabled !== false && !!status?.registered,
            deviceKey,
        });
    }, [activeRole, activeToken, currentUserId]);

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
        if (!currentUserId || !activeToken) return;

        const socket = io(`${API_BASE_URL}/bookings`, {
            auth: { token: activeToken },
        });

        socket.on("new_notification", (payload) => {
            const targetId = String(payload.recipientId);
            const myId = String(currentUserId);
            const targetRole = payload?.notification?.recipientRole || payload?.recipientRole;

            if (targetId === myId && (!targetRole || targetRole === activeRole)) {
                setNotifications((prev) => insertUniqueNotification(prev, payload.notification));
                setUnreadCount((prev) => prev + (payload.notification?.isRead ? 0 : 1));
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [currentUserId, activeRole, activeToken]);

    useEffect(() => {
        let unsubscribe = () => {};
        (async () => {
            unsubscribe = await setupForegroundPushListener((payload) => {
                const notificationId = payload?.data?.notificationId;
                if (Notification.permission === "granted" && payload?.notification?.title) {
                    new Notification(payload.notification.title, {
                        body: payload.notification.body,
                        icon: payload.notification.icon || "/logo.png",
                    });
                }
                if (notificationId) fetchNotifications();
            });
        })();
        return () => unsubscribe();
    }, [fetchNotifications]);

    useEffect(() => {
        if (activeRole && currentUserId && activeToken) {
            fetchNotifications();
            refreshPushState();
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                ensurePushRegistration(activeRole)
                    .then(() => refreshPushState())
                    .catch(() => {});
            }
            const interval = setInterval(fetchNotifications, 60000);
            return () => clearInterval(interval);
        }
    }, [role, activeRole, activeToken, fetchNotifications, currentUserId, refreshPushState]);

    const enablePushNotifications = async () => {
        console.log('[Push] 🚀 Starting push notification enable flow...');
        console.log('[Push] Current permission:', typeof Notification !== 'undefined' ? Notification.permission : 'undefined');
        console.log('[Push] Active role:', activeRole);
        console.log('[Push] Active token:', activeToken ? 'Present' : 'Missing');
        
        try {
            const permission = await requestPushPermission();
            console.log('[Push] Permission request result:', permission);
            
            if (permission !== "granted") {
                console.error('[Push] ❌ Permission not granted:', permission);
                setPushState((prev) => ({ ...prev, permission }));
                throw new Error("Notification permission not granted");
            }
            
            console.log('[Push] ✅ Permission granted, registering device...');
            const result = await ensurePushRegistration(activeRole);
            console.log('[Push] Registration result:', result);
            
            console.log('[Push] Refreshing push state...');
            await refreshPushState();
            
            console.log('[Push] ✅ Push notifications enabled successfully!');
            return true;
        } catch (error) {
            console.error('[Push] ❌ Error enabling push notifications:', error);
            if (error && typeof error === 'object') {
                console.error('[Push] Error details:', {
                    message: error.message || 'Unknown error',
                    stack: error.stack || 'No stack trace',
                    name: error.name || 'Unknown'
                });
            }
            throw error;
        }
    };

    const disablePushNotifications = async () => {
        await syncPushPreferences(activeRole, false).catch(() => {});
        await revokePushRegistration(activeRole).catch(() => {});
        await refreshPushState();
    };

    const markAllAsRead = async () => {
        try {
            await api.notifications.markAllAsRead({ role: activeRole, token: activeToken });
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error("[NotificationContext] Read-all failed", err);
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

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            fetchNotifications,
            markAllAsRead,
            deleteNotification,
            pushSupported: pushState.supported,
            pushPermission: pushState.permission,
            pushRegistered: pushState.registered,
            pushEnabled: pushState.enabled,
            enablePushNotifications,
            disablePushNotifications,
            refreshPushState,
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
