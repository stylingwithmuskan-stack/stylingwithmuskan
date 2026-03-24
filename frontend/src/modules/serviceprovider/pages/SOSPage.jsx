import React, { useState, useEffect } from "react";
import { ChevronLeft, AlertTriangle, Phone, ShieldAlert, History, MapPin, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/modules/user/components/ui/button";

export default function SOSPage() {
    const navigate = useNavigate();
    const [isActivating, setIsActivating] = useState(false);
    const [countdown, setCountdown] = useState(5);
    const [activated, setActivated] = useState(false);

    useEffect(() => {
        let timer;
        if (isActivating && countdown > 0) {
            timer = setInterval(() => setCountdown(c => c - 1), 1000);
        } else if (countdown === 0) {
            setActivated(true);
            setIsActivating(false);
        }
        return () => clearInterval(timer);
    }, [isActivating, countdown]);

    const handleSOSPress = () => {
        setIsActivating(true);
    };

    const handleCancel = () => {
        setIsActivating(false);
        setCountdown(5);
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 -m-4 md:m-0 overflow-hidden">
            {/* Header */}
            <div className="bg-white p-6 pt-10 flex items-center justify-between border-b border-gray-100 shadow-sm sticky top-0 z-10 transition-all">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ChevronLeft className="h-6 w-6 text-slate-900" />
                    </button>
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-red-500" /> Security SOS
                    </h1>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-12">
                {!activated ? (
                    <>
                        <div className="text-center space-y-4 max-w-sm">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Emergency?</h2>
                            <p className="text-slate-500 font-bold text-sm leading-relaxed px-4">
                                Use this button if you feel unsafe or need immediate assistance during your service.
                            </p>
                        </div>

                        {/* SOS Button Area */}
                        <div className="relative">
                            {/* Pulse background */}
                            <div className={`absolute inset-0 bg-red-500/20 rounded-full scale-110 blur-xl transition-all duration-1000 ${isActivating ? 'animate-ping' : ''}`} />

                            <button
                                onMouseDown={handleSOSPress}
                                onTouchStart={handleSOSPress}
                                onMouseUp={handleCancel}
                                onTouchEnd={handleCancel}
                                className={`h-56 w-56 rounded-full border-8 shadow-2xl transition-all relative flex flex-col items-center justify-center -translate-y-2 active:scale-95 active:translate-y-1 ${isActivating ? 'bg-red-600 border-red-500' : 'bg-red-500 border-red-400'}`}
                            >
                                <AlertTriangle className="h-16 w-16 text-white mb-2" />
                                <span className="text-2xl font-black text-white uppercase tracking-tighter">SOS</span>
                                <p className="text-[10px] text-white/80 font-bold tracking-widest uppercase mt-1">HOLD TO TRIGGER</p>
                            </button>

                            {isActivating && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-white text-7xl font-black drop-shadow-lg animate-pulse">{countdown}</div>
                                </div>
                            )}
                        </div>

                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-4 max-w-sm">
                            <History className="h-5 w-5 text-amber-600 shrink-0" />
                            <p className="text-xs text-amber-800 font-bold leading-tight">
                                This will share your live location and job details with the SWM Security Team.
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="text-center space-y-8 animate-in zoom-in-95 duration-500">
                        <div className="h-32 w-32 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-xl ring-8 ring-green-500/20">
                            <CheckCircle className="h-16 w-16 text-white" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">SOS Activated!</h2>
                            <p className="text-slate-500 font-bold text-sm">Our security team is now tracking your live location.</p>
                        </div>
                        <div className="space-y-4">
                            <Button className="w-full h-14 bg-slate-900 text-white font-bold rounded-2xl flex gap-3 shadow-lg hover:shadow-xl transition-all">
                                <Phone className="h-5 w-5" /> CALL HELPLINE NOW
                            </Button>
                            <Button variant="outline" onClick={() => setActivated(false)} className="w-full h-14 border-slate-200 font-bold rounded-2xl">
                                I am Safe - Cancel SOS
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Info Bar */}
            <div className="bg-white p-6 border-t border-slate-100 flex items-center justify-between shadow-2xl animate-in slide-in-from-bottom duration-700">
                <div className="flex flex-col">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Job</p>
                    <p className="text-sm font-bold text-slate-800">Hair & Makeup - DLF PHASE 3</p>
                </div>
                <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                    <MapPin className="h-4 w-4" />
                    <span className="text-[11px] font-bold">LIVE TRACKING ACTIVE</span>
                </div>
            </div>
        </div>
    );
}
