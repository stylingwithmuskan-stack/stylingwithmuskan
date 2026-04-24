import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CalendarRange, Search, MapPin, Clock, User, ChevronDown, ArrowRight,
    RefreshCw, CheckCircle, Users, AlertTriangle, Tag, Bell, BellOff, Zap, X, Phone, LayoutGrid, IndianRupee, Percent, Star, Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/user/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/user/components/ui/tabs";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const statusColors = {
    incoming: "bg-blue-100 text-blue-700 border-blue-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    "Pending": "bg-amber-100 text-amber-700 border-amber-200",
    accepted: "bg-emerald-100 text-emerald-700 border-emerald-200",
    travelling: "bg-indigo-100 text-indigo-700 border-indigo-200",
    arrived: "bg-purple-100 text-purple-700 border-purple-200",
    in_progress: "bg-violet-100 text-violet-700 border-violet-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
    provider_cancelled: "bg-orange-100 text-orange-700 border-orange-200",
    vendor_reassigned: "bg-blue-100 text-blue-700 border-blue-200",
    vendor_assigned: "bg-blue-100 text-blue-700 border-blue-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
    "Unassigned": "bg-orange-100 text-orange-700 border-orange-200",
    enquiry_created: "bg-slate-100 text-slate-700 border-slate-200",
    quote_submitted: "bg-blue-100 text-blue-700 border-blue-200",
    admin_approved: "bg-green-100 text-green-700 border-green-200",
    waiting_for_customer_payment: "bg-amber-100 text-amber-700 border-amber-200",
    advance_paid: "bg-teal-100 text-teal-700 border-teal-200",
    service_confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    service_completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    quote_expired: "bg-red-100 text-red-700 border-red-200",
};

