import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X, Settings, Navigation } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";

/**
 * LocationPermissionPopup
 * Shows a beautiful popup when location permission is denied or location is off.
 * Guides the user to enable location from browser/device settings.
 */
export default function LocationPermissionPopup({ isOpen, onClose, errorType = "denied" }) {
    if (!isOpen) return null;

    const isDenied = errorType === "denied";
    const isUnavailable = errorType === "unavailable";
    const isTimeout = errorType === "timeout";

    const title = isDenied
        ? "Location Permission Required"
        : isUnavailable
            ? "Location Service is Off"
            : "Location Request Timed Out";

    const description = isDenied
        ? "Please allow location access to auto-detect your area. You can enable it from your browser settings."
        : isUnavailable
            ? "Your device location is turned off. Please enable GPS/Location from your device settings."
            : "We couldn't get your location in time. Please check your GPS signal and try again.";

    const steps = isDenied
        ? [
            "Tap the lock/info icon in your browser's address bar",
            "Find 'Location' and set it to 'Allow'",
            "Refresh the page and try again"
        ]
        : isUnavailable
            ? [
                "Open your device Settings",
                "Go to Location / GPS and turn it ON",
                "Come back and tap 'Use Current' again"
            ]
            : [
                "Make sure you're in an open area",
                "Check that GPS/Location is enabled",
                "Try again after a few seconds"
            ];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
                        initial={{ scale: 0.85, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.85, opacity: 0, y: 30 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-4">
                            <button
                                onClick={onClose}
                                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors"
                            >
                                <X className="w-4 h-4 text-gray-500" />
                            </button>

                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 shadow-inner">
                                    {isDenied ? (
                                        <MapPin className="w-8 h-8 text-primary" />
                                    ) : (
                                        <Navigation className="w-8 h-8 text-primary" />
                                    )}
                                </div>
                                <h3 className="text-lg font-black text-gray-900">{title}</h3>
                                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{description}</p>
                            </div>
                        </div>

                        {/* Steps */}
                        <div className="px-6 py-4">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">How to enable:</p>
                            <div className="space-y-2.5">
                                {steps.map((step, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-black flex items-center justify-center mt-0.5">
                                            {i + 1}
                                        </span>
                                        <p className="text-sm text-gray-600 leading-snug">{step}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-6 pt-2 space-y-2.5">
                            <Button
                                onClick={onClose}
                                className="w-full h-12 rounded-xl font-bold text-base shadow-lg"
                            >
                                <Settings className="w-4 h-4 mr-2" />
                                Got it, I'll enable
                            </Button>
                            <button
                                onClick={onClose}
                                className="w-full text-center text-xs font-bold text-gray-400 hover:text-gray-600 py-2 transition-colors"
                            >
                                I'll enter address manually
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
