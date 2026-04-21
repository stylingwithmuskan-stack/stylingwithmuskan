import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, CheckCircle2, Loader2, MessageSquare, X } from "lucide-react";
import { io } from "socket.io-client";
import { Button } from "@/modules/user/components/ui/button";
import { api } from "@/modules/user/lib/api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

export default function BookingChat({ bookingId, onClose }) {
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [connected, setConnected] = useState(false);
    const chatEndRef = useRef(null);
    const socketRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, []);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await api.provider.getBookingChatHistory(bookingId);
            setMessages(res.messages || []);
        } catch (err) {
            console.error("[Chat] Failed to fetch history:", err);
        } finally {
            setLoading(false);
            scrollToBottom();
        }
    }, [bookingId, scrollToBottom]);

    useEffect(() => {
        fetchHistory();

        // Initialize socket
        const token = localStorage.getItem("swm_provider_token");
        socketRef.current = io(`${SOCKET_URL}/booking-chat`, {
            auth: { token },
            transports: ["polling", "websocket"]
        });

        socketRef.current.on("connect", () => {
            console.log("[Socket] Connected to booking-chat");
            setConnected(true);
            socketRef.current.emit("join:chat", { bookingId });
        });

        socketRef.current.on("receive:message", (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
            scrollToBottom();
        });

        socketRef.current.on("chat:error", (err) => {
            console.error("[Socket] Chat error:", err);
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
    }, [bookingId, fetchHistory, scrollToBottom]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!message.trim() || !connected) return;

        const text = message.trim();
        socketRef.current.emit("send:message", { bookingId, message: text });
        setMessage("");
    };

    const formatTime = (dateStr) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        } catch {
            return "";
        }
    };

    return (
        <div className="flex flex-col h-[60vh] bg-white rounded-t-3xl shadow-2xl border-t border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-white p-4 flex items-center justify-between border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Chat with Customer</h3>
                        <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest flex items-center gap-1">
                             <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
                             {connected ? "Online" : "Connecting..."}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Loading messages...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                        <div className="h-16 w-16 rounded-full bg-purple-50 flex items-center justify-center">
                            <MessageSquare className="h-8 w-8 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">No Messages Yet</h3>
                            <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-widest">
                                Start chatting with your customer
                            </p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg._id}
                            className={`flex ${msg.senderRole === "provider" ? "justify-end" : "justify-start"}`}
                        >
                            <div className="max-w-[80%]">
                                <div
                                    className={`p-3.5 rounded-2xl shadow-sm ${
                                        msg.senderRole === "provider"
                                            ? "bg-purple-600 text-white rounded-tr-none"
                                            : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                                    }`}
                                >
                                    <p className="text-sm font-medium leading-relaxed">{msg.message}</p>
                                </div>
                                <div className={`flex items-center gap-1.5 mt-1 ${msg.senderRole === "provider" ? "justify-end" : "justify-start"}`}>
                                    <span className="text-[9px] text-gray-400 font-black uppercase tracking-tighter">
                                        {formatTime(msg.createdAt)}
                                    </span>
                                    {msg.senderRole === "provider" && (
                                        <CheckCircle2 className="h-2.5 w-2.5 text-purple-400" />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100 pb-8 shrink-0">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type message..."
                        disabled={!connected}
                        className="w-full bg-gray-50 h-12 pl-5 pr-14 rounded-2xl border-none focus:ring-2 focus:ring-purple-500 text-[13px] font-bold transition-all outline-none disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!message.trim() || !connected}
                        className={`absolute right-1.5 top-1.5 h-9 w-9 flex items-center justify-center rounded-xl transition-all ${
                            message.trim() && connected
                                ? "bg-purple-600 text-white shadow-lg"
                                : "bg-gray-200 text-gray-400"
                        }`}
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