export default function VenderBookings() {
    const { getAllBookings, getServiceProviders, getCustomEnquiries, assignSPToBooking, hydrated, isLoggedIn, assignTeamToBooking, reassignBooking, expireBooking, getAvailableProviders } = useVenderAuth();
  
    const [bookings, setBookings] = useState([]);
    const [providers, setProviders] = useState([]);
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [assignModal, setAssignModal] = useState(null);
    const [selectedProvider, setSelectedProvider] = useState("");
    const [selectedTeam, setSelectedTeam] = useState([]);
    const [customPrice, setCustomPrice] = useState(0);
    const [discountPrice, setDiscountPrice] = useState(0);
    const [prebookAmount, setPrebookAmount] = useState(0);
    const [totalServiceTime, setTotalServiceTime] = useState("");
    const [quoteExpiryHours, setQuoteExpiryHours] = useState(12);
    // Team assignment modal (after user accepts)
    const [teamAssignModal, setTeamAssignModal] = useState(null);
    const [teamSelectedMembers, setTeamSelectedMembers] = useState([]);
    const [teamLeadMember, setTeamLeadMember] = useState("");

    // Reassignment for provider-cancelled bookings
    const [reassignModal, setReassignModal] = useState(null);
    const [reassignProvider, setReassignProvider] = useState("");

    // Escalated bookings assignment
    const [escalatedAssignModal, setEscalatedAssignModal] = useState(null);
    const [availableProviders, setAvailableProviders] = useState([]);
    const [loadingAvailableProviders, setLoadingAvailableProviders] = useState(false);
    const [escalatedSelectedProvider, setEscalatedSelectedProvider] = useState("");

    const load = async () => {
        try {
            if (!hydrated || !isLoggedIn) return;
            const [bks, sps, enqs] = await Promise.all([getAllBookings(), getServiceProviders(), getCustomEnquiries()]);
            const normal = (Array.isArray(bks) ? bks : []).map((b) => ({ ...b, id: b._id || b.id }));
            const custom = (Array.isArray(enqs) ? enqs : []).map((e) => ({
                id: e._id || e.id,
                bookingType: "customized",
                status: e.status,
                customerName: e.name,
                phone: e.phone,
                eventType: e.eventType,
                noOfPeople: e.noOfPeople,
                slot: { date: e.scheduledAt?.date || e.date, time: e.scheduledAt?.timeSlot || e.timeSlot },
                address: e.address || {},
                items: e.items || [],
                notes: e.notes,
                totalAmount: e.quote?.totalAmount || 0,
                discountPrice: e.quote?.discountPrice || 0,
                prebookAmount: e.quote?.prebookAmount || 0,
                totalServiceTime: e.quote?.totalServiceTime || "",
                paymentStatus: e.paymentStatus || "",
                teamMembers: e.teamMembers || [],
                maintainProvider: e.maintainerProvider || "",
                assignedProvider: e.assignedProvider || e.maintainerProvider || "",
                enquiry: e,
                createdAt: e.createdAt,
            }));
            const combined = [...normal, ...custom].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setBookings(combined);
            const sArr = Array.isArray(sps) ? sps : [];
            setProviders(sArr.filter(sp => sp.approvalStatus === "approved").map((sp) => ({ ...sp, id: sp._id?.toString?.() || sp.id || sp.phone })));
        } catch {}
    };
    useEffect(() => { load(); }, [hydrated, isLoggedIn]);

    const filtered = bookings.filter(b => {
        const matchSearch = b.customerName?.toLowerCase().includes(search.toLowerCase()) || b.id?.includes(search) || b.serviceType?.toLowerCase().includes(search.toLowerCase());
        const status = (b.status || "").toLowerCase();

        let tabMatch = true;
        if (tab === "active") tabMatch = ["accepted", "travelling", "arrived", "in_progress", "service_confirmed"].includes(status);
        else if (tab === "pending") tabMatch = ["incoming", "pending", "unassigned", "enquiry_created", "quote_submitted", "admin_approved", "waiting_for_customer_payment", "advance_paid", "provider_cancelled", "vendor_assigned", "vendor_reassigned"].includes(status);
        else if (tab === "completed") tabMatch = status === "completed";
        else if (tab === "cancelled") tabMatch = ["cancelled", "rejected", "quote_expired"].includes(status);
        else if (tab === "provider_cancelled") tabMatch = status === "provider_cancelled";
        else if (tab === "escalated") tabMatch = status === "pending" && b.vendorEscalated === true && !b.assignedProvider;

        let typeMatch = true;
        if (typeFilter !== "all") {
            const bType = (b.bookingType || "instant").toLowerCase();
            typeMatch = bType.includes(typeFilter.toLowerCase());
        }

        return matchSearch && tabMatch && typeMatch;
    });

    // Step 1: Vendor sets price & discount price (NO team assignment yet)
    const handleSetPrice = async () => {
        if (!assignModal) return;

        if (assignModal.bookingType === "customized" || assignModal.eventType) {
            if (customPrice <= 0) {
                toast.error("Please set a valid price.");
                return;
            }
            const payload = {
                maintainerProvider: "",
                teamMembers: [],
                price: parseFloat(customPrice),
                discountPrice: parseFloat(discountPrice) || 0,
                prebookAmount: parseFloat(prebookAmount) || 0,
                totalServiceTime: totalServiceTime || "",
                quoteExpiryHours: Number(quoteExpiryHours) || 12,
                status: "quote_submitted"
            };
            try {
                await assignTeamToBooking(assignModal.id, payload);
                toast.success("Quote submitted for admin approval.");
            } catch (e) {
                toast.error(e?.message || "Failed to submit quote");
            }
        } else {
            if (selectedProvider) {
                try {
                    await assignSPToBooking(assignModal.id, selectedProvider);
                    toast.success("Service provider assigned.");
                } catch (e) {
                    toast.error(e?.message || "Assignment failed");
                }
            }
        }

        load();
        setAssignModal(null);
        setSelectedProvider("");
        setSelectedTeam([]);
        setCustomPrice(0);
        setDiscountPrice(0);
        setPrebookAmount(0);
        setTotalServiceTime("");
        setQuoteExpiryHours(12);
    };

    // Step 5: After user accepts, vendor assigns team + lead
    const handleAssignTeam = async () => {
        if (!teamAssignModal) return;
        if (teamSelectedMembers.length === 0 || !teamLeadMember) {
            toast.error("Please select team members and a lead member.");
            return;
        }
        const payload = {
            maintainerProvider: teamLeadMember,
            teamMembers: teamSelectedMembers.map(id => {
                const p = providers.find(sp => (sp.id || sp.phone) === id);
                return { id: p.id || p.phone, name: p.name, serviceType: p.specialties?.join(", ") || "General" };
            }),
            price: teamAssignModal.totalAmount,
            discountPrice: teamAssignModal.discountPrice || 0,
            status: "assign_team"
        };
        try {
            await assignTeamToBooking(teamAssignModal.id, payload);
            toast.success("Team assigned successfully.");
        } catch (e) {
            toast.error(e?.message || "Team assignment failed");
        }
        load();
        setTeamAssignModal(null);
        setTeamSelectedMembers([]);
        setTeamLeadMember("");
    };

    const toggleTeamMember = (id, isForTeamAssign = false) => {
        const strId = String(id);
        if (isForTeamAssign) {
            setTeamSelectedMembers(prev => {
                const isRemoving = prev.includes(strId);
                const next = isRemoving ? prev.filter(i => i !== strId) : [...prev, strId];
                if (next.length === 1 && !isRemoving) setTeamLeadMember(strId);
                else if (isRemoving && teamLeadMember === strId) setTeamLeadMember(next.length > 0 ? next[0] : "");
                else if (next.length === 0) setTeamLeadMember("");
                return next;
            });
        } else {
            setSelectedTeam(prev => {
                const isRemoving = prev.includes(strId);
                const next = isRemoving ? prev.filter(i => i !== strId) : [...prev, strId];
                if (next.length === 1 && !isRemoving) setSelectedProvider(strId);
                else if (isRemoving && selectedProvider === strId) setSelectedProvider(next.length > 0 ? next[0] : "");
                else if (next.length === 0) setSelectedProvider("");
                return next;
            });
        }
    };

    const getBookingTime = (booking) => {
        if (!booking?.slot?.date || !booking?.slot?.time) return null;
        try {
            const [h, m] = booking.slot.time.split(":").map(Number);
            const d = new Date(booking.slot.date);
            d.setHours(h, m, 0, 0);
            return d;
        } catch { return null; }
    };

    const isReassignmentExpired = (booking) => {
        const bTime = getBookingTime(booking);
        if (!bTime) return true;
        const now = new Date();
        const diffMs = bTime.getTime() - now.getTime();
        return diffMs < 60 * 60 * 1000; // Less than 1 hour
    };

    const handleReassignSP = async () => {
        if (!reassignModal || !reassignProvider) return;
        try {
            await reassignBooking(reassignModal.id, reassignProvider);
            toast.success("Booking reassigned successfully.");
            load();
            setReassignModal(null);
            setReassignProvider("");
        } catch (e) {
            toast.error(e?.message || "Reassignment failed");
        }
    };

    const handleExpireBooking = async (bookingId) => {
        try {
            await expireBooking(bookingId);
            toast.success("Booking expired and user notified.");
            load();
        } catch (e) {
            toast.error(e?.message || "Failed to expire booking");
        }
    };

    const getButtonLabel = (booking) => {
        const st = (booking.status || "").toLowerCase();
        if (st === "provider_cancelled") {
            return isReassignmentExpired(booking) ? "Expired" : "Reassign";
        }
        // Escalated bookings
        if (st === "pending" && booking.vendorEscalated === true && !booking.assignedProvider) {
            return "Assign Provider";
        }
        if (booking.bookingType === "customized" || booking.eventType) {
            if (st === "advance_paid") return "Assign Team";
            if (st === "quote_submitted") return "Modify Quote";
            if (st === "enquiry_created") return "Set Quote";
            if (booking.totalAmount > 0 && !booking.assignedProvider) return "Edit Quote";
            return "Set Quote";
        }
        return booking.assignedProvider ? "Re-assign" : "Assign";
    };

    const handleBookingAction = (booking) => {
        const st = (booking.status || "").toLowerCase();
        if (st === "provider_cancelled") {
            if (isReassignmentExpired(booking)) {
                handleExpireBooking(booking.id);
            } else {
                setReassignModal(booking);
                setReassignProvider("");
            }
            return;
        }
        // Handle escalated bookings
        if (st === "pending" && booking.vendorEscalated === true && !booking.assignedProvider) {
            setEscalatedAssignModal(booking);
            setEscalatedSelectedProvider("");
            fetchAvailableProviders(booking.id);
            return;
        }
        if ((booking.bookingType === "customized" || booking.eventType) && st === "advance_paid") {
            // Open team assignment modal
            setTeamAssignModal(booking);
            setTeamSelectedMembers(booking.teamMembers?.map(m => m.id) || []);
            setTeamLeadMember(booking.maintainProvider || "");
        } else {
            // Open price setting modal
            setAssignModal(booking);
            if (!(booking.bookingType === "customized" || booking.eventType)) {
                fetchAvailableProviders(booking.id);
            }
            setCustomPrice(booking.totalAmount || 0);
            setDiscountPrice(booking.discountPrice || 0);
            setPrebookAmount(booking.prebookAmount || 0);
            setTotalServiceTime(booking.totalServiceTime || "");
            setQuoteExpiryHours(12);
        }
    };

    const canShowAction = (booking) => {
        const st = (booking.status || "").toLowerCase();
        
        // Statuses that require vendor action (Assign or Re-assign)
        const vendorActionRequired = [
            "incoming", "pending", "unassigned", "unassigned", 
            "rejected", "provider_cancelled", "vendor_assigned", "vendor_reassigned"
        ];
        
        if (vendorActionRequired.includes(st)) return true;

        // Escalated bookings need assignment (often status is still 'pending')
        if (st === "pending" && booking.vendorEscalated === true && !booking.assignedProvider) return true;

        if (booking.bookingType === "customized" || booking.eventType) {
            return ["enquiry_created", "quote_submitted", "advance_paid"].includes(st);
        }
        return false;
    };

    const fetchAvailableProviders = async (bookingId) => {
        setLoadingAvailableProviders(true);
        try {
            const providers = await getAvailableProviders(bookingId);
            setAvailableProviders(providers || []);
        } catch (error) {
            console.error("Error fetching available providers:", error);
            toast.error("Failed to load available providers");
            setAvailableProviders([]);
        } finally {
            setLoadingAvailableProviders(false);
        }
    };

    const handleEscalatedAssign = async () => {
        if (!escalatedAssignModal || !escalatedSelectedProvider) return;
        try {
            await assignSPToBooking(escalatedAssignModal.id, escalatedSelectedProvider);
            toast.success("Provider assigned successfully to escalated booking.");
            load();
            setEscalatedAssignModal(null);
            setEscalatedSelectedProvider("");
            setAvailableProviders([]);
        } catch (e) {
            toast.error(e?.message || "Assignment failed");
        }
    };

    return (
        <div className="space-y-4 md:space-y-6 pb-20">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[200px]">
                    <h1 className="text-xl md:text-3xl font-black tracking-tight flex items-center gap-1.5 md:gap-2">
                        <CalendarRange className="h-5 w-5 md:h-7 md:w-7 text-primary" /> Booking Management
                    </h1>
                    <p className="text-[9px] md:text-sm text-muted-foreground font-medium mt-0.5">Track and manage all bookings with service type info</p>
                </div>
                <Button onClick={load} variant="outline" size="sm" className="gap-1.5 rounded-lg font-bold text-xs h-8 shrink-0">
                    <RefreshCw className="h-3 w-3" /> <span className="hidden sm:inline">Refresh</span>
                </Button>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                    { label: "Total", val: bookings.length, color: "bg-blue-50 text-blue-600 border-blue-200" },
                    { label: "Active", val: bookings.filter(b => ["accepted", "travelling", "arrived", "in_progress", "service_confirmed"].includes((b.status || "").toLowerCase())).length, color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
                    { label: "Pending", val: bookings.filter(b => ["incoming", "pending", "unassigned", "enquiry_created", "quote_submitted", "admin_approved", "waiting_for_customer_payment", "advance_paid", "provider_cancelled", "vendor_assigned", "vendor_reassigned"].includes((b.status || "").toLowerCase())).length, color: "bg-amber-50 text-amber-600 border-amber-200" },
                    { label: "Escalated", val: bookings.filter(b => (b.status || "").toLowerCase() === "pending" && b.vendorEscalated === true && !b.assignedProvider).length, color: "bg-red-50 text-red-600 border-red-200" },
                    { label: "Unassigned", val: bookings.filter(b => (b.status || "").toLowerCase() === "unassigned").length, color: "bg-orange-50 text-orange-600 border-orange-200" },
                    { label: "Completed", val: bookings.filter(b => (b.status || "").toLowerCase() === "completed").length, color: "bg-green-50 text-green-600 border-green-200" },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}
                        className={`rounded-xl p-3 border ${s.color}`}>
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{s.label}</p>
                        <p className="text-xl font-black mt-1">{s.val}</p>
                    </motion.div>
                ))}
            </motion.div>

            {/* Tabs + Search */}
            <Tabs value={tab} onValueChange={setTab}>
                {/* Mobile Dropdowns */}
                <div className="flex md:hidden flex-row gap-2 mb-3 w-full">
                    <select
                        value={tab}
                        onChange={(e) => setTab(e.target.value)}
                        className="block w-1/2 flex-1 p-2.5 text-[11px] font-bold text-gray-700 bg-gray-50 border border-emerald-100 rounded-lg outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="escalated">🚨 Escalated</option>
                        <option value="active">Active</option>
                        <option value="completed">Done</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="provider_cancelled">⚠️ Reassign Needed</option>
                    </select>

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="block w-1/2 flex-1 p-2.5 text-[11px] font-bold text-gray-700 bg-gray-50 border border-emerald-100 rounded-lg outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    >
                        <option value="all">All Types</option>
                        <option value="instant">Standard</option>
                        <option value="prebooking">Pre-booking</option>
                        <option value="customized">Customized</option>
                    </select>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4 w-full">
                    <div className="hidden md:flex">
                        <TabsList className="bg-muted/50 rounded-xl p-1 flex-wrap h-auto">
                            <TabsTrigger value="all" className="rounded-lg text-xs font-bold">All</TabsTrigger>
                            <TabsTrigger value="pending" className="rounded-lg text-xs font-bold">Pending</TabsTrigger>
                            <TabsTrigger value="escalated" className="rounded-lg text-xs font-bold data-[state=active]:bg-red-600 data-[state=active]:text-white flex gap-1.5 items-center">
                                🚨 Escalated
                            </TabsTrigger>
                            <TabsTrigger value="active" className="rounded-lg text-xs font-bold">Active</TabsTrigger>
                            <TabsTrigger value="completed" className="rounded-lg text-xs font-bold">Done</TabsTrigger>
                            <TabsTrigger value="cancelled" className="rounded-lg text-xs font-bold">Cancelled</TabsTrigger>
                            <TabsTrigger value="provider_cancelled" className="rounded-lg text-xs font-bold data-[state=active]:bg-orange-500 data-[state=active]:text-white flex gap-1.5 items-center">
                                <AlertTriangle className="w-3.5 h-3.5" /> Reassign
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="hidden md:flex">
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[160px] h-10 rounded-xl">
                                <SelectValue placeholder="Booking Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="instant">Standard</SelectItem>
                                <SelectItem value="prebooking">Pre-booking</SelectItem>
                                <SelectItem value="customized">Customized</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="relative flex-1 w-full md:max-w-sm shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input placeholder="Search by name, ID, or type..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 rounded-xl h-9 text-[11px] md:text-sm font-medium border-emerald-100" />
                    </div>
                </div>

                <TabsContent value={tab} className="mt-0">
                    {filtered.length === 0 ? (
                        <Card className="shadow-sm">
                            <CardContent className="py-16 text-center">
                                <CalendarRange className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-sm font-bold text-muted-foreground">No bookings found</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                            {filtered.map((booking) => (
                                <motion.div key={booking.id} variants={item}>
                                    <Card className="shadow-sm hover:shadow-md transition-all duration-200">
                                        <CardContent className="p-3 md:p-5">
                                            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                                                {/* Booking Info */}
                                                <div className="flex-1 min-w-0 w-full">
                                                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                                                        <span className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate max-w-full sm:max-w-[100px]">#{booking.id.slice(-8)}</span>
                                                        <Badge variant="outline" className={`text-[8px] md:text-[9px] font-black px-1.5 py-0 h-4 border shrink-0 ${statusColors[booking.status] || ""}`}>
                                                            {(booking.status || "").replace(/_/g, " ")}
                                                        </Badge>
                                                        {booking.serviceType && (
                                                            <Badge variant="outline" className="text-[8px] md:text-[9px] font-bold px-1.5 py-0 h-4 bg-purple-50 text-purple-600 border-purple-200 shrink-0">
                                                                <Tag className="h-2 w-2 md:h-2.5 md:w-2.5 mr-0.5" />{booking.serviceType}
                                                            </Badge>
                                                        )}
                                                        {booking.bookingType && (
                                                            <Badge variant="outline" className="text-[8px] md:text-[9px] font-bold px-1.5 py-0 h-4 bg-blue-50 text-blue-600 border-blue-200 shrink-0">
                                                                <Tag className="h-2 w-2 md:h-2.5 md:w-2.5 mr-0.5" />{booking.bookingType}
                                                            </Badge>
                                                        )}
                                                        {booking.notificationStatus === "queued" && (
                                                            <Badge variant="outline" className="text-[8px] md:text-[9px] font-bold px-1.5 py-0 h-4 bg-yellow-50 text-yellow-600 border-yellow-200 shrink-0">
                                                                <BellOff className="h-2 w-2 md:h-2.5 md:w-2.5 mr-0.5" />Queued
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <h3 className="text-sm md:text-base font-bold flex items-center gap-1.5 md:gap-2">
                                                        <User className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground shrink-0" /> <span className="truncate">{booking.customerName || "Customer"}</span>
                                                    </h3>
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-1 sm:gap-x-4 mt-1 md:mt-2 text-[10px] md:text-[11px] text-muted-foreground font-medium w-full">
                                                        <span className="flex items-center gap-1 min-w-0"><Clock className="h-3 w-3 shrink-0" /> <span className="truncate">{booking.slot?.time} • {booking.slot?.date}</span></span>
                                                        <span className="flex items-center gap-1 min-w-0"><MapPin className="h-3 w-3 shrink-0" /> <span className="truncate max-w-full">{booking.address?.area || "N/A"}</span></span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 md:gap-1.5 mt-1.5 md:mt-2">
                                                        {booking.items?.map((s, i) => (
                                                            <span key={i} className="text-[9px] md:text-[10px] font-semibold bg-muted px-1.5 py-0.5 rounded-md truncate max-w-full sm:max-w-[120px]">{s.name}</span>
                                                        ))}
                                                        {booking.services?.map((s, i) => (
                                                            <span key={i} className="text-[9px] md:text-[10px] font-semibold bg-muted px-1.5 py-0.5 rounded-md truncate max-w-full sm:max-w-[120px]">{s.name}</span>
                                                        ))}
                                                    </div>

                                                    {/* Price & Discount display */}
                                                    {(booking.bookingType === "customized" || booking.eventType) && booking.totalAmount > 0 && (
                                                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
                                                            <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                                                <IndianRupee className="h-3 w-3" /> Price: <span className="text-foreground font-black">₹{booking.totalAmount?.toLocaleString()}</span>
                                                            </span>
                                                            {booking.discountPrice > 0 && (
                                                                <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                                                                    <Percent className="h-3 w-3" /> Discount: <span className="font-black">₹{booking.discountPrice?.toLocaleString()}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {booking.assignedProvider && (
                                                        <p className="text-[9px] mt-1.5 text-emerald-600 font-bold flex items-center gap-1">
                                                            <Zap className="h-3 w-3" /> {(booking.bookingType === "customized" || booking.eventType) ? "Lead Member:" : "Assigned to:"} {
                                                                providers.find(p => (p.id || p.phone) === booking.assignedProvider)?.name || booking.assignedProvider
                                                            }
                                                        </p>
                                                    )}

                                                    {/* Team Display for Customized */}
                                                    {booking.teamMembers && booking.teamMembers.length > 0 && (
                                                        <div className="mt-2 space-y-1 py-2 border-t border-border/50">
                                                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                                                                <Users className="h-2.5 w-2.5" /> Team Assigned:
                                                            </p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {booking.teamMembers.map((m, i) => (
                                                                    <span key={i} className="text-[8px] font-bold px-1.5 py-0.5 bg-muted rounded border border-border">
                                                                        {m.name} ({m.serviceType})
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Price + Actions */}
                                                <div className="flex md:flex-col items-center md:items-end gap-3 md:min-w-[140px]">
                                                    <span className="text-xl font-black text-primary">₹{booking.totalAmount?.toLocaleString()}</span>
                                                    {canShowAction(booking) ? (
                                                        <Button size="sm" className="h-8 bg-primary hover:bg-primary/90 rounded-lg text-[11px] font-bold gap-1" onClick={() => handleBookingAction(booking)}>
                                                            <Users className="h-3.5 w-3.5" /> 
                                                            {getButtonLabel(booking)}
                                                        </Button>
                                                    ) : booking.status === "quote_submitted" ? (
                                                        <Badge variant="outline" className="h-8 px-3 rounded-lg bg-blue-50 text-blue-600 border-blue-200 font-bold cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleBookingAction(booking)}>Pending Admin ✎</Badge>
                                                    ) : booking.status === "admin_approved" ? (
                                                        <Badge variant="outline" className="h-8 px-3 rounded-lg bg-green-50 text-green-700 border-green-200 font-bold">Pending User</Badge>
                                                    ) : booking.status === "waiting_for_customer_payment" ? (
                                                        <Badge variant="outline" className="h-8 px-3 rounded-lg bg-amber-50 text-amber-700 border-amber-200 font-bold">Waiting Payment</Badge>
                                                    ) : booking.status === "advance_paid" ? (
                                                        <Badge variant="outline" className="h-8 px-3 rounded-lg bg-teal-50 text-teal-700 border-teal-200 font-bold">Ready for Team</Badge>
                                                    ) : booking.status === "quote_expired" ? (
                                                        <Badge variant="outline" className="h-8 px-3 rounded-lg bg-red-50 text-red-700 border-red-200 font-bold">Quote Expired</Badge>
                                                    ) : booking.status === "service_confirmed" ? (
                                                        <Badge variant="outline" className="h-8 px-3 rounded-lg bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">Live Booking</Badge>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </TabsContent>
            </Tabs>

            {/* ═══════ PRICE SETTING MODAL (Step 1 - Vendor sets price & discount) ═══════ */}
            <AnimatePresence>
                {assignModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setAssignModal(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-[420px] bg-card rounded-[24px] shadow-2xl border border-border p-4 space-y-3 overflow-y-auto max-h-[90vh] scrollbar-hide"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black">
                                    {(assignModal.bookingType === "customized" || assignModal.eventType) ? "Set Pricing" : "Assign Service Provider"}
                                </h3>
                                <button onClick={() => setAssignModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center transition-colors"><X className="h-4 w-4" /></button>
                            </div>
                            <div className="bg-muted/50 rounded-2xl p-4 space-y-4 border border-border/50 shadow-inner">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Reference</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-black">#{assignModal.id}</p>
                                            {assignModal.bookingType && (
                                                <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20 font-black uppercase tracking-tighter">
                                                    {assignModal.bookingType}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-sm font-black text-primary bg-primary/10 px-3 py-1 rounded-full italic">₹{assignModal.totalAmount?.toLocaleString()}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-3 border-y border-border/40">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Schedule</p>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3 w-3 text-primary" />
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black leading-none">{assignModal.slot?.date}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground mt-0.5">{assignModal.slot?.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Location</p>
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="h-3 w-3 text-primary" />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-black truncate leading-none">{assignModal.address?.area || "N/A"}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground mt-0.5 truncate">{assignModal.address?.city}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Customer</p>
                                        <div className="flex flex-col">
                                            <p className="text-xs font-black leading-none">{assignModal.customerName}</p>
                                            <p className="text-[10px] font-medium text-muted-foreground italic flex items-center gap-1 mt-1"><Phone className="h-2.5 w-2.5 text-primary" /> {assignModal.phone || "No phone"}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-right">Group Size</p>
                                        <p className="text-xs font-black flex items-center justify-end gap-1.5 text-primary mt-1"><Users className="h-3 w-3" /> {assignModal.noOfPeople || "N/A"} People</p>
                                    </div>
                                </div>

                                {(assignModal.categoryName || assignModal.selectedServices || assignModal.services || assignModal.items) && (
                                    <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 flex flex-col gap-2">
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-primary mb-1 flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> Services Needed:</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(assignModal.selectedServices || assignModal.services || assignModal.items || []).map((s, idx) => (
                                                    <span key={idx} className="text-[9px] font-black px-2 py-0.5 bg-card border border-primary/20 text-primary rounded-lg shadow-sm">
                                                        {s.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {assignModal.notes && (
                                    <div className="p-3 bg-white/50 rounded-xl border border-border/40">
                                        <p className="text-[9px] font-black uppercase text-pink-600 mb-1">Special Requirements:</p>
                                        <p className="text-[11px] font-semibold text-foreground italic leading-tight">"{assignModal.notes}"</p>
                                    </div>
                                )}
                            </div>

                            {/* Customized Booking: Price & Discount Price Fields */}
                            {(assignModal.bookingType === "customized" || assignModal.eventType) && (
                                <div className="space-y-4 py-2 border-y border-border/50">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-1.5">
                                            <IndianRupee className="h-3 w-3 text-primary" /> Booking Price (₹)
                                        </label>
                                        <Input
                                            type="number"
                                            value={customPrice}
                                            onChange={(e) => setCustomPrice(e.target.value)}
                                            placeholder="Enter total price for user"
                                            className="h-11 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-1.5">
                                            <Percent className="h-3 w-3 text-green-600" /> Discount Price (₹)
                                        </label>
                                        <Input
                                            type="number"
                                            value={discountPrice}
                                            onChange={(e) => setDiscountPrice(e.target.value)}
                                            placeholder="Enter discount amount (optional)"
                                            className="h-11 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-1.5">
                                            <IndianRupee className="h-3 w-3 text-amber-600" /> Advance Amount (₹)
                                        </label>
                                        <Input
                                            type="number"
                                            value={prebookAmount}
                                            onChange={(e) => setPrebookAmount(e.target.value)}
                                            placeholder="Advance to confirm booking"
                                            className="h-11 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                                            Total Service Time
                                        </label>
                                        <Input
                                            type="text"
                                            value={totalServiceTime}
                                            onChange={(e) => setTotalServiceTime(e.target.value)}
                                            placeholder="Example: 4 hours"
                                            className="h-11 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                                            Quote Expiry (hours)
                                        </label>
                                        <Input
                                            type="number"
                                            value={quoteExpiryHours}
                                            onChange={(e) => setQuoteExpiryHours(e.target.value)}
                                            placeholder="12"
                                            className="h-11 rounded-xl"
                                        />
                                    </div>
                                    {customPrice > 0 && (
                                        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase text-emerald-700">Final Price for User</span>
                                                <span className="text-lg font-black text-emerald-700">₹{(parseFloat(customPrice) - (parseFloat(discountPrice) || 0)).toLocaleString()}</span>
                                            </div>
                                            {parseFloat(discountPrice) > 0 && (
                                                <p className="text-[9px] text-emerald-600 mt-1 font-bold">
                                                    Original: ₹{parseFloat(customPrice).toLocaleString()} → Discount: ₹{parseFloat(discountPrice).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Regular Booking: Select Provider */}
                            {!(assignModal.bookingType === "customized" || assignModal.eventType) && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Select Service Provider</label>
                                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                                        <SelectTrigger className="h-11 rounded-xl">
                                            <SelectValue placeholder={loadingAvailableProviders ? "Loading available professionals..." : "Select a professional"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {loadingAvailableProviders ? (
                                                <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                                    <RefreshCw className="h-3 w-3 animate-spin" /> Fetching available professionals...
                                                </div>
                                            ) : availableProviders.length > 0 ? availableProviders.map(p => (
                                                <SelectItem key={p._id || p.id || p.phone} value={String(p._id || p.id || p.phone)}>{p.name} ({p.phone})</SelectItem>
                                            )) : (
                                                <div className="p-4 text-center text-xs text-red-500 font-bold">
                                                    No providers available for this slot
                                                </div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button className="flex-1 h-11 rounded-xl font-bold gap-2" onClick={handleSetPrice} disabled={(assignModal.bookingType === "customized" || assignModal.eventType) ? customPrice <= 0 : !selectedProvider}>
                                    <CheckCircle className="h-4 w-4" /> {(assignModal.bookingType === "customized" || assignModal.eventType) ? "Submit Pricing" : "Assign"}
                                </Button>
                                <Button variant="outline" className="h-11 rounded-xl font-bold" onClick={() => setAssignModal(null)}>Cancel</Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ═══════ TEAM ASSIGNMENT MODAL (Step 5 - After user accepts) ═══════ */}
            <AnimatePresence>
                {teamAssignModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setTeamAssignModal(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-[420px] bg-card rounded-[24px] shadow-2xl border border-border p-4 space-y-3 overflow-y-auto max-h-[90vh] scrollbar-hide"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black">Assign Team Members</h3>
                                <button onClick={() => setTeamAssignModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center transition-colors"><X className="h-4 w-4" /></button>
                            </div>

                            {/* Booking Quick Info */}
                            <div className="bg-muted/50 rounded-2xl p-4 space-y-4 border border-border/50">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Booking</p>
                                        <p className="text-sm font-black">#{teamAssignModal.id}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] bg-teal-50 text-teal-600 border-teal-200">Advance Paid ✓</Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-3 border-y border-border/40">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Schedule</p>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3 w-3 text-primary" />
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black leading-none">{teamAssignModal.slot?.date}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground mt-0.5">{teamAssignModal.slot?.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-right">Price Details</p>
                                        <div className="flex flex-col items-end">
                                            <p className="text-xs font-black text-primary italic">₹{teamAssignModal.totalAmount?.toLocaleString()}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Total Amount</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Customer</p>
                                    <p className="text-xs font-black">{teamAssignModal.customerName}</p>
                                </div>
                            </div>

                            {/* Select Team Members */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Select Team Members</label>
                                <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                                    {providers.map(p => {
                                        const pId = String(p.id || p.phone);
                                        return (
                                            <button
                                                key={pId}
                                                onClick={() => toggleTeamMember(pId, true)}
                                                className={`p-2 rounded-xl text-[10px] text-left border-2 transition-all ${teamSelectedMembers.includes(pId)
                                                    ? "border-primary bg-primary/5 font-bold"
                                                    : "border-border bg-muted/20 text-muted-foreground"
                                                    }`}
                                            >
                                                <p className="truncate">{p.name}</p>
                                                <p className="text-[8px] opacity-70 truncate">{p.specialties?.join(", ")}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Select Lead Member */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Lead Member (from Team)</label>
                                <Select value={teamLeadMember} onValueChange={setTeamLeadMember}>
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder="Pick Lead from Team" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {providers.filter(p => teamSelectedMembers.includes(String(p.id || p.phone))).map(p => (
                                            <SelectItem key={p.id || p.phone} value={String(p.id || p.phone)}>{p.name} (Team)</SelectItem>
                                        ))}
                                        {teamSelectedMembers.length === 0 && (
                                            <p className="p-4 text-center text-xs text-muted-foreground font-bold italic opacity-50">Select team members above first</p>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-2">
                                <Button className="flex-1 h-11 rounded-xl font-bold gap-2" onClick={handleAssignTeam} disabled={teamSelectedMembers.length === 0 || !teamLeadMember}>
                                    <CheckCircle className="h-4 w-4" /> Assign Team
                                </Button>
                                <Button variant="outline" className="h-11 rounded-xl font-bold" onClick={() => setTeamAssignModal(null)}>Cancel</Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ═══════ REASSIGNMENT MODAL (For Provider Cancelled Bookings) ═══════ */}
            <AnimatePresence>
                {reassignModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setReassignModal(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-[420px] bg-card rounded-[24px] shadow-2xl border border-border p-4 space-y-3"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black">Reassign Provider</h3>
                                <button onClick={() => setReassignModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center transition-colors"><X className="h-4 w-4" /></button>
                            </div>

                            <div className="bg-red-50 rounded-xl p-3 border border-red-100 space-y-2">
                                <p className="text-[10px] font-black uppercase text-red-600 tracking-widest flex items-center gap-1.5">
                                    <AlertTriangle className="h-3 w-3" /> Provider Cancelled
                                </p>
                                <p className="text-xs font-medium text-red-700">
                                    The previous provider cancelled this booking. Please select a new professional immediately.
                                </p>
                            </div>

                            <div className="bg-muted/50 rounded-2xl p-4 space-y-4 border border-border/50 shadow-inner">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Booking</p>
                                        <p className="text-sm font-black">#{reassignModal.id}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200 uppercase font-black tracking-widest">{reassignModal.serviceType}</Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-3 border-y border-border/40">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Schedule</p>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3 w-3 text-primary" />
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black leading-none">{reassignModal.slot?.date}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground mt-0.5">{reassignModal.slot?.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-right">Location</p>
                                        <div className="flex items-center justify-end gap-1.5">
                                            <div className="flex flex-col items-end min-w-0">
                                                <span className="text-xs font-black truncate leading-none text-right w-full">{reassignModal.address?.area || "N/A"}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground mt-0.5 truncate text-right w-full">{reassignModal.address?.city}</span>
                                            </div>
                                            <MapPin className="h-3 w-3 text-primary" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Customer</p>
                                    <p className="text-xs font-black">{reassignModal.customerName}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Choose New Professional</label>
                                <Select value={reassignProvider} onValueChange={setReassignProvider}>
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder="Select a professional" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {providers.map(p => (
                                            <SelectItem key={p.id || p.phone} value={String(p.id || p.phone)}>{p.name} ({p.phone})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-2">
                                <Button className="flex-1 h-11 rounded-xl font-bold gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleReassignSP} disabled={!reassignProvider}>
                                    <CheckCircle className="h-4 w-4" /> Confirm Reassign
                                </Button>
                                <Button variant="outline" className="h-11 rounded-xl font-bold" onClick={() => setReassignModal(null)}>Cancel</Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ═══════ ESCALATED BOOKING ASSIGNMENT MODAL ═══════ */}
            <AnimatePresence>
                {escalatedAssignModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setEscalatedAssignModal(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-[420px] bg-card rounded-[24px] shadow-2xl border border-border p-4 space-y-3 overflow-y-auto max-h-[90vh]"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black">🚨 Escalated Booking</h3>
                                <button onClick={() => setEscalatedAssignModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center transition-colors"><X className="h-4 w-4" /></button>
                            </div>

                            <div className="bg-red-50 rounded-xl p-3 border border-red-100 space-y-2">
                                <p className="text-[10px] font-black uppercase text-red-600 tracking-widest flex items-center gap-1.5">
                                    <AlertTriangle className="h-3 w-3" /> 5 Providers Rejected
                                </p>
                                <p className="text-xs font-medium text-red-700">
                                    This booking has been escalated to you after 5 providers rejected or timed out. Please assign an available provider immediately.
                                </p>
                            </div>

                            <div className="bg-muted/50 rounded-2xl p-4 space-y-4 border border-border/50 shadow-inner">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Booking</p>
                                        <p className="text-sm font-black">#{escalatedAssignModal.id}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200 uppercase font-black tracking-widest">{escalatedAssignModal.serviceType}</Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-3 border-y border-border/40">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Schedule</p>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3 w-3 text-primary" />
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black leading-none">{escalatedAssignModal.slot?.date}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground mt-0.5">{escalatedAssignModal.slot?.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-right">Location</p>
                                        <div className="flex items-center justify-end gap-1.5">
                                            <div className="flex flex-col items-end min-w-0">
                                                <span className="text-xs font-black truncate leading-none text-right w-full">{escalatedAssignModal.address?.area || "N/A"}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground mt-0.5 truncate text-right w-full">{escalatedAssignModal.address?.city}</span>
                                            </div>
                                            <MapPin className="h-3 w-3 text-primary" />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Customer</p>
                                        <p className="text-xs font-black leading-none">{escalatedAssignModal.customerName}</p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total Amount</p>
                                        <p className="text-xs font-black text-primary italic mt-1">₹{escalatedAssignModal.totalAmount?.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Services Needed</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(escalatedAssignModal.services || escalatedAssignModal.items || []).map((s, i) => (
                                            <span key={i} className="text-[9px] font-black px-2 py-0.5 bg-card border border-border/50 text-foreground rounded-lg shadow-sm">
                                                {s.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {loadingAvailableProviders ? (
                                <div className="py-8 text-center">
                                    <RefreshCw className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3 animate-spin" />
                                    <p className="text-sm font-bold text-muted-foreground">Loading available providers...</p>
                                </div>
                            ) : availableProviders.length === 0 ? (
                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center">
                                    <AlertTriangle className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-amber-900">No Available Providers</p>
                                    <p className="text-[10px] text-amber-700 mt-1">All providers are busy for this time slot.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-1.5">
                                        <Users className="h-3 w-3 text-emerald-600" /> Available Providers ({availableProviders.length})
                                    </label>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                        {availableProviders.map(p => (
                                            <button
                                                key={p._id}
                                                onClick={() => setEscalatedSelectedProvider(p._id)}
                                                className={`w-full p-3 rounded-xl text-left border-2 transition-all ${
                                                    escalatedSelectedProvider === p._id
                                                        ? "border-emerald-600 bg-emerald-50"
                                                        : "border-border bg-muted/20 hover:border-emerald-300"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-black">{p.name}</p>
                                                        <p className="text-[10px] text-muted-foreground font-medium">{p.phone}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="flex items-center gap-1 text-amber-600">
                                                            <Star className="h-3 w-3 fill-amber-600" />
                                                            <span className="text-xs font-black">{p.rating || 0}</span>
                                                        </div>
                                                        <p className="text-[9px] text-muted-foreground font-bold">{p.totalJobs || 0} jobs</p>
                                                    </div>
                                                </div>
                                                <div className="mt-2 pt-2 border-t border-border/50">
                                                    <p className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                                                        <Wallet className="h-2.5 w-2.5" /> Wallet: ₹{p.credits || 0}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button 
                                    className="flex-1 h-11 rounded-xl font-bold gap-2 bg-emerald-600 hover:bg-emerald-700" 
                                    onClick={handleEscalatedAssign} 
                                    disabled={!escalatedSelectedProvider || loadingAvailableProviders}
                                >
                                    <CheckCircle className="h-4 w-4" /> Assign Provider
                                </Button>
                                <Button variant="outline" className="h-11 rounded-xl font-bold" onClick={() => setEscalatedAssignModal(null)}>Cancel</Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}





