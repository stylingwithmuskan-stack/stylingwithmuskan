import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneOff, Phone, ShieldCheck, Wifi } from "lucide-react";

const CallingOverlay = ({ isOpen, onClose, booking }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[400] flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-primary/95 backdrop-blur-xl"
                />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative w-full max-w-sm flex flex-col items-center text-center text-white"
                >
                    {/* Signal / Status */}
                    <div className="flex items-center gap-2 mb-12 bg-white/10 px-4 py-1.5 rounded-full backdrop-blur-md">
                        <Wifi className="w-3 h-3 text-green-400 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Secure Masked Line</span>
                    </div>

                    {/* Profile Section */}
                    <div className="relative mb-8">
                        {/* Animated Pulses */}
                        <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
                        <div className="absolute inset-0 rounded-full bg-white/10 animate-pulse scale-150" />

                        <div className="relative w-32 h-32 rounded-full border-4 border-white/30 overflow-hidden shadow-2xl">
                            <img src={booking?.image} alt="Pro" className="w-full h-full object-cover scale-110" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-black mb-2 tracking-tight">Connecting...</h2>
                    <p className="text-white/60 text-sm font-medium mb-12">
                        Calling {booking?.serviceName} Expert
                    </p>

                    {/* Features Info */}
                    <div className="grid grid-cols-1 gap-4 w-full mb-16">
                        <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl border border-white/5">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-bold">Privacy Protected</p>
                                <p className="text-[10px] text-white/50">Your personal number remains hidden</p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-8">
                        <button
                            onClick={onClose}
                            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl shadow-red-900/40 active:scale-95 transition-all group"
                        >
                            <PhoneOff className="w-6 h-6 group-hover:-rotate-12 transition-transform" />
                        </button>
                    </div>

                    <p className="mt-8 text-[10px] text-white/30 font-bold uppercase tracking-widest">
                        Powered by SecureConnect Masking
                    </p>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CallingOverlay;
