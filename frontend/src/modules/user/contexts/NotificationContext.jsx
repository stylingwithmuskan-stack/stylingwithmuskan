import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { api, API_BASE_URL } from "@/modules/user/lib/api";
import { io } from "socket.io-client";
import { ProviderAuthContext } from "@/modules/serviceprovider/contexts/ProviderAuthContext";
import { VenderAuthContext } from "@/modules/vender/contexts/VenderAuthContext";
import { AdminAuthContext } from "@/modules/admin/contexts/AdminAuthContext";
import { AuthContext } from "@/modules/user/contexts/AuthContext";
import { useLocation } from "react-router-dom";

const NotificationContext = createContext();

export const NotificationProvider = ({ children, role }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const location = useLocation();

    // Use direct useContext to avoid potential "must be used within" errors during root hydration
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
            console.log("[NotificationContext] Fetched data:", data);
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
            // Removed restricted transport to allow fallback
        });

        socket.on("connect", () => {
            console.log("[NotificationContext] Socket connected to /bookings namespace");
        });

        socket.on("connect_error", (err) => {
            console.error("[NotificationContext] Socket connection error:", err.message);
        });

        socket.on("new_notification", (payload) => {
            console.log("[NotificationContext] New notification received:", payload);
            const targetId = String(payload.recipientId);
            const myId = String(currentUserId);
            const targetRole = payload?.notification?.recipientRole || payload?.recipientRole;
            
            if (targetId === myId && (!targetRole || targetRole === activeRole)) {
                console.log("[NotificationContext] Notification matches current user. Updating state.");
                setNotifications(prev => [payload.notification, ...prev]);
                setUnreadCount(prev => prev + 1);
                
                // Request permission and show browser notification
                if ("Notification" in window) {
                    if (Notification.permission === "granted") {
                        new Notification(payload.notification.title, {
                            body: payload.notification.message,
                        });
                    } else if (Notification.permission !== "denied") {
                        Notification.requestPermission();
                    }
                }
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [currentUserId, activeRole, activeToken]);

    const markAllAsRead = async () => {
        try {
            await api.notifications.markAllAsRead({ role: activeRole, token: activeToken });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error("[NotificationContext] Read-all failed", err);
        }
    };

    const deleteNotification = async (id) => {
        try {
            await api.notifications.delete(id, { role: activeRole, token: activeToken });
            setNotifications(prev => prev.filter(n => n._id !== id));
            // Note: Recalculate unreadCount if needed or just re-fetch
            fetchNotifications();
        } catch (err) {
            console.error("[NotificationContext] Delete failed", err);
        }
    };

    useEffect(() => {
        if (activeRole && currentUserId && activeToken) {
            console.log("[NotificationContext] Fetching for user:", currentUserId);
            fetchNotifications();
            // Optional: Poll every 60 seconds
            const interval = setInterval(fetchNotifications, 60000);
            return () => clearInterval(interval);
        }
    }, [role, activeRole, activeToken, fetchNotifications, currentUserId]);

    return (
        <NotificationContext.Provider value={{ 
            notifications, 
            unreadCount, 
            loading, 
            fetchNotifications, 
            markAllAsRead, 
            deleteNotification 
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
