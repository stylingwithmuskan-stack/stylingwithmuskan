import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Smile, Paperclip, MoreVertical, Phone, Video } from "lucide-react";
import { useAuth } from "@/modules/user/contexts/AuthContext";

const ChatModal = ({ isOpen, onClose, booking }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([
        { id: 1, text: "Hello! I am your beautician for the session.", sender: "beautician", time: "10:30 AM" },
        { id: 2, text: "I'll be arriving at your location by 11:00 AM.", sender: "beautician", time: "10:31 AM" },
        { id: 3, text: "Sure, I'll be ready!", sender: "customer", time: "10:35 AM" }
    ]);
    const [inputText, setInputText] = useState("");
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const newMessage = {
            id: Date.now(),
            text: inputText,
            sender: "customer",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages([...messages, newMessage]);
        setInputText("");

        // Mock auto-reply
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: "Got it! See you soon.",
                sender: "beautician",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }, 1500);
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
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10">
                                    <img src={booking?.image} alt="Pro" className="w-full h-full object-cover" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Professional Chat</h3>
                                <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Online</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-2 rounded-full hover:bg-accent transition-colors text-muted-foreground">
                                <Phone className="w-4 h-4" />
                            </button>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-accent transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8f9fa] custom-scrollbar"
                    >
                        <div className="text-center my-4">
                            <span className="text-[10px] font-bold text-muted-foreground bg-accent px-3 py-1 rounded-full uppercase tracking-tighter">
                                Secure Masked Workspace
                            </span>
                        </div>

                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, x: msg.sender === "customer" ? 20 : -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${msg.sender === "customer"
                                        ? "bg-primary text-primary-foreground rounded-tr-none"
                                        : "bg-background text-foreground rounded-tl-none border border-border/50"
                                    }`}>
                                    <p className="text-sm leading-relaxed">{msg.text}</p>
                                    <p className={`text-[9px] mt-1 text-right opacity-60 ${msg.sender === "customer" ? "text-white" : "text-muted-foreground"}`}>
                                        {msg.time}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
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
                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 font-medium"
                            />
                            <button type="button" className="p-2 text-muted-foreground hover:text-primary transition-colors">
                                <Paperclip className="w-5 h-5" />
                            </button>
                            <button
                                type="submit"
                                disabled={!inputText.trim()}
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
