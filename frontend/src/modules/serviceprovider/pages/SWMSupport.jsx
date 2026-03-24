import React, { useState } from "react";
import { ChevronLeft, Headphones, MessageSquare, Phone, Mail, Send, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/modules/user/components/ui/button";

export default function SWMSupport() {
    const navigate = useNavigate();
    const [message, setMessage] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (message.trim()) {
            setSubmitted(true);
            setTimeout(() => setSubmitted(false), 3000);
            setMessage("");
        }
    };

    const chatMessages = [
        { id: 1, type: "bot", text: "Hi Muskan Poswal! I am SWM Assistant.", time: "10:38 AM" },
        { id: 2, type: "bot", text: "How can I help you today regarding your jobs or payments?", time: "10:38 AM" },
    ];

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
