import React, { useState } from "react";
import { useNotifications } from "@/modules/user/contexts/NotificationContext";
import { Bell, Trash2, CheckCircle2, Clock, X, AlertTriangle, Info, ArrowLeft, Calendar, Square, CheckSquare, MoreVertical } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { ScrollArea } from "@/modules/user/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";

const NotificationsPage = () => {
    const {
        notifications,
        unreadCount,
        markAllAsRead,
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
            default: return <Info className="w-5 h-5 text-slate-500" />;
        }
    };

    // Sort notifications by date (recent first)
    const sortedNotifications = [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return (
        <div className="min-h-screen bg-white">
            <main className="max-w-3xl mx-auto p-4 md:p-6 pb-24 pt-10">
                {/* Inline Header */}
                <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate(-1)} 
                            className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Notifications</h1>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                {unreadCount} New alerts
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {notifications.length > 0 && !isSelectMode && (
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setIsSelectMode(true)}
                                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                            >
                                Select
                            </Button>
                        )}
                        {unreadCount > 0 && !isSelectMode && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={markAllAsRead}
                                className="text-[10px] font-black uppercase tracking-widest border-emerald-100 hover:bg-emerald-50 text-emerald-700 bg-white shadow-sm h-8"
                            >
                                Read All
                            </Button>
                        )}
                        {isSelectMode && (
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => { setIsSelectMode(false); setSelectedIds([]); }}
                                className="text-[10px] font-black uppercase tracking-widest text-emerald-600"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>

            {/* Selection Toolbar */}
            <AnimatePresence>
                {isSelectMode && notifications.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-accent/50 border-b border-border px-4 py-3 flex items-center justify-between sticky top-[73px] z-20 backdrop-blur-sm"
                    >
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={toggleSelectAll}
                                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                            >
                                {selectedIds.length === notifications.length ? (
                                    <CheckSquare className="w-4 h-4 text-primary" />
                                ) : (
                                    <Square className="w-4 h-4" />
                                )}
                                {selectedIds.length === notifications.length ? "Deselect All" : "Select All"}
                            </button>
                            <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded-full">
                                {selectedIds.length} Selected
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedIds.length > 0 && (
                                <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={handleDeleteSelected}
                                    className="h-8 text-[10px] font-black uppercase tracking-widest gap-2"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                                </Button>
                            )}
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={handleDeleteAll}
                                className="h-8 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10"
                            >
                                Clear All
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <main className="max-w-3xl mx-auto p-4 md:p-6 pb-24">
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
                                    onClick={() => isSelectMode && toggleSelect(n._id)}
                                    className={`relative group rounded-2xl border border-border/50 p-5 transition-all cursor-pointer hover:shadow-md ${isSelectMode && selectedIds.includes(n._id) ? 'ring-2 ring-primary border-transparent' : ''} ${!n.isRead ? 'bg-primary/[0.03] border-primary/20' : 'bg-card'}`}
                                >
                                    {!n.isRead && (
                                        <div className="absolute left-0 top-6 bottom-6 w-1 bg-primary rounded-r-full" />
                                    )}
                                    
                                    <div className="flex gap-5">
                                        {isSelectMode ? (
                                            <div className="mt-1 flex-shrink-0">
                                                {selectedIds.includes(n._id) ? (
                                                    <CheckSquare className="w-6 h-6 text-primary" />
                                                ) : (
                                                    <Square className="w-6 h-6 text-muted-foreground/30" />
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-1 w-12 h-12 rounded-2xl bg-background border border-border/50 flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-110">
                                                {getIcon(n.type)}
                                            </div>
                                        )}
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4 mb-1">
                                                <h3 className="text-base font-black leading-tight text-foreground truncate">
                                                    {n.title}
                                                </h3>
                                                {!isSelectMode && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={(e) => { e.stopPropagation(); deleteNotification(n._id); }}
                                                        className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                            
                                            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                                {n.message}
                                            </p>
                                            
                                            <div className="flex items-center gap-4 text-[11px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                                </div>
                                                <div className="flex items-center gap-1.5">
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
            </main>
        </div>
    );
};

export default NotificationsPage;
