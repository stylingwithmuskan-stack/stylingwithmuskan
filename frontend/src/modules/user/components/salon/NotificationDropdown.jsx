import React, { useEffect, useRef } from "react";
import { useNotifications } from "@/modules/user/contexts/NotificationContext";
import { Bell, Trash2, CheckCircle2, Clock, X, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { ScrollArea } from "@/modules/user/components/ui/scroll-area";

const NotificationDropdown = ({ isOpen, onClose }) => {
    const {
        notifications,
        unreadCount,
        markAllAsRead,
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
        if (wasOpen.current && !isOpen && unreadCount > 0) {
            markAllAsRead();
        }
        wasOpen.current = isOpen;
    }, [isOpen, markAllAsRead, unreadCount]);

    if (!isOpen) return null;

    const getIcon = (type) => {
        switch (type) {
            case 'booking_cancel': return <X className="w-4 h-4 text-red-500" />;
            case 'reassignment': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            case 'reminder': return <Clock className="w-4 h-4 text-blue-500" />;
            case 'new_booking': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            default: return <Info className="w-4 h-4 text-slate-500" />;
        }
    };

    return (
        <div className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-card border border-border shadow-2xl rounded-[2rem] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
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

            <ScrollArea className="h-[400px]">
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
                                    className="p-4 hover:bg-accent/30 transition-colors relative group bg-primary/5"
                                >
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                                    <div className="flex gap-4">
                                        <div className="mt-1 w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0 shadow-sm">
                                            {getIcon(n.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-black leading-tight mb-1 text-foreground">
                                                {n.title}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                                                {n.message}
                                            </p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                                </span>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => deleteNotification(n._id)}
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
            </ScrollArea>
        </div>
    );
};

export default NotificationDropdown;
