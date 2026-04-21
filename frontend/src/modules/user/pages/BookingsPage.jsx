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
import SlotSelectionModal from "@/modules/user/components/salon/SlotSelectionModal";
import FeedbackModal from "@/modules/user/components/salon/FeedbackModal";
import ProviderProfileModal from "@/modules/user/components/salon/ProviderProfileModal";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useBookingChat } from "@/modules/user/contexts/BookingChatContext";

const BookingsPage = () => {
    const navigate = useNavigate();
    const { gender } = useGenderTheme();
    const { bookings, enquiries, acceptCustomEnquiry, rejectCustomEnquiry, payAdvanceForCustomEnquiry, loadingEnquiries } = useBookings();
    const { addCustomAdvanceToCart, setIsCartOpen, clearCart, addToCart, setBookingType } = useCart();
    const { unreadCounts } = useBookingChat();
    useEffect(() => {
        try {
            bookings.forEach(b => {
                const s = (b.status || "").toLowerCase();
                if (s === "arrived" && b.otp) {
                    console.log("[Booking OTP]", b._id || b.id, b.otp);
                }
            });
        } catch {}
    }, [bookings]);
    const [mainType, setMainType] = useState("normal"); // 'normal' or 'customize'
    const [activeTab, setActiveTab] = useState("Upcoming");
    const [chatBooking, setChatBooking] = useState(null);
    const [callingBooking, setCallingBooking] = useState(null);
    const [detailsBooking, setDetailsBooking] = useState(null);
    const [rescheduleBooking, setRescheduleBooking] = useState(null);
    const [feedbackBooking, setFeedbackBooking] = useState(null);
    const [providerModalData, setProviderModalData] = useState(null);
    const [customEnquiryDetails, setCustomEnquiryDetails] = useState(null);
    const { providers } = useUserModuleData();
    const location = useLocation();

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
        });

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
    }, [bookings, feedbackBooking]);

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
            foundProvider = {
                name: booking.slot.provider.name,
                image: null,
                experience: '2+ Years',
                specialties: [booking.serviceType || booking.categoryName || 'General']
            };
        } else if (!foundProvider && booking.teamMembers?.length > 0) {
            foundProvider = booking.teamMembers[0];
        } else if (!foundProvider) {
            foundProvider = {
                name: 'Trained Pro',
                experience: '3+ Years',
                specialties: [booking.serviceType || 'General']
            };
        }
        setProviderModalData(foundProvider);
    };

    const handleRebook = (booking) => {
        try {
            // Extract services from the completed booking
            const services = booking.items || booking.services || [];
            
            if (!services || services.length === 0) {
                toast.error("No services found in this booking");
                return;
            }
            
            // Clear existing cart to avoid conflicts
            clearCart();
            
            // Add each service to cart with all necessary details
            services.forEach(service => {
                addToCart({
                    id: service.id || service._id || `service-${Date.now()}-${Math.random()}`,
                    name: service.name,
                    price: service.price,
                    originalPrice: service.originalPrice,
                    duration: service.duration,
                    category: service.category,
                    serviceType: service.serviceType,
                    image: service.image,
                    description: service.description
                });
            });
            
            // Set booking type from previous booking (instant or pre-book)
            if (booking.bookingType) {
                setBookingType(booking.bookingType);
            }
            
            // Show success message
            toast.success(`${services.length} service${services.length > 1 ? 's' : ''} added to cart`);
            
            // Open cart for user to review and proceed
            setIsCartOpen(true);
            
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
                            {bookings
                                .filter(b => {
                                    const s = (b.status || "").toLowerCase();
                                    const isCustom = b.bookingType === "customized" || b.eventType;

                                    // Strictly exclude customized bookings from normal tab
                                    if (isCustom) return false;

                                    if (activeTab === "Upcoming") return s !== "completed";
                                    if (activeTab === "Past") return s === "completed";
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
                                        <div className="p-4">
                                            <div className="flex gap-4">
                                                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-accent">
                                                    <img
                                                        src={booking.items?.[0]?.image || booking.services?.[0]?.image || "https://placehold.co/100x100"}
                                                        className="w-full h-full object-cover"
                                                        alt="Service"
                                                    />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div>
                                                            <h3 className="font-bold text-sm truncate">
                                                                {(booking.items?.[0]?.name || booking.services?.[0]?.name || booking.categoryName || booking.serviceType || "Customized Service")}
                                                                {(((booking.items?.length || booking.services?.length || booking.selectedServices?.length || 0) > 1)) && ` + ${Math.max(0, (booking.items?.length || booking.services?.length || booking.selectedServices?.length || 0) - 1)} more`}
                                                            </h3>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${(booking.bookingType || "").toLowerCase() === 'instant' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                                                                    }`}>
                                                                    {(booking.bookingType || "").toLowerCase() === 'instant' ? <Zap className="w-2 h-2" /> : <Calendar className="w-2 h-2" />}
                                                                    {(booking.bookingType || "").toLowerCase() === 'instant' ? 'Booked' : 'Pre-book'}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground font-medium">
                                                                    ID: {booking._id || booking.id}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                            booking.status?.toLowerCase() === "accepted" ? "bg-green-100 text-green-600" :
                                                            booking.status?.toLowerCase() === "travelling" ? "bg-amber-100 text-amber-600" :
                                                            booking.status?.toLowerCase() === "arrived" ? "bg-purple-100 text-purple-600" :
                                                            booking.status?.toLowerCase() === "in_progress" ? "bg-blue-100 text-blue-600" :
                                                            booking.status?.toLowerCase() === "completed" ? "bg-emerald-100 text-emerald-600" :
                                                            booking.status?.toLowerCase() === "cancelled" ? "bg-red-100 text-red-600" :
                                                            "bg-gray-100 text-gray-600"
                                                        }`}>
                                                            {booking.status?.toLowerCase() === "completed" ? "Completed" : (booking.status || "Pending")}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2 mt-2">
                                                        <div className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" /> {getFormattedDate(booking.slot?.date)}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" /> {booking.slot?.time}
                                                        </div>
                                                        {["accepted", "travelling", "arrived", "in_progress"].includes(booking.status?.toLowerCase()) ? (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleProviderClick(booking); }} 
                                                                className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                                                            >
                                                                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                                                <span className="font-bold underline decoration-primary/30 underline-offset-2">
                                                                    {booking.slot?.provider?.name || booking.teamMembers?.[0]?.name || Object.values(providers || {}).find(p => p.id === booking.assignedProvider)?.name || 'Trained Pro'}
                                                                </span>
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center gap-1 text-muted-foreground/60">
                                                                <Star className="w-3 h-3" />
                                                                <span className="font-medium text-[10px] uppercase tracking-wider">Professional Assigning...</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate opacity-70">
                                                        <MapPin className="w-3 h-3 text-primary" />
                                                        {booking.address?.houseNo}, {booking.address?.area}
                                                    </p>
                                                    {booking.otp && ((booking.status || "").toLowerCase() === "arrived") && (
                                                        <div className="mt-2 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg text-[11px] font-black tracking-widest shadow-sm">
                                                            OTP: {booking.otp}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Payment Status</p>
                                                    <p className="font-bold text-primary flex items-center gap-1">
                                                        ₹{booking.prepaidAmount ? booking.prepaidAmount.toLocaleString() : ((booking.bookingType || "").toLowerCase() === 'instant' ? (booking.totalAmount || 0)?.toLocaleString() : ((booking.totalAmount || 0) * 0.3)?.toLocaleString())}
                                                        <span className="text-[8px] font-black text-green-600 bg-green-50 px-1 rounded uppercase">
                                                            {booking.paymentStatus || ((booking.bookingType || "").toLowerCase() === 'instant' ? 'PAID' : '30% PAID')}
                                                        </span>
                                                    </p>
                                                </div>

                                                <div className="flex gap-2">
                                                    {activeTab === "Upcoming" ? (
                                                        <div className="flex gap-2">
                                                            {["accepted", "travelling", "arrived", "in_progress"].includes(booking.status?.toLowerCase()) && (
                                                                <>
                                                                    <button
                                                                        onClick={() => setChatBooking(booking)}
                                                                        className="h-9 w-9 rounded-xl border border-primary/20 bg-primary/5 text-primary flex items-center justify-center hover:bg-primary/10 transition-colors relative"
                                                                    >
                                                                        <MessageSquare className="w-4 h-4" />
                                                                        {(unreadCounts?.[booking._id || booking.id] || 0) > 0 && (
                                                                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center border border-white font-bold animate-bounce mt-1 mr-1">
                                                                                {unreadCounts[booking._id || booking.id]}
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setCallingBooking(booking)}
                                                                        className="h-9 w-9 rounded-xl border border-primary/20 bg-primary/5 text-primary flex items-center justify-center hover:bg-primary/10 transition-colors"
                                                                    >
                                                                        <Phone className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button
                                                                onClick={() => setDetailsBooking(booking)}
                                                                className="px-4 py-1.5 rounded-xl border border-primary/20 bg-primary/5 text-primary text-[11px] font-bold hover:bg-primary/10 transition-colors"
                                                            >
                                                                Details
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            {!booking.customerFeedbackSubmitted && (
                                                                <button onClick={() => setFeedbackBooking(booking)} className="px-4 py-1.5 rounded-xl border border-primary/20 bg-primary/5 text-primary text-[11px] font-bold flex items-center gap-1.5 hover:bg-primary/10 transition-colors">
                                                                    <Star className="w-3.5 h-3.5 fill-primary" /> Review
                                                                </button>
                                                            )}
                                                            <button 
                                                                onClick={() => handleRebook(booking)}
                                                                className="px-4 py-1.5 rounded-xl border border-primary/20 bg-primary/5 text-primary text-[11px] font-bold flex items-center gap-1.5 hover:bg-primary/10 transition-colors"
                                                            >
                                                                <RefreshCcw className="w-3 h-3" /> Rebook
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                        </div>

                        {bookings.filter(b => {
                            const s = (b.status || "").toLowerCase();
                            const isCustom = b.bookingType === "customized" || b.eventType;

                            // Strictly exclude customized bookings from normal tab
                            if (isCustom) return false;

                            if (activeTab === "Upcoming") return s !== "completed";
                            return s === "completed";
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
                                        <div className={`mb-3 p-3 rounded-xl border ${
                                            enq.displayPhase === "final" ? "bg-emerald-50 border-emerald-100" :
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
                                                        ₹{(enq.quote?.totalAmount || enq.totalAmount || 0).toLocaleString()}
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

                                    {(enq.categoryName || enq.selectedServices) && (
                                        <div className="mb-4 p-3 bg-purple-50/50 rounded-2xl border border-purple-100 flex flex-col gap-2">
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-purple-600 mb-1 flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> Requested Category:</p>
                                                <p className="text-sm font-bold">{enq.categoryName || enq.serviceType}</p>
                                            </div>
                                            {enq.selectedServices && (
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-purple-600 mb-1">Services Breakdown:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {enq.selectedServices.map((s, idx) => (
                                                            <span key={idx} className="text-[9px] font-bold px-2 py-1 bg-white border border-purple-200 text-purple-700 rounded-lg">
                                                                {s.name}
                                                            </span>
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
                                                        toast.success("Quote accepted. Please pay the advance.");
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
                                                Pay advance to confirm booking.
                                            </span>
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
                                                        navigate("/booking/summary?type=custom", {
                                                            state: { customAdvance: { enquiryId: enq._id || enq.id, amount: amt } }
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
                                                <button 
                                                    onClick={async () => {
                                                        try {
                                                            await rejectCustomEnquiry(enq._id || enq.id);
                                                            toast.success("Request rejected.");
                                                        } catch (e) {
                                                            toast.error(e?.message || "Failed to reject request");
                                                        }
                                                    }}
                                                    className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
                                                >
                                                    Reject
                                                </button>
                                                <button 
                                                    onClick={async () => {
                                                        try {
                                                            const expiryAt = enq.quote?.expiryAt ? new Date(enq.quote.expiryAt) : null;
                                                            if (expiryAt && !Number.isNaN(expiryAt.getTime()) && expiryAt.getTime() < Date.now()) {
                                                                toast.error("This quote has expired. Please request a new quote.");
                                                                return;
                                                            }
                                                            if (!(enq.quote?.totalAmount > 0 || enq.quote?.prebookAmount > 0)) {
                                                                toast.error("Quote not ready yet. Please wait for admin approval.");
                                                                return;
                                                            }
                                                            await acceptCustomEnquiry(enq._id || enq.id);
                                                            toast.success("Quote accepted. Please pay the advance.");
                                                        } catch (e) {
                                                            toast.error(e?.message || "Failed to accept request");
                                                        }
                                                    }}
                                                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity shadow-sm shadow-primary/20"
                                                >
                                                    Accept
                                                </button>
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

            <BookingDetailsModal
                isOpen={!!detailsBooking}
                onClose={() => setDetailsBooking(null)}
                booking={detailsBooking}
            />

            <SlotSelectionModal
                isOpen={!!rescheduleBooking}
                onClose={() => setRescheduleBooking(null)}
                onSave={() => {
                    setRescheduleBooking(null);
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

// Custom Enquiry Details Modal Component
const CustomEnquiryDetailsModal = ({ isOpen, onClose, enquiry }) => {
    if (!isOpen || !enquiry) return null;

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-background w-full max-w-2xl rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                    <div>
                        <h3 className="text-xl font-black font-display">{enquiry.eventType}</h3>
                        <p className="text-xs text-muted-foreground mt-1">Enquiry ID: {String(enquiry._id || enquiry.id || "").slice(-8)}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 rotate-90" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                        <span className={`text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full ${getPhaseColor(enquiry.displayPhase)}`}>
                            {enquiry.statusLabel || enquiry.status || "Pending Review"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Sent on {new Date(enquiry.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                    </div>

                    {/* Schedule & Details Grid */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                            <p className="text-xs font-black uppercase text-muted-foreground mb-3">Preferred Schedule</p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-bold">
                                    <Calendar className="w-4 h-4 text-primary" />
                                    {enquiry.scheduledAt?.date || enquiry.date}
                                </div>
                                <div className="flex items-center gap-2 text-sm font-bold">
                                    <Clock className="w-4 h-4 text-primary" />
                                    {enquiry.scheduledAt?.timeSlot || enquiry.timeSlot}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                            <p className="text-xs font-black uppercase text-muted-foreground mb-3">Event Details</p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-bold">
                                    <Users className="w-4 h-4 text-primary" />
                                    {enquiry.noOfPeople} People
                                </div>
                                {enquiry.quote?.totalServiceTime && (
                                    <div className="flex items-center gap-2 text-sm font-bold">
                                        <Clock className="w-4 h-4 text-primary" />
                                        {enquiry.quote.totalServiceTime}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Pricing Details */}
                    {((enquiry.quote?.totalAmount || enquiry.totalAmount || 0) > 0) && (
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                            <p className="text-xs font-black uppercase text-primary mb-3">Pricing Breakdown</p>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Total Amount</span>
                                    <span className="text-lg font-black text-primary">
                                        ₹{(enquiry.quote?.totalAmount || enquiry.totalAmount || 0).toLocaleString()}
                                    </span>
                                </div>
                                {((enquiry.quote?.discountPrice || enquiry.discountPrice || 0) > 0) && (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Discount</span>
                                            <span className="text-sm font-bold text-green-600">
                                                -₹{(enquiry.quote?.discountPrice || enquiry.discountPrice || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                                            <span className="text-sm font-bold">Final Amount</span>
                                            <span className="text-xl font-black text-emerald-600">
                                                ₹{((enquiry.quote?.totalAmount || enquiry.totalAmount || 0) - (enquiry.quote?.discountPrice || enquiry.discountPrice || 0)).toLocaleString()}
                                            </span>
                                        </div>
                                    </>
                                )}
                                {(enquiry.quote?.prebookAmount || 0) > 0 && (
                                    <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                                        <span className="text-sm font-bold text-amber-700">Advance Required</span>
                                        <span className="text-lg font-black text-amber-700">
                                            ₹{(enquiry.quote?.prebookAmount || 0).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Payment Status (After Acceptance) */}
                    {enquiry.paymentStatus && enquiry.paymentStatus !== "pending" && (
                        <div className="p-4 bg-green-50 rounded-2xl border border-green-200">
                            <p className="text-xs font-black uppercase text-green-600 mb-3 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> Payment Status
                            </p>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Status</span>
                                    <span className={`text-sm font-black uppercase px-3 py-1 rounded-full ${
                                        enquiry.paymentStatus === "paid" ? "bg-green-600 text-white" : 
                                        enquiry.paymentStatus === "refunded" ? "bg-red-600 text-white" : 
                                        "bg-amber-600 text-white"
                                    }`}>
                                        {enquiry.paymentStatus}
                                    </span>
                                </div>
                                {enquiry.prebookAmountPaid > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Advance Paid</span>
                                        <span className="text-lg font-black text-green-600">
                                            ₹{enquiry.prebookAmountPaid.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {enquiry.prebookPaidAt && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Paid On</span>
                                        <span className="text-xs font-bold">
                                            {new Date(enquiry.prebookPaidAt).toLocaleDateString('en-IN', { 
                                                day: 'numeric', 
                                                month: 'short', 
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Service Category & Services */}
                    {(enquiry.categoryName || enquiry.selectedServices) && (
                        <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                            <p className="text-xs font-black uppercase text-purple-600 mb-3 flex items-center gap-1">
                                <LayoutGrid className="h-4 w-4" /> Service Details
                            </p>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Category</p>
                                    <p className="text-sm font-bold">{enquiry.categoryName || enquiry.serviceType}</p>
                                </div>
                                {enquiry.selectedServices && enquiry.selectedServices.length > 0 && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2">Requested Services</p>
                                        <div className="flex flex-wrap gap-2">
                                            {enquiry.selectedServices.map((s, idx) => (
                                                <span key={idx} className="text-xs font-bold px-3 py-1 bg-white border border-purple-200 text-purple-700 rounded-lg">
                                                    {s.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Provider & Team Members */}
                    {(enquiry.assignedProvider || enquiry.maintainerProvider || (enquiry.teamMembers && enquiry.teamMembers.length > 0)) && (
                        <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                            <p className="text-xs font-black uppercase text-emerald-600 mb-3 flex items-center gap-1">
                                <Users className="h-4 w-4" /> {enquiry.teamMembers && enquiry.teamMembers.length > 0 ? 'Assigned Team' : 'Assigned Provider'}
                            </p>
                            
                            {/* Main Provider */}
                            {(enquiry.assignedProvider || enquiry.maintainerProvider) && !(enquiry.teamMembers && enquiry.teamMembers.length > 0) && (
                                <div className="p-3 bg-white border border-emerald-200 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <Star className="w-5 h-5 text-emerald-600 fill-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">Professional Assigned</p>
                                            <p className="text-xs text-muted-foreground">Provider ID: {enquiry.assignedProvider || enquiry.maintainerProvider}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Team Members */}
                            {enquiry.teamMembers && enquiry.teamMembers.length > 0 && (
                                <div className="grid grid-cols-2 gap-2">
                                    {enquiry.teamMembers.map((m, idx) => (
                                        <div key={idx} className="p-3 bg-white border border-emerald-200 rounded-xl">
                                            <p className="text-sm font-bold">{m.name}</p>
                                            <p className="text-xs text-muted-foreground">{m.serviceType}</p>
                                            {m.id === enquiry.maintainProvider && (
                                                <span className="inline-block mt-1 text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                                                    LEAD
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Customer Notes */}
                    {enquiry.notes && (
                        <div className="p-4 bg-accent/40 rounded-2xl border border-border">
                            <p className="text-xs font-black uppercase text-muted-foreground mb-2">Special Requirements</p>
                            <p className="text-sm text-foreground italic leading-relaxed">"{enquiry.notes}"</p>
                        </div>
                    )}

                    {/* Quote Expiry */}
                    {enquiry.quote?.expiryAt && (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                            <p className="text-xs font-bold text-amber-700">
                                Quote expires on: {new Date(enquiry.quote.expiryAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-muted/30">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-primary text-primary-foreground rounded-2xl font-bold hover:opacity-90 transition-opacity"
                    >
                        Close
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default BookingsPage;


