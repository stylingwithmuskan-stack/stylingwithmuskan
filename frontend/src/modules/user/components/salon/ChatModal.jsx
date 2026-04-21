import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Smile, Paperclip, Phone, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { io } from "socket.io-client";
import { api } from "@/modules/user/lib/api";
import { useBookingChat } from "@/modules/user/contexts/BookingChatContext";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

const ChatModal = ({ isOpen, onClose, booking }) => {
    const { setActiveChatId, clearUnread } = useBookingChat();
    const bookingId = booking?._id || booking?.id;
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const scrollRef = useRef(null);
    const socketRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        if (!bookingId) return;
        try {
            const res = await api.bookings.getChatHistory(bookingId);
            setMessages(res.messages || []);
        } catch (err) {
            console.error("[Chat] Failed to fetch history:", err);
        } finally {
            setLoading(false);
            setTimeout(scrollToBottom, 50);
        }
    }, [bookingId, scrollToBottom]);

    useEffect(() => {
        if (!isOpen || !bookingId) {
            setActiveChatId(null);
            return;
        }

        setActiveChatId(bookingId);
        clearUnread(bookingId);
        fetchHistory();

        // Initialize socket
        const token = localStorage.getItem("swm_token");
        socketRef.current = io(`${SOCKET_URL}/booking-chat`, {
            auth: { token },
            transports: ["polling", "websocket"]
        });

        socketRef.current.on("connect", () => {
            setConnected(true);
            socketRef.current.emit("join:chat", { bookingId });
        });

        socketRef.current.on("receive:message", (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
            setTimeout(scrollToBottom, 50);
        });

        socketRef.current.on("disconnect", () => {
            setConnected(false);
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.emit("leave:chat", { bookingId });
                socketRef.current.disconnect();
            }
        };
    }, [isOpen, bookingId, fetchHistory, scrollToBottom]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputText.trim() || !connected) return;

        const text = inputText.trim();
        socketRef.current.emit("send:message", { bookingId, message: text });
        setInputText("");
    };

    const formatTime = (dateStr) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return "";
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[300] flex items-center justify-center sm:p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-md"
                />

                <motion.div
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "100%", opacity: 0 }}
                    className="relative w-full max-w-lg h-full sm:h-[80vh] bg-background sm:rounded-[32px] flex flex-col shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                                    {booking?.slot?.provider?.profilePhoto ? (
                                        <img src={booking.slot.provider.profilePhoto} alt="Pro" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                            {booking?.slot?.provider?.name?.charAt(0) || "P"}
                                        </div>
                                    )}
                                </div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">{booking?.slot?.provider?.name || "Professional"}</h3>
                                <p className={`text-[10px] font-bold uppercase tracking-wider ${connected ? 'text-green-600' : 'text-gray-400'}`}>
                                    {connected ? "Online" : "Connecting..."}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {booking?.slot?.provider?.phone && (
                                <a href={`tel:${booking.slot.provider.phone}`} className="p-2 rounded-full hover:bg-accent transition-colors text-muted-foreground">
                                    <Phone className="w-4 h-4" />
                                </a>
                            )}
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-accent transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 custom-scrollbar"
                    >
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Loading history...</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                                <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10">
                                    <MessageSquare className="h-8 w-8 text-primary/30" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">No Messages Yet</h3>
                                    <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                                        Type a message to start chatting with your beautician
                                    </p>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <motion.div
                                    key={msg._id}
                                    initial={{ opacity: 0, x: msg.senderRole === "customer" ? 20 : -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`flex ${msg.senderRole === "customer" ? "justify-end" : "justify-start"}`}
                                >
                                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${msg.senderRole === "customer"
                                            ? "bg-primary text-primary-foreground rounded-tr-none"
                                            : "bg-background text-foreground rounded-tl-none border border-border/50"
                                        }`}>
                                        <p className="text-sm leading-relaxed">{msg.message}</p>
                                        <div className={`flex items-center gap-1.5 mt-1 justify-end ${msg.senderRole === "customer" ? "opacity-70" : "opacity-40"}`}>
                                            <span className="text-[9px] font-bold">
                                                {formatTime(msg.createdAt)}
                                            </span>
                                            {msg.senderRole === "customer" && (
                                                <CheckCircle2 className="h-2.5 w-2.5" />
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-background border-t border-border">
                        <form
                            onSubmit={handleSendMessage}
                            className="flex items-center gap-2 bg-accent rounded-2xl p-1 px-3"
                        >
                            <button type="button" className="p-2 text-muted-foreground hover:text-primary transition-colors">
                                <Smile className="w-5 h-5" />
                            </button>
                            <input
                                type="text"
                                placeholder="Message professional..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                disabled={!connected}
                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 font-medium disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={!inputText.trim() || !connected}
                                className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 disabled:opacity-50 transition-all active:scale-90"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ChatModal;
