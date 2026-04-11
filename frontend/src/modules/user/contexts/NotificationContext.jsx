import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { api, API_BASE_URL } from "@/modules/user/lib/api";
import { safeStorage } from "@/modules/user/lib/safeStorage";
import { io } from "socket.io-client";
import { ProviderAuthContext } from "@/modules/serviceprovider/contexts/ProviderAuthContext";
import { VenderAuthContext } from "@/modules/vender/contexts/VenderAuthContext";
import { AdminAuthContext } from "@/modules/admin/contexts/AdminAuthContext";
import { AuthContext } from "@/modules/user/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { setupForegroundHandler } from "@/services/pushNotificationService";

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

    const currentUserId = activeRole === "provider"
        ? (provider?._id || provider?.id)
        : activeRole === "vendor"
            ? (vendor?._id || vendor?.id)
            : activeRole === "admin"
                ? (admin?._id || admin?.id)
                : (user?._id || user?.id);

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
            const interval = setInterval(fetchNotifications, 60000);
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
            fetchNotifications,
            markAllAsRead,
            deleteNotification,
            deleteAllNotifications,
            deleteMultipleNotifications,
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
