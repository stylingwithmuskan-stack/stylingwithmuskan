import React from "react";
import { useNotifications } from "@/modules/user/contexts/NotificationContext";
import { Bell, Trash2, CheckCircle2, Clock, X, AlertTriangle, Info, ArrowLeft, Calendar } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { ScrollArea } from "@/modules/user/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";

const NotificationsPage = () => {
    const { notifications, unreadCount, markAllAsRead, deleteNotification, fetchNotifications } = useNotifications();
    const navigate = useNavigate();

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
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="w-10 h-10 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">Notifications</h1>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {unreadCount} Unread Message{unreadCount !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                {unreadCount > 0 && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={markAllAsRead}
                        className="text-[10px] font-black uppercase tracking-widest border-primary/20 hover:bg-primary/10 text-primary"
                    >
                        Mark All Read
                    </Button>
                )}
            </header>

            <main className="max-w-3xl mx-auto p-4 md:p-6 pb-24">
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
                                    className={`relative group rounded-2xl border border-border/50 p-5 transition-all hover:shadow-md ${!n.isRead ? 'bg-primary/[0.03] border-primary/20' : 'bg-card'}`}
                                >
                                    {!n.isRead && (
                                        <div className="absolute left-0 top-6 bottom-6 w-1 bg-primary rounded-r-full" />
                                    )}
                                    
                                    <div className="flex gap-5">
                                        <div className="mt-1 w-12 h-12 rounded-2xl bg-background border border-border/50 flex items-center justify-center flex-shrink-0 shadow-sm">
                                            {getIcon(n.type)}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4 mb-1">
                                                <h3 className="text-base font-black leading-tight text-foreground truncate">
                                                    {n.title}
                                                </h3>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => deleteNotification(n._id)}
                                                    className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
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
