import React, { useState } from "react";
import { useNotifications } from "@/modules/user/contexts/NotificationContext";
import { Bell, Trash2, CheckCircle2, Clock, X, AlertTriangle, Info, ArrowLeft, Calendar, Square, CheckSquare, MoreVertical, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { ScrollArea } from "@/modules/user/components/ui/scroll-area";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/modules/user/lib/utils";

const NotificationsPage = () => {
    const {
        notifications,
        unreadCount,
        loading,
        activeRole,
        markAllAsRead,
        markAsRead,
        deleteNotification,
        deleteAllNotifications,
        deleteMultipleNotifications,
        fetchNotifications,
        pushSupported,
        pushPermission,
        pushRegistered,
        pushEnabled,
        enablePushNotifications,
        disablePushNotifications,
    } = useNotifications();
    const navigate = useNavigate();
    const location = useLocation();

    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const [selectedIds, setSelectedIds] = useState([]);
    const [isSelectMode, setIsSelectMode] = useState(false);

    const toggleSelectAll = () => {
        if (selectedIds.length === notifications.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(notifications.map(n => n._id));
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleNotificationClick = async (n) => {
        // If in select mode, toggle selection instead of redirecting
        if (isSelectMode) {
            toggleSelect(n._id);
            return;
        }

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
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        if (confirm(`Delete ${selectedIds.length} notifications?`)) {
            await deleteMultipleNotifications(selectedIds);
            setSelectedIds([]);
            setIsSelectMode(false);
        }
    };

    const handleDeleteAll = async () => {
        if (confirm("Are you sure you want to delete ALL notifications? This cannot be undone.")) {
            await deleteAllNotifications();
            setSelectedIds([]);
            setIsSelectMode(false);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'booking_cancel': return <X className="w-5 h-5 text-red-500" />;
            case 'reassignment': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            case 'reminder': return <Clock className="w-5 h-5 text-blue-500" />;
            case 'new_booking': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case 'sos_alert': return <AlertTriangle className="w-5 h-5 text-red-600" />;
            default: return <Info className="w-5 h-5 text-slate-500" />;
        }
    };

    // Sort notifications by date (recent first)
    const sortedNotifications = [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return (
        <div className="min-h-screen bg-white md:bg-slate-50/30">
            {/* Sticky Header */}
            <div className={cn(
                "sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b transition-all safe-top",
                activeRole === "provider" ? "px-4 py-3 border-slate-100 shadow-none" : "max-w-3xl mx-auto px-4 py-3 border-slate-100 shadow-sm"
            )}>
                <div className={cn("flex items-center justify-between gap-3", activeRole !== "provider" && "max-w-3xl mx-auto")}>
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => {
                                if (window.history.length > 1 && location.key !== "default") {
                                    navigate(-1);
                                } else {
                                    navigate("/home");
                                }
                            }}
                            className={cn(
                                "shrink-0 transition-all active:scale-95 group flex items-center justify-center",
                                activeRole === "provider" 
                                    ? "p-2.5 bg-violet-100 hover:bg-violet-200 rounded-full" 
                                    : "w-10 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/50 text-slate-600"
                            )}
                        >
                            <ArrowLeft className={cn("w-5 h-5", activeRole === "provider" ? "text-violet-700" : "")} />
                        </button>
                        <div className="min-w-0 flex-1">
                            <h1 className={cn(
                                "uppercase tracking-tight truncate leading-tight",
                                activeRole === "provider" ? "text-lg font-black text-slate-900" : "text-base sm:text-xl font-black text-slate-900"
                            )}>Inbox</h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="h-1.2 w-1.2 sm:h-1.5 sm:w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                <p className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-widest truncate">{unreadCount} New alerts</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={fetchNotifications}
                            disabled={loading}
                            className={cn(
                                "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all border border-slate-200/50",
                                loading && "bg-slate-100"
                            )}
                            title="Refresh Inbox"
                        >
                            <RefreshCw className={cn("w-4 h-4 sm:w-5 sm:h-5", loading && "animate-spin text-primary")} />
                        </Button>
                        {unreadCount > 0 && !isSelectMode && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={markAllAsRead}
                                className="text-[9px] sm:text-[10px] h-9 font-black uppercase tracking-widest border-emerald-100 hover:bg-emerald-50 text-emerald-700 bg-white shadow-sm px-2 sm:px-4 rounded-xl flex items-center"
                            >
                                <span className="hidden xs:inline">Read All</span>
                                <CheckCircle2 className="w-4 h-4 xs:hidden" />
                            </Button>
                        )}
                        {notifications.length > 0 && !isSelectMode && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleDeleteAll}
                                className="text-[9px] sm:text-[10px] h-9 font-black uppercase tracking-widest text-red-500 hover:bg-red-50 px-2 sm:px-4 rounded-xl flex items-center"
                            >
                                <span className="hidden xs:inline">Clear All</span>
                                <Trash2 className="w-4 h-4 xs:hidden" />
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                variant={isSelectMode ? "destructive" : "ghost"}
                                size="sm"
                                onClick={() => {
                                    if (isSelectMode) {
                                        setIsSelectMode(false);
                                        setSelectedIds([]);
                                    } else {
                                        setIsSelectMode(true);
                                    }
                                }}
                                className={`text-[9px] sm:text-[10px] h-9 font-black uppercase tracking-widest px-2 sm:px-3 rounded-xl transition-all ${!isSelectMode ? 'text-slate-500 hover:bg-slate-100' : 'bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none'}`}
                            >
                                {isSelectMode ? 'Done' : 'Edit'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <main className="max-w-3xl mx-auto px-4 md:px-6 pb-24 pt-4">

            {/* Selection Toolbar */}
            <AnimatePresence>
                {isSelectMode && notifications.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-primary/[0.03] border-b border-primary/10 px-4 py-2.5 flex items-center justify-between sticky top-[65px] sm:top-[73px] z-20 backdrop-blur-md overflow-x-auto hide-scrollbar gap-4"
                    >
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <button 
                                onClick={toggleSelectAll}
                                className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-black uppercase tracking-tight text-slate-700"
                            >
                                {selectedIds.length === notifications.length ? (
                                    <CheckSquare className="w-4 h-4 text-primary" />
                                ) : (
                                    <Square className="w-4 h-4" />
                                )}
                                <span className="whitespace-nowrap">{selectedIds.length === notifications.length ? "None" : "All"}</span>
                            </button>
                            <div className="h-4 w-px bg-slate-200" />
                            <span className="text-[9px] sm:text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                                {selectedIds.length} <span className="hidden xs:inline">Selected</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            {selectedIds.length > 0 && (
                                <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={handleDeleteSelected}
                                    className="h-8 px-2 sm:px-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest gap-1.5 sm:gap-2 rounded-lg"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Delete</span>
                                </Button>
                            )}
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={handleDeleteAll}
                                className="h-8 px-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-lg"
                            >
                                <span className="whitespace-nowrap">Clear All</span>
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="mt-6">
                {pushSupported && !isSelectMode && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                    >
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-wider">Push Notifications</h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                {pushRegistered && pushEnabled
                                    ? "Instant background alerts are active on this device."
                                    : pushPermission === "denied"
                                        ? "Browser permission is blocked. Allow notifications in browser settings to enable push."
                                        : "Enable push to receive real-time alerts even when the app is in background."}
                            </p>
                        </div>
                        {pushRegistered && pushEnabled ? (
                            <Button
                                variant="outline"
                                className="rounded-xl font-bold"
                                onClick={() => disablePushNotifications()}
                            >
                                Disable Push
                            </Button>
                        ) : (
                            <Button
                                className="rounded-xl font-bold"
                                disabled={pushPermission === "denied"}
                                onClick={() => enablePushNotifications().catch(() => {})}
                            >
                                Enable Push
                            </Button>
                        )}
                    </motion.div>
                )}

                {sortedNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 rounded-full bg-accent/50 flex items-center justify-center mb-6">
                            <Bell className="w-10 h-10 text-muted-foreground/30" />
                        </div>
                        <h2 className="text-lg font-bold text-foreground mb-2">Inbox Empty</h2>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            You're all caught up! New alerts will appear here as they arrive.
                        </p>
                        <Button 
                            variant="link" 
                            onClick={fetchNotifications}
                            className="mt-4 text-primary font-bold uppercase text-xs tracking-widest"
                        >
                            Refresh Inbox
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <AnimatePresence initial={false}>
                            {sortedNotifications.map((n, idx) => (
                                <motion.div
                                    key={n._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => handleNotificationClick(n)}
                                    className={`relative group rounded-2xl border border-border/50 p-5 transition-all cursor-pointer hover:shadow-md active:scale-[0.99] ${isSelectMode && selectedIds.includes(n._id) ? 'ring-2 ring-primary border-transparent' : ''} ${!n.isRead ? 'bg-primary/[0.03] border-primary/20' : 'bg-card'}`}
                                >
                                    {!n.isRead && (
                                        <div className="absolute left-0 top-6 bottom-6 w-1 bg-primary rounded-r-full" />
                                    )}
                                    
                                    <div className="flex gap-3 sm:gap-5">
                                        {isSelectMode ? (
                                            <div className="mt-1 flex-shrink-0">
                                                {selectedIds.includes(n._id) ? (
                                                    <CheckSquare className="w-6 h-6 text-primary" />
                                                ) : (
                                                    <Square className="w-6 h-6 text-muted-foreground/30" />
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-1 w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-background border border-border/50 flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-110 overflow-hidden">
                                                {n.icon ? (
                                                    n.icon.trim().startsWith('<') ? (
                                                        <div 
                                                            className="w-full h-full flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6 [&>i]:text-xl"
                                                            dangerouslySetInnerHTML={{ __html: n.icon }} 
                                                        />
                                                    ) : (
                                                        <img src={n.icon} alt="" className="w-full h-full object-cover" />
                                                    )
                                                ) : (
                                                    getIcon(n.type)
                                                )}
                                            </div>
                                        )}
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 sm:gap-4 mb-1">
                                                <h3 className="text-sm sm:text-base font-black leading-tight text-slate-900 truncate group-hover:text-primary transition-colors">
                                                    {n.title}
                                                </h3>
                                                {!isSelectMode && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={(e) => { e.stopPropagation(); deleteNotification(n._id); }}
                                                        className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                            
                                            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-3 sm:mb-4 line-clamp-2">
                                                {n.message}
                                            </p>
                                            
                                            {n.image && (
                                                <div className="mb-4 rounded-2xl overflow-hidden border border-border/50 bg-accent/5 max-w-sm">
                                                    <img src={n.image} alt="" className="w-full max-h-64 object-contain" />
                                                </div>
                                            )}
                                            
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {format(new Date(n.createdAt), 'dd MMM, hh:mm a')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
            </main>
        </div>
    );
};

export default NotificationsPage;
