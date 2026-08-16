import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useBookings } from "@/modules/user/contexts/BookingContext";
import { toast } from "sonner";
import {
    Calendar, Clock, ChevronRight,
    MapPin, ShoppingBag, Star, RefreshCcw,
    MessageSquare, Phone, Zap, Sparkles, Users, LayoutGrid, IndianRupee, Percent, CheckCircle2
} from "lucide-react";
import ChatModal from "@/modules/user/components/salon/ChatModal";
import CallingOverlay from "@/modules/user/components/salon/CallingOverlay";
import BookingDetailsModal from "@/modules/user/components/salon/BookingDetailsModal";
import CustomEnquiryDetailsModal from "@/modules/user/components/salon/CustomEnquiryDetailsModal";
import SlotSelectionModal from "@/modules/user/components/salon/SlotSelectionModal";
import FeedbackModal from "@/modules/user/components/salon/FeedbackModal";
import ProviderProfileModal from "@/modules/user/components/salon/ProviderProfileModal";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { useBookingChat } from "@/modules/user/contexts/BookingChatContext";
import { api } from "@/modules/user/lib/api";

const BookingsPage = () => {
    const navigate = useNavigate();
    const { gender } = useGenderTheme();
    const { bookings, enquiries, acceptCustomEnquiry, rejectCustomEnquiry, payAdvanceForCustomEnquiry, loadingEnquiries, loading } = useBookings();
    const { addCustomAdvanceToCart, setIsCartOpen, clearCart, addToCart, setBookingType } = useCart();
    const { user } = useAuth();
    const { unreadCounts } = useBookingChat();
    // Get user's primary address for slot filtering
    const userAddress = user?.addresses?.[0] || null;
    useEffect(() => {
        try {
            bookings.forEach(b => {
                const s = (b.status || "").toLowerCase();
                if (s === "arrived" && b.otp) {
                    console.log("[Booking OTP]", b._id || b.id, b.otp);
                }
            });
        } catch { }
    }, [bookings]);
    const [mainType, setMainType] = useState("normal"); // 'normal' or 'customize'
    const [activeTab, setActiveTab] = useState("Upcoming");
    const [chatBooking, setChatBooking] = useState(null);
    const [callingBooking, setCallingBooking] = useState(null);
    const [detailsBooking, setDetailsBooking] = useState(null);
    const [rescheduleBooking, setRescheduleBooking] = useState(null);
    const [rebookSlotOpen, setRebookSlotOpen] = useState(false);
    const [feedbackBooking, setFeedbackBooking] = useState(null);
    const [providerModalData, setProviderModalData] = useState(null);
    const [customEnquiryDetails, setCustomEnquiryDetails] = useState(null);
    const { providers, services: globalServices, loadCategoryServices } = useUserModuleData();
    const location = useLocation();

    const handleMakeCall = async (booking) => {
        console.log("handleMakeCall triggered with booking:", booking);
        if (!booking) return;
        const bookingId = booking.id || booking._id;
        console.log("Extracted bookingId:", bookingId);
        if (!bookingId) return;

        toast.promise(
            api.bookings.callMask(bookingId),
            {
                loading: 'Connecting call via Exotel...',
                success: (data) => {
                    console.log("Call mask success:", data);
                    return data.message || 'Call initiated! Exotel will call you shortly.';
                },
                error: (err) => {
                    console.error("Call mask error:", err);
                    return err?.message || 'Failed to connect call via Exotel.';
                }
            }
        );
    };

    // Effect for deep-linking from notifications
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const idParam = searchParams.get('id');
        const enquiryParam = searchParams.get('enquiry');

        if (idParam && bookings.length > 0) {
            const found = bookings.find(b => (b.id || b._id) === idParam);
            if (found && !detailsBooking) {
                setDetailsBooking(found);
            }
        }

        if (enquiryParam && enquiries.length > 0) {
            const foundEnq = enquiries.find(e => (e.id || e._id) === enquiryParam);
            if (foundEnq) {
                setMainType("customize");
                if (!customEnquiryDetails) {
                    setCustomEnquiryDetails(foundEnq);
                }
            } else if (mainType !== "customize") {
                // If enquiry ID is provided but not found yet, at least switch to the tab
                setMainType("customize");
            }
        }
    }, [location.search, bookings, enquiries]);

    const combinedEnquiries = (Array.isArray(enquiries) ? enquiries : [])
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .map((enq) => {
            const status = (enq.status || "").toLowerCase();
            const expiryAt = enq.quote?.expiryAt ? new Date(enq.quote.expiryAt) : null;
            const isExpired = expiryAt && !Number.isNaN(expiryAt.getTime()) && expiryAt.getTime() < Date.now();
            if (isExpired && ["quote_submitted", "admin_approved", "waiting_for_customer_payment"].includes(status)) {
                return { ...enq, statusLabel: "Quote Expired", displayPhase: "expired" };
            }
            if (status === "enquiry_created") return { ...enq, statusLabel: "Enquiry Received", displayPhase: "pending" };
            if (status === "quote_submitted") return { ...enq, statusLabel: "Under Admin Review", displayPhase: "vendor_pricing" };
            if (status === "admin_approved") return { ...enq, statusLabel: "Quote Ready", displayPhase: "pricing" };
            if (status === "waiting_for_customer_payment") return { ...enq, statusLabel: "Advance Pending", displayPhase: "payment" };
            if (status === "advance_paid") return { ...enq, statusLabel: "Advance Paid", displayPhase: "team_pending" };
            if (status === "service_confirmed") return { ...enq, statusLabel: "Service Confirmed", displayPhase: "final" };
            if (status === "service_completed") return { ...enq, statusLabel: "Completed", displayPhase: "final" };
            if (status === "rejected") return { ...enq, statusLabel: "Rejected", displayPhase: "rejected" };
            if (status === "quote_expired") return { ...enq, statusLabel: "Quote Expired", displayPhase: "expired" };
            return { ...enq, statusLabel: "Under Review", displayPhase: "pending" };
        })
        .filter(enq => !["service_completed"].includes((enq.status || "").toLowerCase()));

    useEffect(() => {
        const checkAutoFeedback = () => {
            const feedback = JSON.parse(localStorage.getItem("muskan-feedback") || "[]");
            // Find completed bookings that haven't been reviewed by customer
            const unreviewed = bookings.find(b =>
                b.status?.toLowerCase() === 'completed' &&
                !b.customerFeedbackSubmitted &&
                !feedback.some(f => f.bookingId === (b.id || b._id) && f.type === 'customer_to_provider')
            );

            if (unreviewed && !feedbackBooking) {
                // Short delay to let the page load
                const timer = setTimeout(() => setFeedbackBooking(unreviewed), 1000);
                return () => clearTimeout(timer);
            }
        };
        checkAutoFeedback();

        // 🔥 Pre-fetch missing service data for bookings to ensure images show up
        if (bookings.length > 0) {
            bookings.forEach(b => {
                const serviceId = b.items?.[0]?.id || b.services?.[0]?.id;
                const hasLocalImage = b.items?.[0]?.image || b.services?.[0]?.image;
                const hasGlobalImage = globalServices?.some(s => (s.id === serviceId || s._id === serviceId) && s.image);

                if (!hasLocalImage && !hasGlobalImage) {
                    const categoryId = b.items?.[0]?.category || b.services?.[0]?.category || b.categoryId;
                    if (categoryId) {
                        loadCategoryServices(categoryId);
                    }
                }
            });
        }
    }, [bookings, feedbackBooking, loadCategoryServices, globalServices]);

    const getFormattedDate = (dateStr) => {
        if (!dateStr) return "";
        if (dateStr === "Today") return "Today";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
    };

    const handleProviderClick = (booking) => {
        let foundProvider = providers?.find(p => p.id === booking.assignedProvider || p.phone === booking.assignedProvider);

        if (!foundProvider && booking.slot?.provider) {
            const p = booking.slot.provider;
            foundProvider = {
                ...p,
                image: p.profilePhoto || null,
                phone: p.phone || '',
                experience: p.experience || '',
                rating: p.rating || 0,
                completedJobs: p.totalJobs || 0,
                city: p.city || '',
                zones: p.zones || [],
                tag: p.tag || '',
                specialties: [booking.serviceType || booking.categoryName || booking.services?.[0]?.category || 'General']
            };
        } else if (!foundProvider && booking.teamMembers?.length > 0) {
            foundProvider = {
                ...booking.teamMembers[0],
                specialties: [booking.serviceType || booking.categoryName || booking.services?.[0]?.category || 'General']
            };
        } else if (!foundProvider) {
            foundProvider = {
                name: 'Trained Pro',
                experience: '',
                rating: 0,
                completedJobs: 0,
                specialties: [booking.serviceType || 'General']
            };
        }
        setProviderModalData(foundProvider);
    };

    const handleRebook = (booking) => {
        try {
            const services = booking.items || booking.services || [];

            if (!services || services.length === 0) {
                toast.error("No services found in this booking");
                return;
            }

            clearCart();

            services.forEach((service, i) => {
                const realServiceId = service.id || service._id || service.serviceId || null;
                addToCart({
                    // ✅ Real ID use karo, ya phir cart ke liye unique 'rebook-x' ID do. 
                    // SlotSelectionModal 'rebook-' wale IDs ko backend pe bhejne se pehle filter kar dega.
                    id: realServiceId || `rebook-${i}`,
                    _realId: realServiceId, // Optional reference

                    name: service.name,
                    price: service.price,
                    originalPrice: service.originalPrice,
                    duration: service.duration,
                    serviceType: service.serviceType || booking.serviceType || "",
                    category: service.category || service.categoryId || "",
                    image: service.image,
                    description: service.description
                });
            });

            if (booking.bookingType) {
                setBookingType(booking.bookingType);
            }

            toast.success(`${services.length} service${services.length > 1 ? 's' : ''} added — please select a new slot`);
            setRebookSlotOpen(true);

        } catch (error) {
            console.error("Rebook error:", error);
            toast.error("Failed to rebook. Please try again.");
        }
    };

    const getPhaseColor = (phase) => {
        switch (phase) {
            case "pricing": return "bg-green-100 text-green-700";
            case "payment": return "bg-amber-100 text-amber-700";
            case "team_pending": return "bg-blue-100 text-blue-700";
            case "team_review": return "bg-cyan-100 text-cyan-700";
            case "final": return "bg-emerald-100 text-emerald-700";
            case "vendor_pricing": return "bg-amber-100 text-amber-700";
            case "expired": return "bg-red-100 text-red-700";
            default: return "bg-primary/10 text-primary";
        }
    };

    const getPhaseDescription = (phase) => {
        switch (phase) {
            case "pricing": return "Pricing has been approved. Review and accept the quote.";
            case "payment": return "Quote accepted. Please pay the advance to confirm.";
            case "team_pending": return "Your acceptance is confirmed. Vendor is now assigning the team.";
            case "team_review": return "Team has been assigned. Admin is reviewing the assignment.";
            case "final": return "Booking has been created. You will see it in Normal Bookings.";
            case "vendor_pricing": return "Vendor is setting the pricing. You'll be notified once admin approves.";
            case "expired": return "Quote expired. Please request a new quote.";
            default: return "Your enquiry is being processed.";
        }
    };

    return (
        <div className="min-h-screen bg-background pb-24 lg:pb-8">
            {/* Header */}
            <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
                <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>My Bookings</h1>
            </div>

            <div className="px-4 md:px-8 lg:px-0 max-w-2xl mx-auto mt-4">
                {/* Main Toggle */}
                <div className="flex p-1.5 bg-accent/50 rounded-2xl mb-4 relative">
                    <div
                        className="absolute h-[calc(100%-12px)] top-[6px] transition-all duration-300 ease-out bg-primary rounded-xl shadow-md"
                        style={{
                            width: "calc(50% - 6px)",
                            left: mainType === "normal" ? "6px" : "calc(50%)"
                        }}
                    />
                    <button
                        onClick={() => setMainType("normal")}
                        className={`relative z-10 flex-1 py-2 text-xs font-black uppercase tracking-wider transition-colors ${mainType === "normal" ? "text-white" : "text-muted-foreground"}`}
                    >
                        Normal Booking
                    </button>
                    <button
                        onClick={() => setMainType("customize")}
                        className={`relative z-10 flex-1 py-2 text-xs font-black uppercase tracking-wider transition-colors ${mainType === "customize" ? "text-white" : "text-muted-foreground"}`}
                    >
                        Customize Booking
                    </button>
                </div>

                {mainType === "normal" ? (
                    <>
                        {/* Sub Tabs */}
                        <div className="flex gap-2 mb-4">
                            {["Upcoming", "Past"].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === tab
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        : "bg-accent text-muted-foreground"
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Bookings List */}
                        <div className="space-y-4">
                            {Array.from(new Map(bookings.map(b => [b._id || b.id, b])).values())
                                .filter(b => {
                                    const s = (b.status || "").toLowerCase();
                                    const isCustom = b.bookingType === "customized" || b.eventType;

                                    // Strictly exclude customized bookings from normal tab
                                    if (isCustom) return false;

                                    if (activeTab === "Upcoming") return !["completed", "cancelled", "payment_pending"].includes(s);
                                    if (activeTab === "Past") return ["completed", "cancelled", "payment_pending"].includes(s);
                                    return false;
                                })
                                .map((booking, i) => (
                                    <motion.div
                                        key={booking._id || booking.id}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="glass-strong rounded-2xl overflow-hidden border border-border/50 group"
                                    >
                                        <div className="p-4 sm:p-5">
                                            <div className="flex gap-4">
                                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-accent border border-border/50">
                                                    <img
                                                        src={
                                                            booking.items?.[0]?.image ||
                                                            booking.services?.[0]?.image ||
                                                            globalServices?.find(s => (s.id === (booking.items?.[0]?.id || booking.services?.[0]?.id)) || (s._id === (booking.items?.[0]?.id || booking.services?.[0]?.id)))?.image ||
                                                            globalServices?.find(s => s.name === (booking.items?.[0]?.name || booking.services?.[0]?.name))?.image ||
                                                            "https://placehold.co/100x100"
                                                        }
                                                        className="w-full h-full object-cover"
                                                        alt="Service"
                                                    />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start gap-2 mb-2">
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-bold text-[15px] sm:text-base leading-tight truncate">
                                                                {(booking.items?.[0]?.name || booking.services?.[0]?.name || booking.categoryName || booking.serviceType || "Customized Service")}
                                                                {(((booking.items?.length || booking.services?.length || booking.selectedServices?.length || 0) > 1)) && ` + ${Math.max(0, (booking.items?.length || booking.services?.length || booking.selectedServices?.length || 0) - 1)} more`}
                                                            </h3>
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${(booking.bookingType || "").toLowerCase() === 'instant' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                                                                    }`}>
                                                                    {(booking.bookingType || "").toLowerCase() === 'instant' ? <Zap className="w-2.5 h-2.5" /> : <Calendar className="w-2.5 h-2.5" />}
                                                                    {(booking.bookingType || "").toLowerCase() === 'instant' ? 'Booked' : 'Pre-book'}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground/60 font-bold tracking-tighter bg-accent/50 px-2 py-0.5 rounded-md">
                                                                    ID: {String(booking._id || booking.id).slice(-8).toUpperCase()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className={`flex-shrink-0 text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${booking.status?.toLowerCase() === "accepted" ? "bg-green-50 text-green-600 border-green-200" :
                                                            booking.status?.toLowerCase() === "travelling" ? "bg-amber-50 text-amber-600 border-amber-200" :
                                                                booking.status?.toLowerCase() === "arrived" ? "bg-purple-50 text-purple-600 border-purple-200" :
                                                                    booking.status?.toLowerCase() === "in_progress" || booking.status?.toLowerCase() === "documentation" ? "bg-blue-50 text-blue-600 border-blue-200" :
                                                                        booking.status?.toLowerCase() === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                                                                            booking.status?.toLowerCase() === "cancelled" ? "bg-red-50 text-red-600 border-red-200" :
                                                                                "bg-gray-50 text-gray-600 border-gray-200"
                                                            }`}>
                                                            {booking.status?.toLowerCase() === "completed" ? "Completed" : (booking.status || "Pending")}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground mb-3 mt-3">
                                                        <div className="flex items-center gap-1.5 font-bold">
                                                            <Calendar className="w-3.5 h-3.5 text-primary/60" /> {getFormattedDate(booking.slot?.date)}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 font-bold">
                                                            <Clock className="w-3.5 h-3.5 text-primary/60" /> {booking.slot?.time}
                                                        </div>
                                                        <div className="col-span-2 sm:col-auto">
                                                            {(booking.assignedProvider || booking.teamMembers?.length > 0 || ["accepted", "travelling", "arrived", "in_progress", "documentation", "completed", "payment_pending"].includes(booking.status?.toLowerCase())) ? (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleProviderClick(booking); }}
                                                                    className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer group/pro"
                                                                >
                                                                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                                    <span className="font-bold underline decoration-primary/30 underline-offset-2 group-hover/pro:decoration-primary">
                                                                        {booking.slot?.provider?.name || booking.teamMembers?.[0]?.name || (Array.isArray(providers) ? providers.find(p => p.id === booking.assignedProvider) : providers?.[booking.assignedProvider])?.name || 'Trained Pro'}
                                                                    </span>
                                                                </button>
                                                            ) : (
                                                                <div className="flex items-center gap-1.5 text-muted-foreground/50 italic">
                                                                    <Users className="w-3.5 h-3.5" />
                                                                    <span className="font-medium text-[10px] uppercase tracking-tighter">
                                                                        {booking.status?.toLowerCase() === 'cancelled' ? 'No Expert Assigned' : 'Assigning Expert...'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 opacity-80 leading-tight">
                                                        <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                                                        <span className="line-clamp-1">{booking.address?.houseNo}, {booking.address?.area}</span>
                                                    </p>
                                                    {booking.otp && ((booking.status || "").toLowerCase() === "arrived") && (
                                                        <div className="mt-3 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-xl text-[12px] font-black tracking-[0.2em] shadow-sm">
                                                            OTP: {booking.otp}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-5 pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
                                                <div className="min-w-[120px]">
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-0.5 opacity-60">Booking Value</p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-lg font-black text-primary">
                                                            ₹{(booking.totalAmount || 0).toLocaleString()}
                                                        </p>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${booking.paymentStatus === 'PAID' || booking.balanceAmount === 0
                                                            ? "bg-green-50 text-green-600 border border-green-200"
                                                            : "bg-amber-50 text-amber-600 border border-amber-200"
                                                            }`}>
                                                            {booking.paymentStatus || (booking.balanceAmount === 0 ? 'PAID' : 'PENDING')}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 ml-auto">
                                                    {activeTab === "Upcoming" ? (
                                                        <>
                                                            {["accepted", "travelling", "arrived", "in_progress", "documentation"].includes(booking.status?.toLowerCase()) && (
                                                                <div className="flex gap-2 mr-1">
                                                                    <button
                                                                        onClick={() => setChatBooking(booking)}
                                                                        className="h-10 w-10 rounded-xl border border-primary/20 bg-primary/5 text-primary flex items-center justify-center hover:bg-primary/10 transition-all active:scale-90 relative"
                                                                    >
                                                                        <MessageSquare className="w-4.5 h-4.5" />
                                                                        {(unreadCounts?.[booking._id || booking.id] || 0) > 0 && (
                                                                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center border-2 border-white font-black shadow-sm animate-bounce">
                                                                                {unreadCounts[booking._id || booking.id]}
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleMakeCall(booking)}
                                                                        className="h-10 w-10 rounded-xl border border-primary/20 bg-primary/5 text-primary flex items-center justify-center hover:bg-primary/10 transition-all active:scale-90"
                                                                    >
                                                                        <Phone className="w-4.5 h-4.5" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <button
                                                                onClick={() => setDetailsBooking(booking)}
                                                                className="h-10 px-6 rounded-xl bg-accent/50 text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95 border border-primary/10"
                                                            >
                                                                Details
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => setDetailsBooking(booking)}
                                                                className="h-10 px-4 rounded-xl bg-accent/50 text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95 border border-primary/10"
                                                            >
                                                                Details
                                                            </button>
                                                            {!booking.customerFeedbackSubmitted && booking.status?.toLowerCase() === 'completed' && (
                                                                <button onClick={() => setFeedbackBooking(booking)} className="h-10 px-4 rounded-xl border border-primary/20 bg-primary/5 text-primary text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary hover:text-white transition-all active:scale-95">
                                                                    <Star className="w-3.5 h-3.5 fill-current" /> Review
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleRebook(booking)}
                                                                className="h-10 px-4 rounded-xl border border-primary/20 bg-primary text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20"
                                                            >
                                                                <RefreshCcw className="w-3.5 h-3.5" /> Rebook
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                        </div>

                        {loading ? (
                            <div className="py-20 text-center flex flex-col items-center justify-center">
                                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                                <h2 className="text-sm font-semibold text-muted-foreground">Loading bookings...</h2>
                            </div>
                        ) : bookings.filter(b => {
                            const s = (b.status || "").toLowerCase();
                            const isCustom = b.bookingType === "customized" || b.eventType;

                            // Strictly exclude customized bookings from normal tab
                            if (isCustom) return false;

                            if (activeTab === "Upcoming") return !["completed", "cancelled"].includes(s);
                            return ["completed", "cancelled"].includes(s);
                        }).length === 0 && (
                            <div className="py-20 text-center">
                                <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 scale-110">
                                    <ShoppingBag className="w-10 h-10 text-muted-foreground/30" />
                                </div>
                                <h2 className="text-lg font-bold mb-1">No Bookings Yet</h2>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                    You haven't booked any services yet. Start exploring our premium salon services!
                                </p>
                                <button
                                    onClick={() => navigate("/home")}
                                    className="mt-6 px-8 py-2.5 bg-primary text-primary-foreground rounded-full font-bold shadow-lg shadow-primary/20"
                                >
                                    Explore Services
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="space-y-4">
                        {loadingEnquiries ? (
                            <div className="py-16 text-center text-sm text-muted-foreground font-medium">
                                Loading custom enquiries...
                            </div>
                        ) : combinedEnquiries.length > 0 ? (
                            combinedEnquiries.map((enq, i) => (
                                <motion.div
                                    key={enq._id || enq.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    onClick={() => setCustomEnquiryDetails(enq)}
                                    className={`glass-strong rounded-3xl p-5 border shadow-sm relative overflow-hidden cursor-pointer hover:shadow-lg transition-all ${enq.displayPhase === "pricing" ? "border-primary/30 ring-1 ring-primary/10" : enq.displayPhase === "final" ? "border-emerald-300 ring-1 ring-emerald-100" : "border-primary/10"}`}
                                >
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12" />

                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded ${getPhaseColor(enq.displayPhase)}`}>
                                                {enq.statusLabel || enq.status || "Enquiry Details"}
                                            </span>
                                            <h3 className="text-lg font-black mt-2 font-display">{enq.eventType}</h3>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{String(enq._id || enq.id || "").slice(-8)}</p>
                                            <span className={`inline-block mt-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm ${enq.displayPhase === "final" ? "bg-emerald-600 text-white" : enq.displayPhase === "pricing" ? "bg-green-600 text-white" : enq.displayPhase === "rejected" ? "bg-red-600 text-white" : "bg-amber-100 text-amber-600"}`}>
                                                {enq.statusLabel || enq.status || 'Pending Review'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Phase description */}
                                    {enq.displayPhase && (
                                        <div className={`mb-3 p-3 rounded-xl border ${enq.displayPhase === "final" ? "bg-emerald-50 border-emerald-100" :
                                            enq.displayPhase === "pricing" ? "bg-green-50 border-green-100" :
                                                "bg-muted/30 border-border/30"
                                            }`}>
                                            <p className="text-[10px] font-bold text-foreground/70 leading-relaxed">
                                                {getPhaseDescription(enq.displayPhase)}
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 mb-3">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Preferred Schedule</p>
                                            <div className="flex items-center gap-2 text-sm font-bold">
                                                <Calendar className="w-4 h-4 text-primary" />
                                                {enq.scheduledAt?.date || enq.date}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm font-bold">
                                                <Clock className="w-4 h-4 text-primary" />
                                                {enq.scheduledAt?.timeSlot || enq.timeSlot}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Details</p>
                                            <div className="flex items-center gap-2 text-sm font-bold">
                                                <Users className="w-4 h-4 text-primary" />
                                                {enq.noOfPeople} People
                                            </div>
                                            {/* Price & Discount Display */}
                                            {((enq.quote?.totalAmount || enq.totalAmount || 0) > 0) && (
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-1 text-sm font-black text-primary">
                                                        <IndianRupee className="w-3 h-3" />
                                                        {(enq.quote?.totalAmount || enq.totalAmount || 0).toLocaleString()}
                                                    </div>
                                                    {((enq.quote?.discountPrice || enq.discountPrice || 0) > 0) && (
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-green-600">
                                                            <Percent className="w-2.5 h-2.5" />
                                                            Discount: ₹{(enq.quote?.discountPrice || enq.discountPrice || 0).toLocaleString()}
                                                        </div>
                                                    )}
                                                    {((enq.quote?.discountPrice || enq.discountPrice || 0) > 0) && (
                                                        <p className="text-[10px] font-black text-emerald-700">
                                                            Final: ₹{((enq.quote?.totalAmount || enq.totalAmount || 0) - (enq.quote?.discountPrice || enq.discountPrice || 0)).toLocaleString()}
                                                        </p>
                                                    )}
                                                    {(enq.quote?.prebookAmount || 0) > 0 && (
                                                        <p className="text-[10px] font-black text-amber-700">
                                                            Advance: ₹{(enq.quote?.prebookAmount || 0).toLocaleString()}
                                                        </p>
                                                    )}
                                                    {enq.quote?.totalServiceTime && (
                                                        <p className="text-[10px] font-bold text-muted-foreground">
                                                            Service Time: {enq.quote.totalServiceTime}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {(enq.categoryName || enq.selectedServices || enq.quote?.items || enq.items) && (
                                        <div className="mb-4 p-3 bg-purple-50/50 rounded-2xl border border-purple-100 flex flex-col gap-2">
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-purple-600 mb-1 flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> Requested Category:</p>
                                                <p className="text-sm font-bold">{enq.categoryName || enq.serviceType}</p>
                                            </div>
                                            {(enq.selectedServices || enq.quote?.items || enq.items) && (
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-purple-600 mb-1">Services Breakdown:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(enq.selectedServices || enq.quote?.items || enq.items).map((s, idx) => (
                                                            <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-purple-200 text-purple-700 rounded-lg">
                                                                {(s.image || globalServices?.find(gs => gs.id === s.id)?.image) && (
                                                                    <img
                                                                        src={s.image || globalServices?.find(gs => gs.id === s.id)?.image}
                                                                        alt=""
                                                                        className="w-4 h-4 rounded-sm object-cover"
                                                                    />
                                                                )}
                                                                <span className="text-[9px] font-bold">
                                                                    {s.name}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Team display (optional, if backend provides teamMembers later) */}
                                    {(enq.displayPhase === "final" || enq.displayPhase === "team_review") && enq.teamMembers && enq.teamMembers.length > 0 && (
                                        <div className="mb-4 p-3 bg-primary/5 rounded-2xl border border-primary/10">
                                            <p className="text-[10px] font-black uppercase text-primary mb-2">Assigned Experts Team</p>
                                            <div className="flex flex-wrap gap-2">
                                                {enq.teamMembers.map((m, idx) => (
                                                    <span key={idx} className="text-[9px] font-bold px-2 py-1 bg-white border border-primary/10 rounded-lg flex items-center gap-1">
                                                        <Sparkles className="w-2.5 h-2.5 text-primary" /> {m.name}
                                                        {m.id === enq.maintainProvider && (
                                                            <span className="text-[7px] bg-primary/10 text-primary px-1 rounded ml-0.5">Lead</span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {enq.notes && (
                                        <div className="p-3 bg-accent/40 rounded-2xl border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 opacity-60">Requirements</p>
                                            <p className="text-xs text-foreground italic leading-relaxed">"{enq.notes}"</p>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    {enq.displayPhase === "pricing" ? (
                                        <div className="mt-5 pt-4 border-t border-border/30 flex items-center justify-between gap-3">
                                            <span className="text-[10px] font-bold text-muted-foreground">
                                                Quote ready. Accept to proceed.
                                            </span>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const expiryAt = enq.quote?.expiryAt ? new Date(enq.quote.expiryAt) : null;
                                                        if (expiryAt && !Number.isNaN(expiryAt.getTime()) && expiryAt.getTime() < Date.now()) {
                                                            toast.error("This quote has expired. Please request a new quote.");
                                                            return;
                                                        }
                                                        await acceptCustomEnquiry(enq._id || enq.id);
                                                        const isZeroAdvance = Number(enq.quote?.prebookAmount || 0) === 0;
                                                        if (isZeroAdvance) {
                                                            toast.success("Quote accepted & booking confirmed!");
                                                        } else {
                                                            toast.success("Quote accepted. Please pay the advance.");
                                                        }
                                                    } catch (e) {
                                                        toast.error(e?.message || "Failed to accept quote");
                                                    }
                                                }}
                                                className="px-4 py-2 rounded-xl bg-green-600 text-white text-[10px] font-black uppercase tracking-widest"
                                            >
                                                Accept Quote
                                            </button>
                                        </div>
                                    ) : enq.displayPhase === "payment" ? (
                                        <div className="mt-5 pt-4 border-t border-border/30 flex items-center justify-between gap-3">
                                            <span className="text-[10px] font-bold text-muted-foreground">
                                                {Number(enq.quote?.prebookAmount || 0) === 0 ? "Confirm booking with 0 advance." : "Pay advance to confirm booking."}
                                            </span>
                                            {Number(enq.quote?.prebookAmount || 0) === 0 ? (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const expiryAt = enq.quote?.expiryAt ? new Date(enq.quote.expiryAt) : null;
                                                            if (expiryAt && !Number.isNaN(expiryAt.getTime()) && expiryAt.getTime() < Date.now()) {
                                                                toast.error("This quote has expired. Please request a new quote.");
                                                                return;
                                                            }
                                                            await payAdvanceForCustomEnquiry(enq._id || enq.id, 0);
                                                            toast.success("Booking confirmed!");
                                                        } catch (e) {
                                                            toast.error(e?.message || "Failed to confirm booking");
                                                        }
                                                    }}
                                                    className="px-4 py-2 rounded-xl bg-green-600 text-white text-[10px] font-black uppercase tracking-widest"
                                                >
                                                    Confirm Booking
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const expiryAt = enq.quote?.expiryAt ? new Date(enq.quote.expiryAt) : null;
                                                            if (expiryAt && !Number.isNaN(expiryAt.getTime()) && expiryAt.getTime() < Date.now()) {
                                                                toast.error("This quote has expired. Please request a new quote.");
                                                                return;
                                                            }
                                                            const amt = Number(enq.quote?.prebookAmount || 0);
                                                            if (!(amt > 0)) {
                                                                toast.error("Advance amount not available yet.");
                                                                return;
                                                            }
                                                            addCustomAdvanceToCart(enq, amt);
                                                            setIsCartOpen(false);
                                                            navigate("/booking/summary", {
                                                                state: { type: 'custom', customAdvance: { enquiryId: enq._id || enq.id, amount: amt } }
                                                            });
                                                        } catch (e) {
                                                            toast.error(e?.message || "Failed to start advance payment");
                                                        }
                                                    }}
                                                    disabled={!(enq.quote?.prebookAmount > 0)}
                                                    className="px-4 py-2 rounded-xl bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                                                >
                                                    Pay Advance
                                                </button>
                                            )}
                                        </div>
                                    ) : enq.displayPhase === "expired" ? (
                                        <div className="mt-5 pt-4 border-t border-border/30 flex items-center justify-between gap-3">
                                            <span className="text-[10px] font-bold text-red-600">
                                                This quote has expired. Please submit a new enquiry.
                                            </span>
                                            <span className="text-[10px] font-bold text-muted-foreground">Support Help</span>
                                        </div>
                                    ) : enq.displayPhase === "pending" ? (
                                        <div className="mt-5 pt-4 border-t border-border/30 flex items-center justify-between gap-3">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-muted-foreground">
                                                    Sent on {new Date(enq.createdAt || Date.now()).toLocaleDateString()}
                                                </span>
                                                <span className="text-primary hover:underline cursor-pointer mt-0.5 text-[10px] font-bold">Support Help</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                                                    Under Review
                                                </span>
                                            </div>
                                        </div>
                                    ) : null}
                                </motion.div>
                            ))
                        ) : (
                            <div className="py-20 text-center">
                                <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 scale-110">
                                    <Sparkles className="w-10 h-10 text-muted-foreground/30" />
                                </div>
                                <h2 className="text-lg font-bold mb-1">No Custom Enquiries</h2>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                    Need a bulk booking for a wedding or event? Request a custom quote today!
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals & Overlays */}
            <ChatModal
                isOpen={!!chatBooking}
                onClose={() => setChatBooking(null)}
                booking={chatBooking}
            />

            <CallingOverlay
                isOpen={!!callingBooking}
                onClose={() => setCallingBooking(null)}
                booking={callingBooking}
            />

            {/* Conditional Modal Rendering: Customize vs Normal Bookings */}
            {detailsBooking && (
                <>
                    {(detailsBooking.bookingType === 'customized' || detailsBooking.eventType) ? (
                        <CustomEnquiryDetailsModal
                            isOpen={!!detailsBooking}
                            onClose={() => setDetailsBooking(null)}
                            enquiry={detailsBooking}
                            onCall={() => handleMakeCall(detailsBooking)}
                        />
                    ) : (
                        <BookingDetailsModal
                            isOpen={!!detailsBooking}
                            onClose={() => setDetailsBooking(null)}
                            booking={detailsBooking}
                            onChat={() => setChatBooking(detailsBooking)}
                            onCall={() => handleMakeCall(detailsBooking)}
                        />
                    )}
                </>
            )}

            <SlotSelectionModal
                isOpen={!!rescheduleBooking}
                onClose={() => setRescheduleBooking(null)}
                onSave={() => {
                    setRescheduleBooking(null);
                }}
            />

            {/* ✅ Rebook Slot Modal — opens directly after Rebook button */}
            <SlotSelectionModal
                isOpen={rebookSlotOpen}
                onClose={() => setRebookSlotOpen(false)}
                address={userAddress}
                onSave={() => {
                    setRebookSlotOpen(false);
                    // Open cart after slot is selected so user can checkout
                    setIsCartOpen(true);
                }}
            />

            <FeedbackModal
                isOpen={!!feedbackBooking}
                onClose={() => setFeedbackBooking(null)}
                booking={feedbackBooking}
            />

            <ProviderProfileModal
                isOpen={!!providerModalData}
                onClose={() => setProviderModalData(null)}
                provider={providerModalData}
            />

            {/* Custom Enquiry Details Modal */}
            <CustomEnquiryDetailsModal
                isOpen={!!customEnquiryDetails}
                onClose={() => setCustomEnquiryDetails(null)}
                enquiry={customEnquiryDetails}
            />

        </div>
    );
};

export default BookingsPage;


