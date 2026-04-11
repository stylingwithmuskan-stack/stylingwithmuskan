import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessageSquare, Send, Loader2, Search, ArrowLeft, Phone, User,
    CheckCircle2, MessageCircle, ChevronRight, Clock, ShieldCheck, ShoppingBag
} from "lucide-react";
import { api } from "@/modules/user/lib/api";

export default function SupportChat() {
    const [conversations, setConversations] = useState([]);
    const [activeParticipantId, setActiveParticipantId] = useState(null);
    const [activeChatMessages, setActiveChatMessages] = useState([]);
    const [activeParticipant, setActiveParticipant] = useState(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [chatLoading, setChatLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [mobileView, setMobileView] = useState("list"); // "list" or "chat"
    const chatEndRef = useRef(null);
    const pollConvRef = useRef(null);
    const pollChatRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, []);

    // ── Fetch conversations ─────────────────────
    const fetchConversations = useCallback(async () => {
        try {
            const { conversations: convs } = await api.admin.supportConversations();
            setConversations(convs || []);
        } catch (err) {
            console.error("[Support] Failed to fetch conversations:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConversations();
        pollConvRef.current = setInterval(fetchConversations, 8000);
        return () => clearInterval(pollConvRef.current);
    }, [fetchConversations]);

    // ── Fetch active chat ─────────────────────
    const fetchChat = useCallback(async (participantId) => {
        try {
            const { messages: msgs, participant: part } = await api.admin.supportChat(participantId);
            setActiveChatMessages(msgs || []);
            setActiveParticipant(part || null);
        } catch (err) {
            console.error("[Support] Failed to fetch chat:", err);
        } finally {
            setChatLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!activeParticipantId) {
            clearInterval(pollChatRef.current);
            return;
        }
        setChatLoading(true);
        fetchChat(activeParticipantId);
        pollChatRef.current = setInterval(() => fetchChat(activeParticipantId), 5000);
        return () => clearInterval(pollChatRef.current);
    }, [activeParticipantId, fetchChat]);

    // Auto-scroll when chat messages change
    useEffect(() => {
        if (activeChatMessages.length) scrollToBottom();
    }, [activeChatMessages, scrollToBottom]);

    // ── Handlers ─────────────────────
    const handleSelectParticipant = (participantId) => {
        setActiveParticipantId(participantId);
        setMobileView("chat");
        // Update unread count locally
        setConversations((prev) =>
            prev.map((c) => (c.participantId === participantId ? { ...c, unreadCount: 0 } : c))
        );
    };

    const handleBackToList = () => {
        setMobileView("list");
        setActiveParticipantId(null);
        setActiveChatMessages([]);
        setActiveParticipant(null);
        fetchConversations();
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!message.trim() || sending || !activeParticipantId) return;

        const text = message.trim();
        setSending(true);
        setMessage("");

        // Optimistic update
        const tempMsg = {
            _id: `temp-${Date.now()}`,
            sender: "admin",
            message: text,
            createdAt: new Date().toISOString(),
        };
        setActiveChatMessages((prev) => [...prev, tempMsg]);
        scrollToBottom();

        try {
            const { chat } = await api.admin.supportReply(activeParticipantId, text);
            setActiveChatMessages((prev) =>
                prev.map((m) => (m._id === tempMsg._id ? chat : m))
            );
            // Also update last message in conversations list
            setConversations((prev) =>
                prev.map((c) =>
                    c.participantId === activeParticipantId
                        ? { ...c, lastMessage: text, lastSender: "admin", lastMessageAt: new Date().toISOString() }
                        : c
                )
            );
        } catch (err) {
            console.error("[Support] Failed to send reply:", err);
            setActiveChatMessages((prev) => prev.filter((m) => m._id !== tempMsg._id));
            setMessage(text);
        } finally {
            setSending(false);
        }
    };

    // ── Helpers ─────────────────────
    const formatTime = (dateStr) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        } catch {
            return "";
        }
    };

    const formatDateSeparator = (dateStr) => {
        try {
            const d = new Date(dateStr);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            if (d.toDateString() === today.toDateString()) return "Today";
            if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
            return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        } catch {
            return "";
        }
    };

    const timeAgo = (dateStr) => {
        try {
            const d = new Date(dateStr);
            const now = new Date();
            const diff = Math.floor((now - d) / 1000);
            if (diff < 60) return "Just now";
            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
            return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        } catch {
            return "";
        }
    };

    const filteredConversations = conversations.filter((c) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            (c.participantName || "").toLowerCase().includes(q) ||
            (c.participantPhone || "").includes(q)
        );
    });

    const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

    // Group active chat messages by date
    const groupedMessages = activeChatMessages.reduce((acc, msg) => {
        const dateKey = new Date(msg.createdAt).toDateString();
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(msg);
        return acc;
    }, {});

    // ── RENDER ─────────────────────
    return (
        <div>
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    Support Chat
                    {totalUnread > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
                            {totalUnread} new
                        </span>
                    )}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage support messages from providers and vendors
                </p>
            </div>

            {/* Main Chat Container */}
            <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden" style={{ height: "calc(100vh - 200px)", minHeight: "500px" }}>
                <div className="flex h-full">
                    {/* ── LEFT: Conversations List ── */}
                    <div
                        className={`w-full md:w-[340px] md:min-w-[340px] border-r border-border flex flex-col bg-card ${
                            mobileView === "chat" ? "hidden md:flex" : "flex"
                        }`}
                    >
                        {/* Search */}
                        <div className="p-3 border-b border-border">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search participants..."
                                    className="w-full h-10 pl-10 pr-4 bg-muted rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/50 transition-all border-none"
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center h-40">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : filteredConversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-center px-6">
                                    <MessageCircle className="h-10 w-10 text-muted-foreground/30 mb-2" />
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {searchQuery ? "No matching conversations" : "No conversations yet"}
                                    </p>
                                </div>
                            ) : (
                                filteredConversations.map((conv) => (
                                    <motion.button
                                        key={conv.participantId}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleSelectParticipant(conv.participantId)}
                                        className={`w-full flex items-center gap-3 p-3.5 border-b border-border/50 text-left transition-all hover:bg-muted/60 ${
                                            activeParticipantId === conv.participantId ? "bg-primary/5 border-l-2 border-l-primary" : ""
                                        }`}
                                    >
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                            <div className={`h-11 w-11 rounded-full flex items-center justify-center ${
                                                conv.participantRole === "vendor" ? "bg-emerald-100" : "bg-purple-100"
                                            }`}>
                                                {conv.participantRole === "vendor" ? (
                                                    <ShoppingBag className="h-5 w-5 text-emerald-600" />
                                                ) : (
                                                    <ShieldCheck className="h-5 w-5 text-purple-600" />
                                                )}
                                            </div>
                                            {conv.unreadCount > 0 && (
                                                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-card">
                                                    {conv.unreadCount}
                                                </span>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-sm font-bold text-foreground truncate">
                                                    {conv.participantName || "Unknown"}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground font-medium flex-shrink-0 ml-2">
                                                    {timeAgo(conv.lastMessageAt)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-xs text-muted-foreground truncate flex-1">
                                                    {conv.lastSender === "admin" && (
                                                        <span className="text-primary font-semibold">You: </span>
                                                    )}
                                                    {conv.lastMessage}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between mt-0.5">
                                                <p className="text-[10px] text-muted-foreground/60 font-medium">
                                                    {conv.participantPhone}
                                                </p>
                                                <span className={`text-[9px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded ${
                                                    conv.participantRole === "vendor" ? "bg-emerald-50 text-emerald-600" : "bg-purple-50 text-purple-600"
                                                }`}>
                                                    {conv.participantRole}
                                                </span>
                                            </div>
                                        </div>

                                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                                    </motion.button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT: Chat Panel ── */}
                    <div
                        className={`flex-1 flex flex-col bg-muted/20 ${
                            mobileView === "list" ? "hidden md:flex" : "flex"
                        }`}
                    >
                        {!activeParticipantId ? (
                            /* Empty state */
                            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center mb-4">
                                    <MessageSquare className="h-12 w-12 text-purple-300" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground mb-1">Select a Conversation</h3>
                                <p className="text-sm text-muted-foreground max-w-[280px]">
                                    Choose a provider or vendor from the list to view and reply to their support messages
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Chat Header */}
                                <div className="bg-card px-4 py-3 border-b border-border flex items-center gap-3">
                                    <button
                                        onClick={handleBackToList}
                                        className="md:hidden p-1.5 hover:bg-muted rounded-lg transition-colors"
                                    >
                                        <ArrowLeft className="h-5 w-5" />
                                    </button>
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        activeParticipant?.role === "vendor" ? "bg-emerald-100 text-emerald-600" : "bg-purple-100 text-purple-600"
                                    }`}>
                                        {activeParticipant?.role === "vendor" ? <ShoppingBag className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-foreground truncate">
                                            {activeParticipant?.name || activeParticipant?.businessName || "Participant"}
                                        </h3>
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                            <Phone className="h-3 w-3" />
                                            <span>{activeParticipant?.phone || ""}</span>
                                            <span className="uppercase text-[9px] font-black bg-muted px-1.5 rounded">{activeParticipant?.role}</span>
                                            {activeParticipant?.city && (
                                                <>
                                                    <span>•</span>
                                                    <span>{activeParticipant.city}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Chat Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {chatLoading ? (
                                        <div className="flex items-center justify-center h-full">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    ) : activeChatMessages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-center">
                                            <MessageCircle className="h-10 w-10 text-muted-foreground/20 mb-2" />
                                            <p className="text-sm text-muted-foreground">No messages yet</p>
                                        </div>
                                    ) : (
                                        Object.entries(groupedMessages).map(([dateKey, dayMsgs]) => (
                                            <div key={dateKey}>
                                                <div className="text-center mb-3">
                                                    <span className="bg-muted px-3 py-1 rounded-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                        {formatDateSeparator(dayMsgs[0].createdAt)}
                                                    </span>
                                                </div>
                                                <div className="space-y-2.5">
                                                    {dayMsgs.map((msg) => (
                                                        <div
                                                            key={msg._id}
                                                            className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}
                                                        >
                                                            <div className="max-w-[75%]">
                                                                <div
                                                                    className={`p-3 rounded-2xl shadow-sm ${
                                                                        msg.sender === "admin"
                                                                            ? "bg-primary text-primary-foreground rounded-tr-none"
                                                                            : "bg-card text-foreground rounded-tl-none border border-border"
                                                                    }`}
                                                                >
                                                                    {msg.sender !== "admin" && (
                                                                        <p className="text-[10px] font-bold text-primary mb-1 uppercase tracking-tighter">
                                                                            {msg.sender}
                                                                        </p>
                                                                    )}
                                                                    {msg.sender === "admin" && (
                                                                        <p className="text-[10px] font-bold text-primary-foreground/70 mb-1">You (Admin)</p>
                                                                    )}
                                                                    <p className="text-[13px] leading-relaxed font-medium">{msg.message}</p>
                                                                </div>
                                                                <div className={`flex items-center gap-1.5 mt-1 ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}>
                                                                    <span className="text-[10px] text-muted-foreground font-medium">
                                                                        {formatTime(msg.createdAt)}
                                                                    </span>
                                                                    {msg.sender === "admin" && !msg._id?.startsWith("temp-") && (
                                                                        <CheckCircle2 className="h-3 w-3 text-primary/60" />
                                                                    )}
                                                                    {msg._id?.startsWith("temp-") && (
                                                                        <Loader2 className="h-3 w-3 text-primary/40 animate-spin" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Chat Input */}
                                <div className="p-3 bg-card border-t border-border">
                                    <form onSubmit={handleSend} className="relative">
                                        <input
                                            type="text"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Type your reply..."
                                            className="w-full h-11 pl-4 pr-12 bg-muted rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/50 transition-all border-none"
                                        />
                                        <button
                                            type="submit"
                                            disabled={sending || !message.trim()}
                                            className={`absolute right-1.5 top-1.5 h-8 w-8 flex items-center justify-center rounded-lg transition-all ${
                                                message.trim() && !sending
                                                    ? "bg-primary text-primary-foreground shadow-md"
                                                    : "bg-muted-foreground/10 text-muted-foreground"
                                            }`}
                                        >
                                            {sending ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Send className="h-4 w-4" />
                                            )}
                                        </button>
                                    </form>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
