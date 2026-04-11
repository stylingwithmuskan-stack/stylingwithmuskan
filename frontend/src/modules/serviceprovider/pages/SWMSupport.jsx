import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, Headphones, MessageSquare, Phone, Mail, Send, CheckCircle2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/modules/user/components/ui/button";
import { useProviderAuth } from "../contexts/ProviderAuthContext";
import { api } from "@/modules/user/lib/api";
import { toast } from "sonner";
import { io } from "socket.io-client";

export default function SWMSupport() {
    const navigate = useNavigate();
    const { provider } = useProviderAuth();
    const [message, setMessage] = useState("");
    const [tickets, setTickets] = useState([]);
    const [activeTicket, setActiveTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [socket, setSocket] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Scroll to bottom when messages change
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load tickets on mount
    useEffect(() => {
        loadTickets();
    }, []);

    // Setup socket connection
    useEffect(() => {
        if (!provider?.phone) return;

        const token = localStorage.getItem("muskan-provider-token");
        if (!token) return;

        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
        const socketUrl = apiBaseUrl.replace(/^http/, "ws").replace(/:\d+$/, ":3001");

        const newSocket = io(`${socketUrl}/provider`, {
            auth: { token },
            transports: ["polling", "websocket"],
        });

        newSocket.on("connect", () => {
            console.log("Connected to support socket");
        });

        newSocket.on("support:admin_message", (data) => {
            console.log("Received admin message:", data);
            if (activeTicket && data.ticketId === activeTicket.ticketId) {
                setMessages((prev) => [
                    ...prev,
                    {
                        sender: "admin",
                        senderName: data.senderName,
                        text: data.message,
                        timestamp: new Date(),
                        read: false,
                    },
                ]);
                // Mark as read
                markAsRead(activeTicket._id || activeTicket.ticketId);
            } else {
                // Reload tickets to show unread count
                loadTickets();
            }
        });

        newSocket.on("support:admin_typing", (data) => {
            if (activeTicket && data.ticketId === activeTicket.ticketId) {
                setIsTyping(true);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
            }
        });

        newSocket.on("support:status_changed", (data) => {
            console.log("Ticket status changed:", data);
            loadTickets();
            if (activeTicket && data.ticketId === activeTicket.ticketId) {
                setActiveTicket((prev) => ({ ...prev, status: data.status }));
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [provider?.phone, activeTicket?.ticketId]);

    const loadTickets = async () => {
        try {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
            const token = localStorage.getItem("muskan-provider-token");
            const response = await fetch(`${apiBaseUrl}/support/tickets?limit=10`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: "include",
            });
            const data = await response.json();
            if (data.success) {
                setTickets(data.tickets || []);
                // If no active ticket and tickets exist, load the first one
                if (!activeTicket && data.tickets.length > 0) {
                    loadTicket(data.tickets[0]);
                }
            }
        } catch (error) {
            console.error("Error loading tickets:", error);
        }
    };

    const loadTicket = async (ticket) => {
        try {
            setLoading(true);
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
            const token = localStorage.getItem("muskan-provider-token");
            const response = await fetch(`${apiBaseUrl}/support/tickets/${ticket._id || ticket.ticketId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: "include",
            });
            const data = await response.json();
            if (data.success) {
                setActiveTicket(data.ticket);
                setMessages(data.ticket.messages || []);
                // Mark as read
                markAsRead(data.ticket._id || data.ticket.ticketId);
            }
        } catch (error) {
            console.error("Error loading ticket:", error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (ticketId) => {
        try {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
            const token = localStorage.getItem("muskan-provider-token");
            await fetch(`${apiBaseUrl}/support/tickets/${ticketId}/read`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: "include",
            });
        } catch (error) {
            console.error("Error marking as read:", error);
        }
    };

    const createTicket = async (category) => {
        if (!message.trim()) {
            toast.error("Please enter a message");
            return;
        }

        try {
            setSending(true);
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
            const token = localStorage.getItem("muskan-provider-token");
            const response = await fetch(`${apiBaseUrl}/support/tickets`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                credentials: "include",
                body: JSON.stringify({
                    category,
                    message: message.trim(),
                    priority: "medium",
                }),
            });
            const data = await response.json();
            if (data.success) {
                toast.success("Ticket created successfully");
                setMessage("");
                loadTickets();
                loadTicket(data.ticket);
            } else {
                toast.error(data.error || "Failed to create ticket");
            }
        } catch (error) {
            console.error("Error creating ticket:", error);
            toast.error("Failed to create ticket");
        } finally {
            setSending(false);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim() || !activeTicket) return;

        try {
            setSending(true);
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
            const token = localStorage.getItem("muskan-provider-token");
            const response = await fetch(`${apiBaseUrl}/support/tickets/${activeTicket._id || activeTicket.ticketId}/message`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                credentials: "include",
                body: JSON.stringify({
                    message: message.trim(),
                }),
            });
            const data = await response.json();
            if (data.success) {
                setMessages(data.ticket.messages || []);
                setMessage("");
                loadTickets(); // Refresh ticket list
            } else {
                toast.error(data.error || "Failed to send message");
            }
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Failed to send message");
        } finally {
            setSending(false);
        }
    };

    const handleTyping = () => {
        if (socket && activeTicket) {
            socket.emit("support:typing", { ticketId: activeTicket.ticketId });
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "open":
                return "bg-blue-100 text-blue-700";
            case "in_progress":
                return "bg-yellow-100 text-yellow-700";
            case "resolved":
                return "bg-green-100 text-green-700";
            case "closed":
                return "bg-gray-100 text-gray-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    const getCategoryLabel = (category) => {
        const labels = {
            payment_issue: "Payment Issue",
            job_support: "Job Support",
            general: "General",
            technical: "Technical",
            account: "Account",
            zone_request: "Zone Request",
        };
        return labels[category] || category;
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 -m-4 md:m-0">
            {/* Header */}
            <div className="bg-white p-6 pt-10 flex items-center justify-between border-b border-gray-100 shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ChevronLeft className="h-6 w-6 text-slate-900" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900">SWM Support</h1>
                </div>
                <Button variant="outline" className="rounded-full border-slate-200 text-slate-700 font-bold gap-2">
                    <Phone className="h-4 w-4" /> Call Support
                </Button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="text-center">
                    <span className="bg-slate-200 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest">Today</span>
                </div>

                {chatMessages.map((msg) => (
                    <div key={msg.id} className="flex flex-col gap-1 max-w-[80%]">
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100">
                            <p className="text-[15px] text-slate-800 leading-relaxed font-medium">{msg.text}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold ml-1">{msg.time}</span>
                    </div>
                ))}

                {submitted && (
                    <div className="flex justify-end">
                        <div className="bg-purple-600 text-white p-4 rounded-2xl rounded-tr-none shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <p className="text-[15px] font-medium flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" /> Message Sent Successfully!
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="p-4 grid grid-cols-2 gap-3 bg-slate-50">
                <button className="bg-white p-4 rounded-2xl border border-slate-200 text-left hover:border-purple-300 transition-all shadow-sm group">
                    <MessageSquare className="h-5 w-5 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-bold text-slate-900">Payment Issue</p>
                    <p className="text-[11px] text-slate-500">Delay or discrepancy</p>
                </button>
                <button className="bg-white p-4 rounded-2xl border border-slate-200 text-left hover:border-purple-300 transition-all shadow-sm group">
                    <Headphones className="h-5 w-5 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-bold text-slate-900">Job Support</p>
                    <p className="text-[11px] text-slate-500">Active job help</p>
                </button>
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-slate-100 pb-10">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type your query here..."
                        className="w-full bg-slate-100 h-14 pl-6 pr-14 rounded-2xl border-none focus:ring-2 focus:ring-purple-500 text-[15px] font-medium transition-all"
                    />
                    <button
                        type="submit"
                        className={`absolute right-2 top-2 h-10 w-10 flex items-center justify-center rounded-xl transition-all ${message.trim() ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`}
                    >
                        <Send className="h-5 w-5" />
                    </button>
                </form>
            </div>
        </div>
    );
}
