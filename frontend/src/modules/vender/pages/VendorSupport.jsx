import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, Phone, Send, CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/modules/user/components/ui/button";
import { api } from "@/modules/user/lib/api";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";

export default function VendorSupport() {
    const navigate = useNavigate();
    const { vender } = useVenderAuth();
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const chatEndRef = useRef(null);
    const pollRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, []);

    const fetchMessages = useCallback(async () => {
        try {
            const { messages: msgs } = await api.vendor.support.getMessages();
            setMessages(msgs || []);
        } catch (err) {
            console.error("[Support] Failed to fetch messages:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    // Poll every 5 seconds for new messages
    useEffect(() => {
        pollRef.current = setInterval(() => {
            fetchMessages();
        }, 5000);
        return () => clearInterval(pollRef.current);
    }, [fetchMessages]);

    // Auto-scroll when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim() || sending) return;

        const text = message.trim();
        setSending(true);
        setMessage("");

        // Optimistic update
        const tempMsg = {
            _id: `temp-${Date.now()}`,
            sender: "vendor",
            message: text,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempMsg]);
        scrollToBottom();

        try {
            const { chat } = await api.vendor.support.sendMessage(text);
            // Replace temp with real message
            setMessages((prev) =>
                prev.map((m) => (m._id === tempMsg._id ? chat : m))
            );
        } catch (err) {
            console.error("[Support] Failed to send:", err);
            // Remove temp message on error
            setMessages((prev) => prev.filter((m) => m._id !== tempMsg._id));
            setMessage(text); // Restore the message for retry
        } finally {
            setSending(false);
        }
    };

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

    // Group messages by date
    const groupedMessages = messages.reduce((acc, msg) => {
        const dateKey = new Date(msg.createdAt).toDateString();
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(msg);
        return acc;
    }, {});

    return (
        <div className="flex flex-col h-screen bg-slate-50 -m-4 md:m-0">
            {/* Header */}
            <div className="bg-white p-4 pt-10 flex items-center justify-between border-b border-gray-100 shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ChevronLeft className="h-6 w-6 text-slate-900" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">SWM Support</h1>
                        <p className="text-[10px] text-green-600 font-bold">● Online</p>
                    </div>
                </div>
                <Button variant="outline" className="rounded-full border-slate-200 text-slate-700 font-bold gap-2 text-xs">
                    <Phone className="h-3.5 w-3.5" /> Call
                </Button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                        <p className="text-sm text-slate-500 font-medium">Loading messages...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                        <div className="h-20 w-20 rounded-full bg-purple-50 flex items-center justify-center">
                            <MessageCircle className="h-10 w-10 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Vendor Support</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Send a message and our support team will get back to you shortly.
                            </p>
                        </div>
                    </div>
                ) : (
                    Object.entries(groupedMessages).map(([dateKey, dayMessages]) => (
                        <div key={dateKey}>
                            <div className="text-center mb-4">
                                <span className="bg-slate-200 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    {formatDateSeparator(dayMessages[0].createdAt)}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {dayMessages.map((msg) => (
                                    <div
                                        key={msg._id}
                                        className={`flex ${msg.sender === "vendor" ? "justify-end" : "justify-start"}`}
                                    >
                                        <div className={`max-w-[80%] ${msg.sender === "vendor" ? "order-1" : ""}`}>
                                            <div
                                                className={`p-3.5 rounded-2xl shadow-sm ${
                                                    msg.sender === "vendor"
                                                        ? "bg-purple-600 text-white rounded-tr-none"
                                                        : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                                                }`}
                                            >
                                                {msg.sender === "admin" && (
                                                    <p className="text-[10px] font-bold text-purple-600 mb-1">SWM Admin</p>
                                                )}
                                                <p className="text-[14px] leading-relaxed font-medium">{msg.message}</p>
                                            </div>
                                            <div className={`flex items-center gap-1.5 mt-1 ${msg.sender === "vendor" ? "justify-end" : "justify-start"}`}>
                                                <span className="text-[10px] text-slate-400 font-bold">
                                                    {formatTime(msg.createdAt)}
                                                </span>
                                                {msg.sender === "vendor" && !msg._id?.startsWith("temp-") && (
                                                    <CheckCircle2 className="h-3 w-3 text-purple-400" />
                                                )}
                                                {msg._id?.startsWith("temp-") && (
                                                    <Loader2 className="h-3 w-3 text-purple-300 animate-spin" />
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

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 pb-8">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type your message here..."
                        className="w-full bg-slate-100 h-12 pl-5 pr-14 rounded-2xl border-none focus:ring-2 focus:ring-purple-500 text-[14px] font-medium transition-all outline-none"
                    />
                    <button
                        type="submit"
                        disabled={sending || !message.trim()}
                        className={`absolute right-1.5 top-1.5 h-9 w-9 flex items-center justify-center rounded-xl transition-all ${
                            message.trim() && !sending
                                ? "bg-purple-600 text-white shadow-lg"
                                : "bg-slate-200 text-slate-400"
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
        </div>
    );
}
