import React from "react";
import { ChevronLeft, ShoppingBag, Sparkles, Box, Lock, Send, BellRing, PackageSearch } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/modules/user/components/ui/button";

export default function SWMShop() {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col h-screen bg-slate-50 -m-4 md:m-0 overflow-hidden">
            {/* Header */}
            <div className="bg-white p-6 pt-10 flex items-center justify-between border-b border-gray-100 shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ChevronLeft className="h-6 w-6 text-slate-900" />
                    </button>
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-purple-600" /> SWM Pro Shop
                    </h1>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8 animate-in zoom-in-95 duration-700">
                {/* Hero Icon with Glow */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-[60px] animate-pulse group-hover:bg-purple-500/30 transition-all duration-1000 scale-150" />
                    <div className="h-44 w-44 bg-slate-900 rounded-[50px] rotate-[15deg] flex items-center justify-center shadow-2xl relative z-10 border-4 border-slate-800 group-hover:rotate-0 transition-transform duration-700">
                        <div className="-rotate-[15deg] group-hover:rotate-0 transition-transform duration-700">
                            <PackageSearch className="h-20 w-20 text-white" />
                        </div>
                    </div>
                    <div className="absolute -top-4 -right-4 bg-purple-600 text-white p-3 rounded-2xl shadow-xl z-20 animate-bounce delay-300 ring-4 ring-white">
                        <Sparkles className="h-6 w-6 fill-white" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="space-y-4 max-w-sm">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-tight">
                        We're Organizing New Things for You!
                    </h2>
                    <p className="text-slate-500 font-bold text-sm leading-relaxed px-2">
                        Your professional service kits and genuine SWM supplies will be available to order soon in this module.
                    </p>
                    <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
                        <Lock className="h-3 w-3 text-slate-400" />
                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">In Future organize</span>
                    </div>
                </div>

                {/* Newsletter / Notify Me */}
                <div className="w-full space-y-4 pt-4">
                    <div className="relative max-w-sm mx-auto p-4 bg-white rounded-3xl border border-slate-100 shadow-xl ring-1 ring-slate-100 group">
                        <div className="flex items-center gap-4">
                            <div className="bg-purple-50 h-10 w-10 rounded-full flex items-center justify-center text-purple-600 shrink-0 group-hover:rotate-12 transition-transform">
                                <BellRing className="h-5 w-5" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-xs font-bold text-slate-900">Notify me on launch</p>
                                <p className="text-[10px] font-bold text-slate-400">Be the first to get exclusive discounts.</p>
                            </div>
                            <button className="bg-slate-900 text-white h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all active:scale-95 shadow-lg">
                                JOIN WAITLIST
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Info */}
            <div className="p-10 bg-white border-t border-slate-100 text-center opacity-40">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Premium Quality Supplies • Coming 2024</p>
            </div>
        </div>
    );
}
