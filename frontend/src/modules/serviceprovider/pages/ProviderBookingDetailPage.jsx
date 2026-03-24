import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, MapPin, Clock, Calendar, Check, Navigation, Camera, ChevronRight,
    Shield, IndianRupee, Map as MapIcon, UserCircle, Package, CheckCircle2,
    Smartphone, Wallet, Star, MessageSquare, AlertTriangle, Trash2
} from "lucide-react";
import { useProviderBookings } from "@/modules/serviceprovider/contexts/ProviderBookingContext";
import { toast } from "sonner";
import { Button } from "@/modules/user/components/ui/button";
import LiveMap from "@/components/LiveMap";
import { api } from "@/modules/user/lib/api";

const statusSteps = [
    { key: "accepted", label: "Accepted", icon: Check },
    { key: "travelling", label: "Travelling", icon: Navigation },
    { key: "arrived", label: "Arrived", icon: MapPin },
    { key: "in_progress", label: "In Progress", icon: Clock },
    { key: "payment", label: "Payment", icon: IndianRupee },
    { key: "documentation", label: "Photos", icon: Camera },
    { key: "completed", label: "Completed", icon: CheckCircle2 },
];

const ProviderBookingDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { bookings, updateBookingStatus, requestPayment, verifyOTP, addBeforeImages, addAfterImages, addProductImages, addProviderImages } = useProviderBookings();
    const booking = bookings.find(b => (b.id || b._id) === id);
    const bookingId = booking?.id || booking?._id;

    const [otpInput, setOtpInput] = useState(["", "", "", ""]);
    const [otpError, setOtpError] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [showOTP, setShowOTP] = useState(false);
    const [showComplete, setShowComplete] = useState(false);
    const [customerRating, setCustomerRating] = useState(0);
    const [customerNote, setCustomerNote] = useState("");
    const [providerLocation, setProviderLocation] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [gpsStatus, setGpsStatus] = useState("idle");
    const [statusLoading, setStatusLoading] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const lastSentRef = useRef(0);

    const handleUpdateStatus = async (next) => {
        setStatusLoading(true);
        try {
            await updateBookingStatus(bookingId, next);
            if (next === "cancelled") {
                toast.success("Job cancelled successfully");
                navigate("/provider/bookings");
            }
        } finally {
            setStatusLoading(false);
            setShowCancelConfirm(false);
            setIsCancelling(false);
        }
    };

    const handleCancelJob = () => {
        setIsCancelling(true);
        handleUpdateStatus("cancelled");
    };

    const currentIdx = statusSteps.findIndex(s => s.key === booking?.status);
    const trackingActive = ["travelling", "arrived", "in_progress"].includes(String(booking?.status || "").toLowerCase());

    useEffect(() => {
        if (!booking) return;
        const lat = booking.address?.lat;
        const lng = booking.address?.lng;
        if (typeof lat === "number" && typeof lng === "number") {
            setUserLocation({ lat, lng });
        }
    }, [booking]);

    useEffect(() => {
        if (!trackingActive || !bookingId) return;
        if (!navigator.geolocation) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setProviderLocation(coords);
                setGpsStatus("live");
                const now = Date.now();
                if (now - lastSentRef.current > 5000) {
                    lastSentRef.current = now;
                    api.provider.updateBookingLocation(bookingId, coords.lat, coords.lng).catch(() => {});
                }
            },
            () => { setGpsStatus("error"); },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
        );
        return () => {
            if (navigator.geolocation && watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [trackingActive, bookingId]);

    if (!booking) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase mb-2 text-[10px] tracking-widest font-black">Booking Not Found</h2>
            <Button onClick={() => navigate("/provider/bookings")} variant="outline" className="h-10 px-6 rounded-xl text-xs font-bold border-gray-200">Back to List</Button>
        </div>
    );

    const handleOtpChange = (idx, val) => {
        if (isNaN(val)) return;
        const newOtp = [...otpInput];
        newOtp[idx] = val.slice(-1);
        setOtpInput(newOtp);
        if (val && idx < 3) document.getElementById(`potp-${idx + 1}`)?.focus();
    };

    const handleVerifyOTP = () => {
        const entered = otpInput.join("");
        const result = verifyOTP(bookingId, entered);
        if (!result) {
            setOtpError(true);
            setTimeout(() => setOtpError(false), 2000);
        } else {
            setShowOTP(false);
        }
    };

    const handleComplete = () => {
        // Save provider feedback about customer
        if (customerRating > 0) {
            const fb = {
                id: `FB${Date.now()}`,
                bookingId,
                customerName: booking.customerName || "Customer",
                providerName: "Service Provider",
                serviceName: (booking.services?.[0]?.name || booking.items?.[0]?.name || "Service"),
                rating: customerRating,
                comment: customerNote || feedback,
                tags: [],
                type: "provider_to_customer",
                createdAt: new Date().toISOString(),
            };
            const existing = JSON.parse(localStorage.getItem("muskan-feedback") || "[]");
            existing.unshift(fb);
            localStorage.setItem("muskan-feedback", JSON.stringify(existing));
        }
        updateBookingStatus(bookingId, "completed");
        setShowComplete(false);
    };

    const handleCollectPayment = () => {
        updateBookingStatus(bookingId, "payment");
    };

    const handleFinalizePayment = async (method) => {
        if (method === "online") {
            await requestPayment(bookingId);
            return;
        }
        updateBookingStatus(bookingId, "documentation");
    };

    const getNextAction = () => {
        switch (booking.status) {
            case "vendor_reassigned":
            case "accepted": return { label: "Start Travelling", icon: Navigation, action: () => updateBookingStatus(bookingId, "travelling") };
            case "travelling": return { label: "Mark as Arrived", icon: MapPin, action: () => updateBookingStatus(bookingId, "arrived") };
            case "arrived": return { label: "Verify Customer OTP", icon: Shield, action: () => setShowOTP(true) };
            case "in_progress": return { label: "Collect Service Payment", icon: IndianRupee, action: () => handleCollectPayment() };
            case "payment": return null; // Actions inside payment card
            case "documentation": return { label: "Finalize & Complete", icon: CheckCircle2, action: () => setShowComplete(true) };
            default: return null;
        }
    };
    const nextAction = getNextAction();

    return (
        <div className="min-h-screen bg-gray-50/50 pb-32">
            <AnimatePresence>
                {showCancelConfirm && (
                    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !statusLoading && setShowCancelConfirm(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl space-y-6 text-center border border-gray-100"
                        >
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                                <AlertTriangle className="w-10 h-10 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black tracking-tight text-gray-900">Cancel this Job?</h3>
                                <p className="text-sm text-gray-500 mt-2 font-medium">
                                    Are you sure you want to cancel this booking? This will notify the customer and vendor.
                                </p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button
                                    disabled={statusLoading}
                                    onClick={handleCancelJob}
                                    className="w-full h-12 rounded-2xl bg-red-600 text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-red-200 disabled:opacity-50"
                                >
                                    {statusLoading ? "Cancelling..." : "Yes, Cancel Job"}
                                </button>
                                <button
                                    disabled={statusLoading}
                                    onClick={() => setShowCancelConfirm(false)}
                                    className="w-full h-12 rounded-2xl bg-gray-100 font-black uppercase text-xs tracking-widest text-gray-900"
                                >
                                    No, Keep it
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="font-black text-sm tracking-tight text-gray-900">#{String(bookingId || "").toUpperCase()}</h1>
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{booking.bookingType}</p>
                    </div>
                </div>
                <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-md tracking-widest ${booking.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : booking.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                    {booking.status.replace("_", " ")}
                </span>
            </div>

            <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
                {/* Payment Collection UI */}
                {booking.status === "payment" && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-purple-600 rounded-[24px] p-6 shadow-xl shadow-purple-200 text-white space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-80">Collection Phase</h3>
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                <IndianRupee className="w-4 h-4" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <p className="text-[10px] font-bold opacity-70 uppercase">Balance to Collect</p>
                            <p className="text-4xl font-black">₹{(booking.balanceAmount || 0).toLocaleString()}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                onClick={() => handleFinalizePayment('online')}
                                className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl p-4 transition-all text-left group"
                            >
                                <Smartphone className="w-5 h-5 mb-2 opacity-80 group-hover:scale-110 transition-transform" />
                                <p className="text-xs font-bold leading-tight">ONLINE<br /><span className="opacity-60 font-medium">UPI/Card</span></p>
                            </button>
                            <button
                                onClick={() => handleFinalizePayment('cash')}
                                className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl p-4 transition-all text-left group"
                            >
                                <Wallet className="w-5 h-5 mb-2 opacity-80 group-hover:scale-110 transition-transform" />
                                <p className="text-xs font-bold leading-tight">CASH<br /><span className="opacity-60 font-medium">Physical Cash</span></p>
                            </button>
                        </div>

                        <p className="text-[9px] font-medium opacity-60 text-center uppercase tracking-wider italic pt-2">
                            Confirm collection before finalizing the job
                        </p>
                    </motion.div>
                )}

                {/* Status Progression */}
                <div className="bg-white border text-center border-gray-100 rounded-[20px] p-5 shadow-sm shadow-purple-50 text-center">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-6">Job Progression</h3>
                    <div className="flex items-center justify-between relative px-2">
                        <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-[3px] bg-gray-100 z-0 rounded-full" />
                        <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-[3px] bg-purple-500 z-0 rounded-full transition-all duration-500" style={{ width: `${Math.max(0, currentIdx) * 20}%` }} />

                        {statusSteps.map((step, i) => {
                            const done = i <= currentIdx;
                            const active = i === currentIdx;
                            return (
                                <div key={step.key} className="relative z-10 flex flex-col items-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-[3px] transition-all bg-white ${done ? "border-purple-600 text-purple-600 shadow-md shadow-purple-200" : "border-gray-200 text-gray-300"} ${active ? "ring-4 ring-purple-100 scale-110" : ""}`}>
                                        <step.icon className={`w-3.5 h-3.5 ${done ? 'text-purple-600' : 'text-gray-300'}`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between relative px-2 mt-2">
                        {statusSteps.map((step, i) => {
                            const done = i <= currentIdx;
                            return (
                                <span key={step.key} className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-tighter ${done ? "text-purple-700" : "text-gray-400"}`}>
                                    {step.label}
                                </span>
                            );
                        })}
                    </div>
                </div>

                {/* Map View during Travelling */}
                {trackingActive && (
                    <div className="bg-white border border-gray-100 rounded-[20px] p-5 shadow-sm shadow-purple-50 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                                <Navigation className="w-3.5 h-3.5 text-blue-500" /> Live Navigation
                            </h3>
                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                                {providerLocation ? "LIVE" : "WAITING"}
                            </span>
                        </div>
                        <div className="relative w-full h-48 bg-gray-100 rounded-2xl overflow-hidden border border-gray-100 group">
                            <LiveMap
                                className="w-full h-full"
                                height={192}
                                userLocation={userLocation}
                                providerLocation={providerLocation}
                            />
                            <div className="absolute top-3 right-3 bg-white/90 border border-gray-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full shadow-sm">
                                {trackingActive ? (gpsStatus === "live" ? "GPS Live" : gpsStatus === "error" ? "GPS Error" : "GPS Waiting") : "Tracking Off"}
                            </div>

                            {/* Google Maps External Button */}
                            <Button
                                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${booking.address?.houseNo || ""}, ${booking.address?.area || booking.address?.city || ""}`)}`, '_blank')}
                                className="absolute bottom-3 right-3 h-10 px-4 rounded-xl bg-white hover:bg-white text-gray-900 border border-gray-200 shadow-lg flex items-center gap-2 text-xs font-bold"
                            >
                                <MapIcon className="w-3.5 h-3.5 text-green-600" /> Open Maps
                            </Button>
                        </div>
                    </div>
                )}

                {/* Service Details */}
                <div className="bg-white border border-gray-100 rounded-[20px] p-5 shadow-sm shadow-purple-50 space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-purple-600" /> Service Overview
                    </h3>
                    <div className="space-y-2">
                        {(booking.services || booking.items || []).map((s, i) => (
                            <div key={i} className="flex justify-between items-center bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{s.name}</p>
                                    <p className="text-[11px] font-semibold text-gray-500 mt-0.5">{s.duration || "N/A"}</p>
                                </div>
                                <p className="text-sm font-black text-gray-900">₹{s.price}</p>
                            </div>
                        ))}
                    </div>
                    <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Total Earnings</p>
                        <p className="text-xl font-black text-purple-600 flex items-center"><IndianRupee className="w-4 h-4 mr-0.5" />{(booking.totalAmount || 0).toLocaleString()}</p>
                    </div>
                </div>

                {/* Location & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-100 rounded-[20px] p-5 shadow-sm shadow-purple-50 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Scheduled For</p>
                            <p className="text-sm font-black text-gray-900">{booking.slot?.date || "TBD"}</p>
                            <p className="text-xs font-bold text-purple-600">{booking.slot?.time || "TBD"}</p>
                        </div>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-[20px] p-5 shadow-sm shadow-purple-50 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Service Site</p>
                            {booking.status === "completed" ? (
                                <p className="text-sm font-bold leading-tight text-gray-400 italic">Location hidden for safety post-service</p>
                            ) : (
                                <>
                                    <p className="text-sm font-bold leading-tight text-gray-900">{booking.address?.houseNo || ""}, {booking.address?.area || booking.address?.city || "Address not provided"}</p>
                                    {booking.address?.landmark && <p className="text-[10px] text-gray-500 font-semibold tracking-tight">Landmark: {booking.address.landmark}</p>}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Images Section */}
                {(booking.status === "in_progress" || booking.status === "documentation" || booking.status === "completed") && (
                    <div className="space-y-4">
                        {/* Provider Verification Section */}
                        <div className="bg-white border border-gray-100 rounded-[20px] p-5 shadow-sm shadow-purple-50">
                            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4 flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-amber-500" /> Provider Verification</h3>
                            <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { key: "before", label: "Before Service", icon: Camera, data: booking.beforeImages || [], addFn: addBeforeImages, show: true },
                                            { key: "after", label: "After Service", icon: Camera, data: booking.afterImages || [], addFn: addAfterImages, show: booking.status !== "in_progress" },
                                            { key: "product", label: "Product", icon: Package, data: booking.productImages || [], addFn: addProductImages, show: true },
                                            { key: "provider", label: "Provider Live", icon: UserCircle, data: booking.providerImages || [], addFn: addProviderImages, show: booking.status !== "in_progress" }
                                        ].filter(p => p.show).map(phase => (
                                    <div key={phase.key} className="space-y-3">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{phase.label} Photo</p>
                                        {booking.status !== "completed" && (
                                            <label className="block bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-5 text-center cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition-all">
                                                        <input multiple type="file" accept="image/*" capture="environment" className="hidden"
                                                    onChange={e => {
                                                            const files = Array.from(e.target.files || []);
                                                            if (files.length) phase.addFn(booking._id || id, files);
                                                    }} />
                                                <phase.icon className="w-5 h-5 mx-auto text-gray-400 mb-1 group-hover:text-purple-600" />
                                                <span className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Snap {phase.label}</span>
                                            </label>
                                        )}
                                        <div className="flex gap-1.5 flex-wrap">
                                            {phase.data.map((img, i) => (
                                                <div key={i} className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 shadow-sm"><img src={img} className="w-full h-full object-cover" alt="" /></div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Service Documentation Section */}
                        <div className="bg-white border border-gray-100 rounded-[20px] p-5 shadow-sm shadow-purple-50">
                            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4 flex items-center gap-2"><Camera className="w-3.5 h-3.5 text-purple-600" /> Service Documentation</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { key: "before", label: "Before", data: booking.beforeImages || [], addFn: addBeforeImages, show: true },
                                    { key: "after", label: "After", data: booking.afterImages || [], addFn: addAfterImages, show: booking.status !== "in_progress" }
                                ].filter(p => p.show).map(phase => (
                                    <div key={phase.key} className="space-y-3">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{phase.label} Service</p>
                                        {booking.status !== "completed" && (
                                            <label className="block bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-5 text-center cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition-all">
                                                <input type="file" accept="image/*" capture="environment" className="hidden"
                                                    onChange={e => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const url = URL.createObjectURL(file);
                                                            phase.addFn(id, [url]);
                                                        }
                                                    }} />
                                                <Camera className="w-5 h-5 mx-auto text-gray-400 mb-1 group-hover:text-purple-600" />
                                                <span className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Snap Photo</span>
                                            </label>
                                        )}
                                        <div className="flex gap-1.5 flex-wrap">
                                            {phase.data.map((img, i) => (
                                                <div key={i} className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 shadow-sm"><img src={img} className="w-full h-full object-cover" alt="" /></div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* OTP Modal */}
            <AnimatePresence>
                {showOTP && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowOTP(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white border border-gray-100 rounded-[24px] p-6 shadow-2xl z-10">
                            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                                <Shield className="w-6 h-6 text-purple-600" />
                            </div>
                            <h3 className="font-black text-xl text-center mb-1 text-gray-900">Customer OTP</h3>
                            <p className="text-[11px] text-gray-500 text-center mb-6 uppercase tracking-widest font-bold">Ask customer for the 4-digit code</p>
                            <div className="flex justify-center gap-3 mb-6">
                                {otpInput.map((d, i) => (
                                    <input key={i} id={`potp-${i}`} type="text" maxLength={1} value={d} onChange={e => handleOtpChange(i, e.target.value)}
                                        className={`w-14 h-16 text-center text-3xl font-black bg-gray-50 border-2 rounded-2xl ${otpError ? "border-red-500 text-red-600 animate-shake bg-red-50" : "border-gray-200 text-gray-900"} focus:border-purple-500 focus:bg-white transition-all outline-none`} />
                                ))}
                            </div>
                            {otpError && <p className="text-red-600 text-[11px] font-bold text-center mb-4 uppercase tracking-widest">Invalid OTP Code</p>}
                            <Button onClick={handleVerifyOTP} className="w-full h-14 rounded-2xl font-black text-base bg-purple-600 hover:bg-purple-700 text-white shadow-xl shadow-purple-200 transition-all">Verify & Begin Service</Button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Completion Modal */}
            <AnimatePresence>
                {showComplete && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowComplete(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white border border-gray-100 rounded-[24px] p-6 shadow-2xl z-10">
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                            </div>
                            <h3 className="font-black text-xl text-center mb-4 text-gray-900">Complete Job</h3>
                            <div className="space-y-1.5 mb-6">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Work Notes (Optional)</label>
                                <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Any specific notes or details..."
                                    className="w-full h-28 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all" />
                            </div>

                            {/* Customer Rating Section */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                    <Star className="w-3 h-3" /> Rate the Customer
                                </label>
                                <div className="flex gap-2 justify-center py-2">
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <button key={s} onClick={() => setCustomerRating(s)} className="transition-transform hover:scale-125 active:scale-95">
                                            <Star className={`w-7 h-7 transition-colors ${s <= customerRating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                    <MessageSquare className="w-3 h-3" /> Customer Note (Optional)
                                </label>
                                <textarea value={customerNote} onChange={e => setCustomerNote(e.target.value)} placeholder="How was the customer? On time, cooperative, etc..."
                                    className="w-full h-20 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all" />
                            </div>
                            <Button onClick={handleComplete} className="w-full h-14 rounded-2xl font-black text-base bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-200 transition-all">Submit & Finish</Button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Sticky Action Footer */}
            {(nextAction || ["accepted", "travelling", "vendor_reassigned"].includes(booking?.status?.toLowerCase())) && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 p-4 z-40">
                    <div className="max-w-xl mx-auto flex gap-3">
                        {nextAction && (
                            <Button
                                onClick={nextAction.action}
                                className="flex-1 h-14 rounded-2xl font-black text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-xl shadow-purple-200 flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                            >
                                {nextAction.label.toUpperCase()} <ChevronRight className="w-4 h-4" />
                            </Button>
                        )}
                        {["accepted", "travelling", "vendor_reassigned"].includes(booking?.status?.toLowerCase()) && (
                            <button
                                onClick={() => setShowCancelConfirm(true)}
                                className="flex-1 h-14 rounded-2xl border-2 border-red-100 bg-red-50 text-red-600 flex items-center justify-center gap-2 hover:bg-red-100 transition-all shadow-sm font-black text-xs uppercase"
                                title="Cancel Job"
                            >
                                <Trash2 className="w-4 h-4" /> CANCEL BOOKING
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProviderBookingDetailPage;
