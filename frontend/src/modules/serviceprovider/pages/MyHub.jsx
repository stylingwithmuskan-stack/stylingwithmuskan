import React from "react";
import { ChevronRight, Briefcase, RefreshCw, HelpCircle, MapPin, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/modules/user/components/ui/card";

export default function MyHub() {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 -m-4 md:m-0">
            {/* Custom Tab Header as per Image */}
            <div className="bg-white pt-10 sticky top-0 z-10 shadow-sm">
                <div className="px-6 flex items-center justify-between mb-4">
                    <button onClick={() => navigate(-1)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <ChevronRight className="h-6 w-6 text-slate-900 rotate-180" />
                    </button>
                    <h1 className="text-lg font-black text-slate-900 tracking-tight">Current Zone</h1>
                    <div className="w-8" /> {/* Spacer */}
                </div>

                <div className="flex border-b border-slate-100">
                    <div className="px-6 py-3 border-b-4 border-slate-900 font-black text-sm text-slate-900 tracking-tight">
                        Palasia Hub
                    </div>
                    <div className="px-6 py-3 font-bold text-sm text-slate-400 tracking-tight">
                        All Indore
                    </div>
                </div>
            </div>

            {/* Map Section */}
            <div className="p-4">
                <Card className="overflow-hidden rounded-3xl border-none shadow-xl bg-white ring-1 ring-slate-100">
                    <div className="relative aspect-[4/3] w-full">
                        <img
                            src="/indore_hub_map.png"
                            alt="Indore Palasia Hub Map"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.src = "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=800&q=80"; // Fallback map-like image
                            }}
                        />
                        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-slate-100 flex items-center gap-2">
                            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black tracking-widest uppercase text-slate-700">Live Zone Active</span>
                        </div>
                    </div>

                    <CardContent className="p-6 space-y-6 bg-white">
                        <div className="flex items-start gap-4 group">
                            <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                                <Briefcase className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[15px] font-bold text-slate-900 leading-snug">
                                    <span className="text-xl font-black mr-1">15</span> jobs delivered within hub in last 30 days
                                </p>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Performance Metric</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 group">
                            <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                                <RefreshCw className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[15px] font-bold text-slate-900 leading-snug">
                                    <span className="text-xl font-black mr-1 text-purple-600">3 of 15</span> jobs were of repeat customers
                                </p>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Loyalty Score</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Need Help Section */}
            <div className="mt-4 p-6 bg-white border-t border-slate-100 shadow-sm rounded-t-[40px] flex-1">
                <div className="flex items-center gap-2 mb-6 ml-1">
                    <HelpCircle className="h-5 w-5 text-slate-400" />
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Need help?</h2>
                </div>

                <div className="space-y-2">
                    <button className="w-full flex items-center justify-between p-5 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                        <span className="text-[17px] font-bold text-slate-800 tracking-tight">What is a Hub?</span>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-900 transition-colors" />
                    </button>

                    <div className="h-px bg-slate-50 mx-4" />

                    <button className="w-full flex items-center justify-between p-5 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                        <span className="text-[17px] font-bold text-slate-800 tracking-tight">Getting rebooking leads outside hub</span>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-900 transition-colors" />
                    </button>
                </div>

                <div className="mt-12 p-6 rounded-3xl bg-slate-900 text-white relative overflow-hidden group">
                    <div className="relative z-10">
                        <h3 className="text-lg font-black tracking-tight mb-1">Expand Your Zone?</h3>
                        <p className="text-xs font-bold text-slate-400 max-w-[200px]">Unlock more leads by increasing your service radius.</p>
                        <button className="mt-4 bg-white text-slate-900 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-slate-100 transition-all active:scale-95">
                            Upgrade Now
                        </button>
                    </div>
                    <MapPin className="absolute -right-4 -bottom-4 h-32 w-32 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                </div>
            </div>
        </div>
    );
}
