import React, { useState } from "react";
import { ChevronLeft, Ticket, Send, CheckCircle2, FileText, Upload, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";

export default function TicketRaise() {
    const navigate = useNavigate();
    const [submitted, setSubmitted] = useState(false);
    const [ticketData, setTicketData] = useState({
        category: "Payment Issue",
        subject: "",
        description: "",
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitted(true);
        setTimeout(() => navigate(-1), 4000);
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 -m-4 md:m-0">
            {/* Header */}
            <div className="bg-white p-6 pt-10 flex items-center justify-between border-b border-gray-100 shadow-sm sticky top-0 z-10 transition-all">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ChevronLeft className="h-6 w-6 text-slate-900" />
                    </button>
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <Ticket className="h-5 w-5 text-purple-600" /> Raise a Ticket
                    </h1>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {submitted ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-6 animate-in zoom-in-95">
                        <div className="h-32 w-32 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-xl ring-8 ring-green-500/20">
                            <CheckCircle2 className="h-16 w-16 text-white" />
                        </div>
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Ticket Raised!</h2>
                            <p className="text-slate-500 font-bold text-sm">Ticket ID: #SWM-12345</p>
                            <p className="text-slate-500 font-medium text-xs pt-4">We've received your request and our support team will reach out within 24 hours.</p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ISSUE CATEGORY</Label>
                                    <select
                                        className="w-full bg-slate-50 h-14 px-5 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-purple-500 text-[15px] font-bold outline-none"
                                        value={ticketData.category}
                                        onChange={(e) => setTicketData({ ...ticketData, category: e.target.value })}
                                    >
                                        <option>Payment Issue</option>
                                        <option>Job Cancellation</option>
                                        <option>App Bug / Error</option>
                                        <option>Customer Behavior</option>
                                        <option>Incentive/Bonus Doubt</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SUBJECT</Label>
                                    <Input
                                        className="w-full bg-slate-50 h-14 px-5 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-purple-500 text-[15px] font-bold"
                                        placeholder="Briefly describe the issue"
                                        required
                                        value={ticketData.subject}
                                        onChange={(e) => setTicketData({ ...ticketData, subject: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">DESCRIPTION</Label>
                                    <textarea
                                        rows={4}
                                        className="w-full bg-slate-50 p-5 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-purple-500 text-[15px] font-medium outline-none resize-none"
                                        placeholder="Detailed explanation of the issue..."
                                        required
                                        value={ticketData.description}
                                        onChange={(e) => setTicketData({ ...ticketData, description: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2 pt-2">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SUPPORTING DOCUMENTS (OPTIONAL)</Label>
                                    <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer">
                                        <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                                            <Upload className="h-5 w-5" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-slate-900">Upload Screenshot</p>
                                            <p className="text-[10px] font-bold text-slate-400">JPG, PNG up to 5MB</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1 h-14 bg-white font-bold rounded-2xl border-slate-200 text-slate-700">
                                Cancel
                            </Button>
                            <Button type="submit" className="flex-1 h-14 bg-slate-900 text-white font-bold rounded-2xl flex gap-2 shadow-lg hover:shadow-xl transition-all">
                                <Send className="h-4 w-4" /> Raise Ticket
                            </Button>
                        </div>
                    </form>
                )}
            </div>

            {/* Recent Tickets Area (Mock) */}
            {!submitted && (
                <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-4 pb-12 shadow-2xl">
                    <div className="flex justify-between items-center">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">RECENT TICKETS</h3>
                        <Button variant="ghost" className="text-[10px] font-black text-purple-600 hover:text-purple-700 uppercase p-0 h-auto">View All</Button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <FileText className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-900">Wrong Incentive #SWM-9912</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Resolved - Feb 24</p>
                            </div>
                        </div>
                        <MoreHorizontal className="h-4 w-4 text-slate-400" />
                    </div>
                </div>
            )}
        </div>
    );
}
