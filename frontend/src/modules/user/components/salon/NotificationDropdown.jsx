import React, { useEffect, useRef } from "react";
import { useNotifications } from "@/modules/user/contexts/NotificationContext";
import { Bell, Trash2, CheckCircle2, Clock, X, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { useNavigate } from "react-router-dom";

const NotificationDropdown = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const {
        notifications,
        unreadCount,
        activeRole,
        markAllAsRead,
        markAsRead,
        deleteNotification,
        fetchNotifications,
        pushSupported,
        pushPermission,
        pushRegistered,
        pushEnabled,
        enablePushNotifications,
        disablePushNotifications,
    } = useNotifications();
    const wasOpen = useRef(false);

    // Filter only unread notifications for the dropdown
    const unreadNotifications = notifications.filter(n => !n.isRead);

    useEffect(() => {
        // When the dropdown closes after being open, mark all as read
        // if (wasOpen.current && !isOpen && unreadCount > 0) {
        //     markAllAsRead();
        // }
        // Note: Disabling auto-mark-all-read on close since we now support single click-to-read
        wasOpen.current = isOpen;
    }, [isOpen]);

    if (!isOpen) return null;

    const handleNotificationClick = async (n) => {
        // Mark as read in backend
        if (!n.isRead) {
            await markAsRead(n._id);
        }

        const meta = n.meta || {};
        const type = n.type || "";
        const bookingId = meta.bookingId || meta.id;
        const enquiryId = meta.enquiryId;

        let path = null;

        // 1. Build a specific path if meta data exists (Prioritize over n.link)
        if (activeRole === "user") {
            if (bookingId) {
                path = `/bookings?id=${bookingId}`;
            } else if (enquiryId) {
                path = `/bookings?enquiry=${enquiryId}`;
            } else if (type.startsWith("payment_") || type.includes("payment")) {
                path = "/payment";
            }
        } else if (activeRole === "provider") {
            if (bookingId) {
                path = `/provider/booking/${bookingId}`;
            } else if (type === "zone_added") {
                path = "/provider/all-zones";
            } else if (type.includes("leave_")) {
                path = "/provider/availability";
            } else if (type === "sos_alert") {
                path = "/provider/sos";
            }
        } else if (activeRole === "vendor") {
            if (type === "sos_alert") path = "/vender/sos";
            else if (bookingId) path = `/vender/bookings?search=${bookingId}`;
        } else if (activeRole === "admin") {
            if (type === "sos_alert") path = "/admin/sos";
            else if (type === "leave_requested") path = "/admin/service-providers";
            else if (bookingId) path = `/admin/bookings?search=${bookingId}`;
        }

        // 2. Fallback to backend provided link or default role base
        if (!path) {
            path = n.link && n.link !== "/notifications" ? n.link : null;
        }

        if (!path) {
            if (activeRole === "user") path = "/notifications";
            else if (activeRole === "provider") path = "/provider/notifications";
            else if (activeRole === "vendor") path = "/vender/notifications";
            else if (activeRole === "admin") path = "/admin/notifications";
        }

        if (path) {
            navigate(path);
            onClose();
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'booking_cancel': return <X className="w-4 h-4 text-red-500" />;
            case 'reassignment': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            case 'reminder': return <Clock className="w-4 h-4 text-blue-500" />;
            case 'new_booking': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'sos_alert': return <AlertTriangle className="w-4 h-4 text-red-600" />;
            default: return <Info className="w-4 h-4 text-slate-500" />;
        }
    };

    return (
        <div className="fixed sm:absolute top-[70px] sm:top-full left-4 right-4 sm:left-auto sm:right-0 mt-2 w-auto sm:w-80 md:w-96 bg-card border border-border shadow-2xl rounded-[2rem] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-5 border-b border-border flex items-center justify-between bg-accent/5">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        Unread Alerts
                        {unreadCount > 0 && <Badge variant="destructive" className="h-5 min-w-[20px] rounded-full text-[10px] p-0 flex items-center justify-center">{unreadCount}</Badge>}
                    </h3>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => fetchNotifications()} className="h-8 w-8 rounded-full">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {pushSupported && (
                <div className="px-5 py-3 border-b border-border bg-primary/[0.03]">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-foreground">Push Notifications</p>
                            <p className="text-[10px] text-muted-foreground">
                                {pushRegistered && pushEnabled
                                    ? "Background alerts are enabled on this device."
                                    : pushPermission === "denied"
                                        ? "Browser permission is blocked for this device."
                                        : "Enable push for instant updates even when the app is closed."}
                            </p>
                        </div>
                        {pushRegistered && pushEnabled ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full text-[10px] font-black uppercase tracking-wider"
                                onClick={() => disablePushNotifications()}
                            >
                                Disable
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                className="rounded-full text-[10px] font-black uppercase tracking-wider"
                                disabled={pushPermission === "denied"}
                                onClick={() => enablePushNotifications().catch(() => {})}
                            >
                                Enable
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <div className="max-h-[400px] overflow-y-auto">
                {unreadNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                        <div className="w-16 h-16 rounded-full bg-accent/50 flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">All caught up!</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase tracking-tighter">No new notifications</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/50">
                        <AnimatePresence initial={false}>
                            {unreadNotifications.map((n) => (
                                <motion.div
                                    key={n._id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    onClick={() => handleNotificationClick(n)}
                                    className="p-4 hover:bg-accent/30 transition-colors relative group bg-primary/5 cursor-pointer active:scale-[0.98]"
                                >
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary group-hover:w-1.5 transition-all" />
                                    <div className="flex gap-4">
                                        <div className="mt-1 w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                                            {getIcon(n.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-black leading-tight mb-1 text-foreground group-hover:text-primary transition-colors">
                                                {n.title}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed mb-2 line-clamp-2">
                                                {n.message}
                                            </p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                                </span>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteNotification(n._id);
                                                    }}
                                                    className="h-6 w-6 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationDropdown;
