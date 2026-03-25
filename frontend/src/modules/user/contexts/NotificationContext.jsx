import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/modules/user/lib/api";

const NotificationContext = createContext();

export const NotificationProvider = ({ children, role }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        try {
            const data = await api.notifications.list();
            if (data?.notifications) {
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (err) {
            console.error("[NotificationContext] Fetch failed", err);
        }
    }, []);

    const markAllAsRead = async () => {
        try {
            await api.notifications.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error("[NotificationContext] Read-all failed", err);
        }
    };

    const deleteNotification = async (id) => {
        try {
            await api.notifications.delete(id);
            setNotifications(prev => prev.filter(n => n._id !== id));
            // Note: Recalculate unreadCount if needed or just re-fetch
            fetchNotifications();
        } catch (err) {
            console.error("[NotificationContext] Delete failed", err);
        }
    };

    useEffect(() => {
        if (role) {
            fetchNotifications();
            // Optional: Poll every 60 seconds
            const interval = setInterval(fetchNotifications, 60000);
            return () => clearInterval(interval);
        }
    }, [role, fetchNotifications]);

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
