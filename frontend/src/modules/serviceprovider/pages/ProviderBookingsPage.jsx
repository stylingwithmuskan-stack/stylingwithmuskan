import React, { useState, useEffect, useCallback, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Clock, MapPin, ChevronRight, Check, X, Zap, Calendar, Timer } from "lucide-react";
import { useProviderBookings } from "@/modules/serviceprovider/contexts/ProviderBookingContext";
import { Button } from "@/modules/user/components/ui/button";

const CountdownTimer = ({ expiresAt }) => {
    const [remaining, setRemaining] = useState(0);
    useEffect(() => {
        const update = () => {
            const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
            setRemaining(Math.floor(diff / 1000));
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${remaining < 120 ? "bg-red-500/10 text-red-600 animate-pulse" : "bg-amber-500/10 text-amber-500"}`}>
            <Timer className="w-3 h-3" />
            {mins}:{secs.toString().padStart(2, "0")}
        </div>
    );
};

const BookingCard = forwardRef(({ booking, type, onAccept, onReject, onNavigate }, ref) => {
    const bookingId = booking?.id || booking?._id;
    const isFirstTime = !booking.customerBookingCount || booking.customerBookingCount <= 1;

    return (
        <motion.div ref={ref} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl p-4 border border-border shadow-sm hover:border-purple-300 transition-all">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-md ${booking.bookingType === "instant" ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-purple-50 text-purple-600 border border-purple-100"}`}>
                        {booking.bookingType === "instant" ? "Booked" : "Scheduled"}
                    </span>
                    {isFirstTime ? (
                        <span className="text-[9px] font-black uppercase px-2 py-1 flex items-center gap-1 rounded-md bg-red-50 text-red-600 border border-red-200">
                            Newly
                        </span>
                    ) : (
                        <span className="text-[9px] font-black uppercase px-2 py-1 flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">
                            <Check className="w-2.5 h-2.5" /> Verified Customer
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {(type === "incoming" || type === "pending") && booking.expiresAt && <CountdownTimer expiresAt={booking.expiresAt} />}
                    {type === "active" && <span className="text-[10px] font-bold uppercase text-green-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> {booking.status?.replace("_", " ") || ""}</span>}
                    {type === "assigned" && <span className="text-[10px] font-bold uppercase text-blue-500 flex items-center gap-1.5"><Zap className="w-3 h-3" /> Mandatory Job</span>}
                    {type === "cancelled" && <span className="text-[10px] font-bold uppercase text-red-500 flex items-center gap-1.5">{booking.status?.replace("_", " ") || ""}</span>}
                </div>
            </div>

            <div className="space-y-1.5">
                {(booking.services || booking.items || []).map((s, i) => (
                    <div key={i} className="flex justify-between items-center"><span className="text-sm font-bold text-gray-900">{s.name}</span><span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{s.duration || "N/A"}</span></div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mt-4 pt-3 border-t border-gray-100">
                <span className="flex items-center gap-1.5 font-medium"><Calendar className="w-3.5 h-3.5 text-purple-600" /> {booking.slot?.date || "TBD"}</span>
                <span className="flex items-center gap-1.5 font-medium"><Clock className="w-3.5 h-3.5 text-purple-600" /> {booking.slot?.time || "TBD"}</span>
            </div>
            <p className="text-xs text-gray-600 flex items-center gap-1.5 truncate mt-2 font-medium">
                <MapPin className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" /> {booking.address?.area || booking.address?.city || "Address not provided"}
            </p>

            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                <p className="text-lg font-black text-gray-900">₹{(booking.totalAmount || 0).toLocaleString()}</p>
                {(type === "incoming" || type === "pending") && (
                    <div className="flex gap-2">
                        <Button onClick={() => onReject(bookingId)} variant="ghost" className="h-9 px-3.5 rounded-xl text-red-600 text-xs font-bold hover:bg-red-50">Reject</Button>
                        <Button onClick={() => onAccept(bookingId)} className="h-9 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-200">Accept</Button>
                    </div>
                )}
                {(type === "active" || type === "completed" || type === "cancelled" || type === "assigned") && (
                    <Button onClick={() => onNavigate(bookingId)} variant="outline" className="h-9 px-4 rounded-xl text-xs font-bold border-gray-200 text-gray-700 hover:bg-gray-50 group">
                        {(type === "active" || type === "assigned") ? "Manage Job" : "View Details"} <ChevronRight className="w-3.5 h-3.5 ml-1.5 text-gray-400 group-hover:translate-x-0.5 transition-all" />
                    </Button>
                )}
            </div>
        </motion.div>
    );
});

const ProviderBookingsPage = () => {
    const navigate = useNavigate();
    const { incomingBookings, pendingBookings, activeBookings, assignedBookings, completedBookings, cancelledBookings, acceptBooking, rejectBooking } = useProviderBookings();
    const [activeTab, setActiveTab] = useState("incoming");

    const tabs = [
        { id: "incoming", label: "New", count: incomingBookings.length },
        { id: "pending", label: "Pending", count: pendingBookings.length },
        { id: "active", label: "Active", count: activeBookings.length },
        { id: "assigned", label: "Assigned", count: assignedBookings.length },
        { id: "completed", label: "Done", count: completedBookings.length },
        { id: "cancelled", label: "Cancelled", count: cancelledBookings.length },
    ];

    // Add horizontal scroll wrapper for tabs on mobile
    const current =
        activeTab === "incoming" ? incomingBookings :
            activeTab === "pending" ? pendingBookings :
                activeTab === "active" ? activeBookings :
                    activeTab === "assigned" ? assignedBookings :
                        activeTab === "completed" ? completedBookings :
                            cancelledBookings;

    return (
        <div className="flex flex-col gap-4 pt-2 md:pt-0 w-full max-w-4xl mx-auto h-full">
            <div className="flex items-center gap-4 px-2 md:px-0">
                <h1 className="text-2xl font-black tracking-tight text-gray-900">Bookings</h1>
            </div>

            {/* Horizontal scrollable tabs container */}
            <div className="w-full overflow-x-auto scrollbar-hide px-2 md:px-0 pb-1">
                <div className="flex gap-2 bg-gray-50/50 p-1.5 rounded-2xl border border-gray-100 min-w-max">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-[12px] text-xs font-bold transition-all flex items-center gap-2 ${activeTab === tab.id ? "bg-white text-purple-700 shadow-sm ring-1 ring-gray-200" : "text-gray-500 hover:text-gray-900 hover:bg-white/50"}`}>
                            {tab.label}
                            {tab.count > 0 && <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === tab.id ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>{tab.count}</span>}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3.5 px-2 md:px-0 pb-24 md:pb-0">
                <AnimatePresence mode="popLayout">
                    {current.length > 0 ? current.map(b => (
                        <BookingCard key={b.id || b._id} booking={b} type={activeTab} onAccept={acceptBooking} onReject={rejectBooking} onNavigate={(id) => navigate(`/provider/booking/${id}`)} />
                    )) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-24 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl opacity-50">📋</div>
                            <h2 className="text-base font-black text-gray-700">No {tabs.find(t => t.id === activeTab)?.label} Bookings</h2>
                            <p className="text-xs font-medium text-gray-400 mt-1">Jobs appearing here will be updated in real-time.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ProviderBookingsPage;
