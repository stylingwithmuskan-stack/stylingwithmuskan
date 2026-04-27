import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarRange, Search, MapPin, Clock, User, Users, RefreshCw, CheckCircle, Bell, BellOff, Settings2, Tag, Zap, X, Phone, MessageSquare, Sparkles, LayoutGrid, CheckSquare, IndianRupee, Percent, Camera, ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/user/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/user/components/ui/tabs";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { Navigate } from "react-router-dom";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/modules/user/components/ui/pagination";

const statusColors = {
    incoming: "bg-blue-500/15 text-blue-600", pending: "bg-amber-500/15 text-amber-600", "Pending": "bg-amber-500/15 text-amber-600",
    accepted: "bg-emerald-500/15 text-emerald-600", travelling: "bg-indigo-500/15 text-indigo-600",
    arrived: "bg-purple-500/15 text-purple-600", in_progress: "bg-violet-500/15 text-violet-600",
    completed: "bg-green-500/15 text-green-600", cancelled: "bg-red-500/15 text-red-600",
    rejected: "bg-red-500/15 text-red-600", "Unassigned": "bg-orange-500/15 text-orange-600",
    vendor_assigned: "bg-blue-500/15 text-blue-600", admin_approved: "bg-green-500/15 text-green-600",
    user_accepted: "bg-teal-500/15 text-teal-600", team_assigned: "bg-cyan-500/15 text-cyan-600",
    final_approved: "bg-emerald-500/15 text-emerald-600"
};

const notifColors = {
    immediate: "bg-green-100 text-green-700 border-green-200",
    queued: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export default function BookingManagement() {
    const { isLoggedIn, getAllBookings, getAllServiceProviders, getAvailableProvidersForBooking, assignSPToBooking, assignTeamToBooking, approveBookingImages } = useAdminAuth();
    const { officeSettings, updateOfficeSettings, providers: moduleProviders } = useUserModuleData();
    const [bookings, setBookings] = useState([]);
    const [providers, setProviders] = useState([]);
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [assignModal, setAssignModal] = useState(null);
    const [availableProviders, setAvailableProviders] = useState([]);
    const [loadingProviders, setLoadingProviders] = useState(false);
    const [selectedSP, setSelectedSP] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [tempSettings, setTempSettings] = useState(officeSettings);
    // Admin review modal for price approval (Step 3)
    const [adminReviewModal, setAdminReviewModal] = useState(null);
    const [reviewData, setReviewData] = useState({ price: 0, discountPrice: 0 });
    // Admin team review modal for final approval (Step 6)
    const [adminTeamReviewModal, setAdminTeamReviewModal] = useState(null);
    const [detailModal, setDetailModal] = useState(null);
    const [updating, setUpdating] = useState(false);
    const [loading, setLoading] = useState(false);

    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, unassigned: 0, queued: 0 });
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Reset page to 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [tab, typeFilter, debouncedSearch]);

    useEffect(() => {
        if (!isLoggedIn) return;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn, page, tab, typeFilter, debouncedSearch]);

    if (!isLoggedIn) {
        return <Navigate to="/admin/login" replace />;
    }

    const STATUS_GROUPS = {
        active: ["accepted", "travelling", "arrived", "in_progress"],
        pending: ["incoming", "pending", "unassigned", "payment_pending", "documentation", "vendor_assigned", "admin_approved", "user_accepted", "team_assigned", "final_approved", "advance_paid"],
        completed: ["completed"],
        missed: ["cancelled", "missed", "rejected"]
    };

    const load = async () => {
        if (!isLoggedIn) return;
        setLoading(true);
        try {
            const params = {
                page,
                limit,
                tab: tab === "all" ? "" : tab,
                search: debouncedSearch,
                bookingType: typeFilter
            };
            const res = await getAllBookings(params);
            setBookings(Array.isArray(res.bookings) ? res.bookings : []);
            setTotal(res.total || 0);
            if (res.stats) setStats(res.stats);

            // Fetch providers separately as they are needed for assignment but don't need pagination here
            const spRaw = await getAllServiceProviders();
            const spFromDb = Array.isArray(spRaw) ? spRaw.filter(sp => sp.approvalStatus === "approved") : [];
            setProviders(spFromDb.length > 0 ? spFromDb : (moduleProviders || []));
        } catch (err) {
            console.error("Failed to load bookings", err);
            setBookings([]);
            setProviders(moduleProviders || []);
        } finally {
            setLoading(false);
        }
    };
    
    const handleOpenAssignModal = async (b) => {
        setAssignModal(b);
        setSelectedSP("");
        setAvailableProviders([]);
        setLoadingProviders(true);
        try {
            const list = await getAvailableProvidersForBooking(b._id || b.id);
            setAvailableProviders(list);
        } catch (e) {
            console.error("Failed to fetch available providers", e);
        } finally {
            setLoadingProviders(false);
        }
    };

    const handleAssign = async () => {
        if (assignModal && selectedSP) {
            try {
                setUpdating(true);
                await assignSPToBooking(assignModal._id || assignModal.id, selectedSP);
                await load();
                setAssignModal(null);
                setSelectedSP("");
            } catch (e) {
                alert(e.message || "Failed to assign provider");
            } finally {
                setUpdating(false);
            }
        }
    };

    const handleAdminPriceApprove = async () => {
        if (!adminReviewModal) return;

        const payload = {
            maintainerProvider: "",
            teamMembers: [],
            price: parseFloat(reviewData.price),
            discountPrice: parseFloat(reviewData.discountPrice) || 0,
            status: "admin_approved"
        };

        try {
            setUpdating(true);
            await assignTeamToBooking(adminReviewModal._id || adminReviewModal.id, payload);
            await load();
            setAdminReviewModal(null);
        } catch (e) {
            alert(e.message || "Failed to approve price");
        } finally {
            setUpdating(false);
        }
    };

    const handleAdminFinalApprove = async () => {
        if (!adminTeamReviewModal) return;

        const payload = {
            maintainerProvider: adminTeamReviewModal.maintainProvider,
            teamMembers: adminTeamReviewModal.teamMembers || [],
            price: adminTeamReviewModal.totalAmount,
            discountPrice: adminTeamReviewModal.discountPrice || 0,
            status: "final_approved"
        };

        try {
            setUpdating(true);
            await assignTeamToBooking(adminTeamReviewModal._id || adminTeamReviewModal.id, payload);
            await load();
            setAdminTeamReviewModal(null);
        } catch (e) {
            alert(e.message || "Failed to finalize assignment");
        } finally {
            setUpdating(false);
        }
    };

    useEffect(() => {
        setTempSettings(officeSettings);
    }, [officeSettings]);

    const handleApproveImages = async (bookingId, approved) => {
        try {
            setUpdating(true);
            await approveBookingImages(bookingId, approved);
            if (detailModal) {
                setDetailModal({ ...detailModal, imagesApproved: approved });
            }
            await load();
        } catch (e) {
            alert(e.message || "Failed to update image approval status");
        } finally {
            setUpdating(false);
        }
    };

    const handleSaveSettings = async () => {
        setUpdating(true);
        try {
            await updateOfficeSettings(tempSettings);
            setShowSettings(false);
        } catch (e) {
            alert(e.message || "Failed to update office settings");
        } finally {
            setUpdating(false);
        }
    };

    const unassignedCount = bookings.filter(b => {
        const s = (b.status || "").toLowerCase();
        return s === "unassigned" || s === "incoming" || s === "pending";
    }).length;

    const queuedCount = bookings.filter(b => b.notificationStatus === "queued").length;

    const getStatusLabel = (status) => {
        const labels = {
            vendor_assigned: "Price Set by Vendor",
            admin_approved: "Price Approved",
            user_accepted: "User Accepted",
            team_assigned: "Team Assigned",
            final_approved: "Ready for Service",
            payment_pending: "Awaiting Advance",
            documentation: "Documentation"
        };
        return labels[status] || (status || "").replace(/_/g, " ");
    };

    return (
        <div className="space-y-6">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                            <CalendarRange className="h-7 w-7 text-primary" /> Booking Management
                        </h1>
                        <p className="text-sm text-muted-foreground font-medium mt-1">Global booking oversight • Auto-assignment & notifications</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => { setTempSettings(officeSettings); setShowSettings(true); }} variant="outline" className="gap-2 rounded-xl font-bold">
                            <Settings2 className="h-4 w-4" /> Office Hours
                        </Button>
                        <Button onClick={load} variant="outline" className="gap-2 rounded-xl font-bold">
                            <RefreshCw className="h-4 w-4" /> Refresh
                        </Button>
                    </div>
                </motion.div>

                {/* Stats Bar */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                        { label: "Total", val: stats.total, color: "bg-blue-50 text-blue-600 border-blue-200" },
                        { label: "Active", val: stats.active, color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
                        { label: "Pending", val: stats.pending, color: "bg-amber-50 text-amber-600 border-amber-200" },
                        { label: "Unassigned", val: stats.unassigned, color: "bg-orange-50 text-orange-600 border-orange-200" },
                        { label: "Queued Notifs", val: stats.queued, color: "bg-yellow-50 text-yellow-600 border-yellow-200" },
                    ].map((s, i) => (
                        <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}
                            className={`rounded-xl p-3 border ${s.color}`}>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{s.label}</p>
                            <p className="text-xl font-black mt-1">{s.val}</p>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Office Hours Banner */}
                <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <Clock className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-primary">Office Hours: {officeSettings.startTime} - {officeSettings.endTime}</p>
                        <p className="text-[10px] text-muted-foreground">Bookings placed outside these hours will queue SP notifications until next business start.</p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] font-bold shrink-0 ${officeSettings.autoAssign ? 'border-green-200 text-green-600 bg-green-50' : 'border-red-200 text-red-600 bg-red-50'}`}>
                        {officeSettings.autoAssign ? "Auto-Assign ON" : "Manual Only"}
                    </Badge>
                </div>

                <Tabs value={tab} onValueChange={setTab}>
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                        <TabsList className="bg-muted/30 rounded-xl p-1 flex-wrap h-auto">
                            <TabsTrigger value="all" className="rounded-lg text-xs font-bold">All</TabsTrigger>
                            <TabsTrigger value="pending" className="rounded-lg text-xs font-bold">Pending / Unassigned</TabsTrigger>
                            <TabsTrigger value="active" className="rounded-lg text-xs font-bold">Active</TabsTrigger>
                            <TabsTrigger value="completed" className="rounded-lg text-xs font-bold">Done</TabsTrigger>
                            <TabsTrigger value="missed" className="rounded-lg text-xs font-bold">Missed</TabsTrigger>
                        </TabsList>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[160px] h-10 rounded-xl bg-muted/30 border-border/50">
                                <SelectValue placeholder="Booking Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="instant">Booked</SelectItem>
                                <SelectItem value="prebooking">Pre-booking</SelectItem>
                                <SelectItem value="customized">Customized</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search by name, ID, or service type..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl h-10 bg-muted/30 border-border/50" />
                        </div>
                    </div>
                    <TabsContent value={tab} className="mt-0">
                        {loading ? (
                            <Card className="border-border/50">
                                <CardContent className="py-24 text-center">
                                    <RefreshCw className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
                                    <p className="text-sm font-bold text-muted-foreground animate-pulse">Fetching latest bookings...</p>
                                </CardContent>
                            </Card>
                        ) : bookings.length === 0 ? (
                            <Card className="border-border/50"><CardContent className="py-16 text-center">
                                <CalendarRange className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                <p className="text-sm font-bold text-muted-foreground">No bookings found</p>
                            </CardContent></Card>
                        ) : (
                            <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                                {bookings.map((b, idx) => (
                                    <motion.div key={b._id || b.id || `${b.customerName || "booking"}-${idx}`} variants={item} onClick={() => setDetailModal(b)}>
                                        <Card className="border-border/50 shadow-none hover:border-primary/30 transition-all cursor-pointer">
                                            <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className="text-[10px] font-black text-muted-foreground">#{b.id}</span>
                                                        <Badge variant="outline" className={`text-[8px] font-black px-1.5 py-0 h-4 border-0 ${statusColors[b.status] || ""}`}>
                                                            {getStatusLabel(b.status)}
                                                        </Badge>
                                                        {b.status === "vendor_assigned" && (
                                                            <Badge variant="outline" className="text-[8px] font-black px-1.5 py-0 h-4 bg-blue-500/10 text-blue-600 border-blue-500/20">
                                                                Review Pricing
                                                            </Badge>
                                                        )}
                                                        {b.status === "admin_approved" && (
                                                            <Badge variant="outline" className="text-[8px] font-black px-1.5 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/20">
                                                                Waiting for User
                                                            </Badge>
                                                        )}
                                                        {b.status === "team_assigned" && (
                                                            <Badge variant="outline" className="text-[8px] font-black px-1.5 py-0 h-4 bg-cyan-500/10 text-cyan-600 border-cyan-500/20">
                                                                Review Team
                                                            </Badge>
                                                        )}
                                                        {b.status === "final_approved" && (
                                                            <Badge variant="outline" className="text-[8px] font-black px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                                                Ready for Service
                                                            </Badge>
                                                        )}
                                                        {b.serviceType && (
                                                            <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0 h-4 bg-purple-50 text-purple-600 border-purple-200">
                                                                <Tag className="h-2.5 w-2.5 mr-0.5" />{b.serviceType}
                                                            </Badge>
                                                        )}
                                                        {b.bookingType && (
                                                            <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0 h-4 bg-blue-50 text-blue-600 border-blue-200">
                                                                <Tag className="h-2.5 w-2.5 mr-0.5" />{b.bookingType}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold flex items-center gap-1.5">
                                                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                            {b.customerName || "Customer"}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-muted-foreground font-medium">
                                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{b.slot?.time} • {b.slot?.date}</span>
                                                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{b.address?.area}</span>
                                                    </div>

                                                    {/* Price & Discount Display */}
                                                    {(b.bookingType === "customized" || b.eventType) && b.totalAmount > 0 && (
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <span className="text-[10px] font-bold flex items-center gap-1">
                                                                <IndianRupee className="h-3 w-3 text-primary" /> Price: <span className="font-black text-primary">₹{b.totalAmount?.toLocaleString()}</span>
                                                            </span>
                                                            {b.discountPrice > 0 && (
                                                                <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                                                                    <Percent className="h-3 w-3" /> Discount: <span className="font-black">₹{b.discountPrice?.toLocaleString()}</span>
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] font-black text-emerald-600">
                                                                Final: ₹{((b.totalAmount || 0) - (b.discountPrice || 0)).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Team Display for Customized */}
                                                    {b.teamMembers && b.teamMembers.length > 0 && (
                                                        <div className="space-y-1 mt-2">
                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                                                <Users className="h-2.5 w-2.5" /> Team Assigned:
                                                            </p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {b.teamMembers.map((m, i) => (
                                                                    <span key={`${m.id || m.name || "member"}-${i}`} className="text-[8px] font-bold px-1.5 py-0.5 bg-muted rounded border border-border">
                                                                        {m.name} ({m.serviceType})
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(b.maintainProviderName || b.maintainProvider || b.maintainerProvider) && (
                                                        <p className="text-[9px] mt-1 text-emerald-600 font-bold flex items-center gap-1">
                                                            <Zap className="h-3 w-3" /> Lead Member: {b.maintainProviderName || providers.find(p => (p.id || p._id || p.phone) === (b.maintainProvider || b.maintainerProvider))?.name || (b.maintainProvider || b.maintainerProvider)}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg font-black text-primary">₹{b.totalAmount?.toLocaleString()}</span>
                                                    {/* Step 3: Admin reviews vendor pricing */}
                                                    {b.status === "vendor_assigned" ? (
                                                        <Button size="sm" className="h-8 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 rounded-lg gap-1"
                                                            onClick={() => {
                                                                setAdminReviewModal(b);
                                                                setReviewData({
                                                                    price: b.totalAmount || 0,
                                                                    discountPrice: b.discountPrice || 0
                                                                });
                                                            }}>
                                                            <CheckCircle className="h-3 w-3" /> Review Pricing
                                                        </Button>
                                                    ) : b.status === "team_assigned" ? (
                                                        /* Step 6: Admin reviews team and gives final approval */
                                                        <Button size="sm" className="h-8 text-[10px] font-bold bg-cyan-600 hover:bg-cyan-700 rounded-lg gap-1"
                                                            onClick={() => setAdminTeamReviewModal(b)}>
                                                            <CheckCircle className="h-3 w-3" /> Approve Team
                                                        </Button>
                                                    ) : (
                                                        /* Enable Assign toggle for any unassigned or pending booking in Admin panel */
                                                        ["incoming", "pending", "Pending", "unassigned", "Unassigned", "rejected"].includes(b.status) && (
                                                            <Button size="sm" className="h-8 text-[10px] font-bold bg-primary rounded-lg gap-1" onClick={(e) => { e.stopPropagation(); handleOpenAssignModal(b); }}>
                                                                <Users className="h-3 w-3" />{b.assignedProvider ? "Re-assign" : "Assign"}
                                                            </Button>
                                                        )
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                                
                                {/* Pagination Controls */}
                                {Math.ceil(total / limit) > 1 && (
                                    <div className="mt-8 pb-8">
                                        <Pagination>
                                            <PaginationContent>
                                                <PaginationItem>
                                                    <PaginationPrevious 
                                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                                    />
                                                </PaginationItem>
                                                
                                                {Array.from({ length: Math.ceil(total / limit) }, (_, i) => i + 1).map(p => {
                                                    if (p === 1 || p === Math.ceil(total / limit) || (p >= page - 1 && p <= page + 1)) {
                                                        return (
                                                            <PaginationItem key={p}>
                                                                <PaginationLink 
                                                                    isActive={page === p}
                                                                    onClick={() => setPage(p)}
                                                                    className="cursor-pointer"
                                                                >
                                                                    {p}
                                                                </PaginationLink>
                                                            </PaginationItem>
                                                        );
                                                    } else if (p === page - 2 || p === page + 2) {
                                                        return <PaginationItem key={p}><PaginationEllipsis /></PaginationItem>;
                                                    }
                                                    return null;
                                                })}

                                                <PaginationItem>
                                                    <PaginationNext 
                                                        onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
                                                        className={page === Math.ceil(total / limit) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                                    />
                                                </PaginationItem>
                                            </PaginationContent>
                                        </Pagination>
                                        <p className="text-[10px] text-center text-muted-foreground mt-4 font-bold uppercase tracking-widest">
                                            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} bookings
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </TabsContent>
                </Tabs>

                {/* ═══════ ADMIN PRICING REVIEW MODAL (Step 3) ═══════ */}
                {adminReviewModal && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAdminReviewModal(null)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="relative w-full max-w-lg bg-card rounded-[32px] border border-border p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-hide">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black italic uppercase tracking-tighter">Review Pricing</h3>
                                <button onClick={() => setAdminReviewModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center transition-colors"><X className="h-4 w-4" /></button>
                            </div>

                            <div className="bg-muted/40 rounded-3xl p-4 border border-border/50 space-y-3 shadow-inner relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Sparkles className="h-10 w-10" />
                                </div>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5"><Tag className="h-3 w-3" /> Booking Reference</p>
                                        <p className="text-xl font-black italic">#{adminReviewModal.id}</p>
                                    </div>
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                        {adminReviewModal.serviceType}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-4 relative z-10 pt-1">
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Customer Details</p>
                                        <p className="text-sm font-black">{adminReviewModal.customerName}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5"><Phone className="h-2.5 w-2.5 text-primary" /> {adminReviewModal.phone || "Not provided"}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Event Scale</p>
                                        <p className="text-sm font-black text-primary flex items-center gap-2 italic"><Users className="h-3.5 w-3.5" /> {adminReviewModal.noOfPeople || "N/A"} People</p>
                                        <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5"><Clock className="h-2.5 w-2.5" /> {adminReviewModal.slot?.time}</p>
                                    </div>
                                </div>

                                {(adminReviewModal.categoryName || adminReviewModal.selectedServices) && (
                                    <div className="grid grid-cols-1 gap-4 relative z-10 pt-2 border-t border-border/30">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5"><LayoutGrid className="h-3 w-3 text-primary" /> Service Category</p>
                                            <p className="text-sm font-black">{adminReviewModal.categoryName || adminReviewModal.serviceType}</p>
                                        </div>
                                        {adminReviewModal.selectedServices && (
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Requested Services</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {adminReviewModal.selectedServices.map((s, idx) => (
                                                        <Badge key={idx} variant="outline" className="bg-white border-primary/20 text-primary text-[10px] py-0.5 px-2">
                                                            {s.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {adminReviewModal.notes && (
                                    <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-3 border border-border/40 relative z-10 shadow-sm">
                                        <p className="text-[9px] font-black uppercase text-pink-600 mb-1 flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Extra Requirements:</p>
                                        <p className="text-[11px] font-medium leading-[1.5] text-foreground italic">"{adminReviewModal.notes}"</p>
                                    </div>
                                )}
                            </div>

                            {/* Price & Discount Price Fields (Admin can modify) */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-muted-foreground mb-1.5 block ml-1 flex items-center gap-1.5">
                                        <IndianRupee className="h-3 w-3 text-primary" /> Booking Price (₹)
                                    </label>
                                    <Input type="number" value={reviewData.price} onChange={e => setReviewData({ ...reviewData, price: e.target.value })} className="h-12 rounded-xl" />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase text-muted-foreground mb-1.5 block ml-1 flex items-center gap-1.5">
                                        <Percent className="h-3 w-3 text-green-600" /> Discount Price (₹)
                                    </label>
                                    <Input type="number" value={reviewData.discountPrice} onChange={e => setReviewData({ ...reviewData, discountPrice: e.target.value })} className="h-12 rounded-xl" />
                                </div>

                                {reviewData.price > 0 && (
                                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase text-emerald-700">Final Price for User</span>
                                            <span className="text-lg font-black text-emerald-700">₹{(parseFloat(reviewData.price) - (parseFloat(reviewData.discountPrice) || 0)).toLocaleString()}</span>
                                        </div>
                                        {parseFloat(reviewData.discountPrice) > 0 && (
                                            <p className="text-[9px] text-emerald-600 mt-1 font-bold">
                                                Original: ₹{parseFloat(reviewData.price).toLocaleString()} → Discount: ₹{parseFloat(reviewData.discountPrice).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={() => setAdminReviewModal(null)}>Cancel</Button>
                                <Button className="flex-[2] h-12 rounded-2xl font-black bg-black text-white hover:opacity-90 shadow-xl" onClick={handleAdminPriceApprove}>
                                    <CheckCircle className="h-4 w-4 mr-2" /> Approve & Forward to User
                                </Button>
                            </div>
                        </motion.div>
                    </div>,
                    document.body
                )}

                {/* ═══════ ADMIN TEAM REVIEW MODAL (Step 6) ═══════ */}
                {adminTeamReviewModal && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAdminTeamReviewModal(null)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="relative w-full max-w-lg bg-card rounded-[32px] border border-border p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-hide">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black italic uppercase tracking-tighter">Review Team Assignment</h3>
                                <button onClick={() => setAdminTeamReviewModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center transition-colors"><X className="h-4 w-4" /></button>
                            </div>

                            <div className="bg-muted/40 rounded-3xl p-4 border border-border/50 space-y-3 shadow-inner">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Booking</p>
                                        <p className="text-xl font-black italic">#{adminTeamReviewModal.id}</p>
                                    </div>
                                    <Badge variant="outline" className="bg-cyan-50 text-cyan-600 border-cyan-200 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                        Team Assigned
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-1">
                                    <div>
                                        <p className="text-[9px] font-black uppercase text-muted-foreground">Customer</p>
                                        <p className="text-sm font-black">{adminTeamReviewModal.customerName}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase text-muted-foreground">Price</p>
                                        <p className="text-sm font-black text-primary">₹{adminTeamReviewModal.totalAmount?.toLocaleString()}</p>
                                        {adminTeamReviewModal.discountPrice > 0 && (
                                            <p className="text-[9px] text-green-600 font-bold">Discount: ₹{adminTeamReviewModal.discountPrice}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Team Members Display */}
                            {adminTeamReviewModal.teamMembers && adminTeamReviewModal.teamMembers.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-1.5">
                                        <Users className="h-3 w-3" /> Assigned Team ({adminTeamReviewModal.teamMembers.length} members)
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {adminTeamReviewModal.teamMembers.map((m, i) => (
                                            <div key={i} className={`p-2 rounded-xl text-[10px] border-2 ${m.id === adminTeamReviewModal.maintainProvider ? "border-primary bg-primary/5" : "border-border bg-muted/20"}`}>
                                                <p className="font-bold truncate">{m.name}</p>
                                                <p className="text-[8px] opacity-70">{m.serviceType}</p>
                                                {m.id === adminTeamReviewModal.maintainProvider && (
                                                    <Badge className="text-[7px] mt-1 h-3.5 px-1 bg-primary/10 text-primary border-0">Lead</Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Lead Member */}
                            {adminTeamReviewModal.maintainProvider && (
                                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                    <p className="text-[10px] font-black uppercase text-emerald-700 mb-1">Lead Member</p>
                                    <p className="text-sm font-black text-emerald-700">
                                        {providers.find(p => (p.id || p._id || p.phone) === adminTeamReviewModal.maintainProvider)?.name || adminTeamReviewModal.maintainProvider}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={() => setAdminTeamReviewModal(null)}>Cancel</Button>
                                <Button className="flex-[2] h-12 rounded-2xl font-black bg-black text-white hover:opacity-90 shadow-xl" onClick={handleAdminFinalApprove}>
                                    <CheckCircle className="h-4 w-4 mr-2" /> Final Approve
                                </Button>
                            </div>
                        </motion.div>
                    </div>,
                    document.body
                )}

                {/* Assign SP Modal (Normal bookings) */}
                {assignModal && createPortal(
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
                            className="relative w-full max-w-lg md:w-[480px] bg-card rounded-[32px] border border-border p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black tracking-tight">Assign Service Provider</h3>
                                <button onClick={() => setAssignModal(null)} className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
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
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Service Category</p>
                                        <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20 uppercase tracking-wider font-black px-1.5 py-0 h-5">
                                            {assignModal.serviceType || "General"}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Services Needed</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(assignModal.services || assignModal.items || []).map((s, i) => (
                                            <span key={i} className="text-[9px] font-black px-2 py-0.5 bg-card border border-border/50 text-foreground rounded-lg shadow-sm">
                                                {s.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {assignModal.notes && (
                                    <div className="p-3 bg-white/50 rounded-xl border border-border/40">
                                        <p className="text-[9px] font-black uppercase text-pink-600 mb-1 flex items-center gap-1"><MessageSquare className="h-2.5 w-2.5" /> Enquiry Notes:</p>
                                        <p className="text-[11px] font-semibold text-foreground italic leading-tight">"{assignModal.notes}"</p>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Select Professional</label>
                                <Select value={selectedSP} onValueChange={setSelectedSP}>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20 transition-all">
                                        <SelectValue placeholder="Pick a service provider" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {loadingProviders ? (
                                            <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                                <RefreshCw className="h-3 w-3 animate-spin" /> Loading available providers...
                                            </div>
                                        ) : availableProviders.length > 0 ? availableProviders.map(p => (
                                            <SelectItem key={p._id || p.id || p.phone} value={String(p._id || p.id || p.phone)} className="rounded-lg">
                                                <div className="flex flex-col py-0.5">
                                                    <span className="font-bold text-sm">{p.name}</span>
                                                    <span className="text-[10px] text-muted-foreground">{p.phone} {p.specialties ? `• ${p.specialties.join(", ")}` : ""}</span>
                                                </div>
                                            </SelectItem>
                                        )) : (
                                            <div className="p-4 text-center text-xs text-red-500 font-bold">
                                                No providers available for this slot
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" className="flex-1 h-12 rounded-2xl font-bold border-border/50" onClick={() => setAssignModal(null)}>Cancel</Button>
                                <Button className="flex-2 h-12 rounded-2xl font-bold gap-2 bg-black text-white hover:bg-black/90 shadow-xl shadow-black/10" onClick={handleAssign} disabled={!selectedSP || updating}>
                                    {updating ? "Assigning..." : <><CheckCircle className="h-5 w-5" />Confirm Assignment</>}
                                </Button>
                            </div>
                        </motion.div>
                    </div>,
                    document.body
                )}

                {/* Office Hours Settings Modal */}
                {showSettings && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-xl md:w-[540px] bg-card rounded-[40px] border border-border p-8 lg:p-10 shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black flex items-center gap-3 tracking-tight"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Settings2 className="h-5 w-5 text-primary" /></div> Office Hours</h3>
                                <button onClick={() => setShowSettings(false)} className="w-10 h-10 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"><X className="h-5 w-5" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                    <p className="text-xs text-primary font-bold leading-relaxed">
                                        Set your business hours. Bookings outside these hours will queue notifications for providers until the next business day starts.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 block">Starts At</label>
                                        <div className="relative group">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <input type="time" value={tempSettings.startTime} onChange={e => setTempSettings({ ...tempSettings, startTime: e.target.value })}
                                                className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border/50 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 block">Closes At</label>
                                        <div className="relative group">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <input type="time" value={tempSettings.endTime} onChange={e => setTempSettings({ ...tempSettings, endTime: e.target.value })}
                                                className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border/50 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6 pt-4 border-t border-border/50">
                                    <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                        <p className="text-xs text-purple-700 font-bold leading-relaxed">
                                            Provider Availability Time: These hours define the default active slots for service providers on their schedule.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 block">Provider Start At</label>
                                            <div className="relative group">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                                <input type="time" value={tempSettings.providerStartTime || "09:00"} onChange={e => setTempSettings({ ...tempSettings, providerStartTime: e.target.value })}
                                                    className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border/50 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 block">Provider End At</label>
                                            <div className="relative group">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                                <input type="time" value={tempSettings.providerEndTime || "17:00"} onChange={e => setTempSettings({ ...tempSettings, providerEndTime: e.target.value })}
                                                    className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border/50 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 block">Buffer Time (Minutes)</label>
                                    <div className="relative group">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input type="number" value={tempSettings.bufferMinutes || 30} onChange={e => setTempSettings({ ...tempSettings, bufferMinutes: parseInt(e.target.value) })}
                                            className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border/50 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all" />
                                    </div>
                                    <p className="text-[9px] text-muted-foreground ml-1">Extra time added after each service for travel/rest.</p>
                                </div>

                                <div className="flex items-center justify-between bg-muted/20 border border-border/30 rounded-3xl p-5 hover:bg-muted/30 transition-colors">
                                    <div className="flex-1 pr-4">
                                        <p className="text-sm font-black tracking-tight">Auto-Assignment</p>
                                        <p className="text-[11px] text-muted-foreground mt-1 font-medium leading-relaxed">Automatically assign new bookings to the nearest available provider based on specialty.</p>
                                    </div>
                                    <button onClick={() => setTempSettings({ ...tempSettings, autoAssign: !tempSettings.autoAssign })}
                                        className={`w-14 h-8 rounded-full transition-all duration-300 relative p-1 ${tempSettings.autoAssign ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-muted-foreground/30'}`}>
                                        <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${tempSettings.autoAssign ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="space-y-2 pb-4">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 block">Off-Hours Message</label>
                                    <textarea rows={2} value={tempSettings.notificationMessage || ""} onChange={e => setTempSettings({ ...tempSettings, notificationMessage: e.target.value })}
                                        className="w-full px-5 py-4 bg-muted/30 border border-border/50 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all resize-none"
                                        placeholder="Message shown to customers..." />
                                </div>
                            </div>

                            <div className="pt-6">
                                <Button 
                                    disabled={updating}
                                    className="w-full h-14 rounded-2xl font-black text-sm tracking-widest uppercase bg-black text-white hover:bg-black/90 shadow-2xl shadow-black/10 transition-all hover:scale-[1.02] active:scale-98" 
                                    onClick={handleSaveSettings}
                                >
                                    {updating ? "Updating..." : "Update Business Settings"}
                                </Button>
                            </div>
                        </motion.div>
                    </div>,
                    document.body
                )}

                {/* ═══════ BOOKING DETAIL MODAL ═══════ */}
                {detailModal && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailModal(null)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="relative w-full max-w-2xl bg-card rounded-[32px] border border-border p-6 md:p-8 space-y-6 shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-hide">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Booking Details</h3>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ID: #{detailModal.id}</p>
                                </div>
                                <button onClick={() => setDetailModal(null)} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center transition-colors"><X className="h-5 w-5" /></button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Side: Customer & Service Info */}
                                <div className="space-y-6">
                                    <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                        <h4 className="text-[10px] font-black uppercase text-secondary-foreground/60 tracking-widest mb-3 flex items-center gap-2"><User className="h-3.5 w-3.5" /> Customer Info</h4>
                                        <div className="space-y-2">
                                            <p className="text-lg font-black">{detailModal.customerName}</p>
                                            {detailModal.phone && (
                                                <p className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                                                    <Phone className="h-4 w-4 text-primary" /> {detailModal.phone}
                                                </p>
                                            )}
                                            <div className="pt-2 border-t border-border/30 mt-2">
                                                <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Service Address</p>
                                                {detailModal.address?.fullAddress && (
                                                    <p className="text-xs font-bold leading-relaxed">{detailModal.address.fullAddress}</p>
                                                )}
                                                <p className="text-[10px] font-bold text-primary mt-1">
                                                    {detailModal.address?.houseNo && <span>{detailModal.address.houseNo}, </span>}
                                                    {detailModal.address?.landmark && <span>{detailModal.address.landmark}, </span>}
                                                    {detailModal.address?.area}, {detailModal.address?.city}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                        <h4 className="text-[10px] font-black uppercase text-secondary-foreground/60 tracking-widest mb-3 flex items-center gap-2"><Zap className="h-3.5 w-3.5" /> Service Details</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-muted-foreground">Status</span>
                                                <Badge variant="outline" className={`text-[10px] font-black px-2 py-0.5 border-0 ${statusColors[detailModal.status] || ""}`}>
                                                    {getStatusLabel(detailModal.status)}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-muted-foreground">Category</span>
                                                <span className="text-xs font-black">{detailModal.serviceType}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-muted-foreground">Type</span>
                                                <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 text-blue-600 border-blue-200">{detailModal.bookingType}</Badge>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-muted-foreground">Scheduled Time</span>
                                                <span className="text-xs font-black flex items-center gap-2">
                                                    <Clock className="h-3.5 w-3.5 text-primary" /> {detailModal.slot?.time}, {detailModal.slot?.date}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Cart, Pricing & Assignment */}
                                <div className="space-y-6">
                                    <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
                                        <h4 className="text-[10px] font-black uppercase text-primary tracking-widest mb-3 flex items-center gap-2"><LayoutGrid className="h-3.5 w-3.5" /> Bill Summary</h4>
                                        <div className="space-y-2">
                                            {detailModal.items?.map((it, i) => (
                                                <div key={i} className="flex justify-between text-xs py-1 border-b border-primary/5 last:border-0">
                                                    <span className="font-bold">{it.serviceName} <span className="text-muted-foreground px-1">x{it.quantity}</span></span>
                                                    <span className="font-black">₹{it.price * it.quantity}</span>
                                                </div>
                                            ))}
                                            <div className="pt-2 mt-2 border-t border-primary/20 space-y-1">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground font-bold">Total Amount</span>
                                                    <span className="font-bold">₹{detailModal.totalAmount}</span>
                                                </div>
                                                {detailModal.discountPrice > 0 && (
                                                    <div className="flex justify-between text-xs text-green-600">
                                                        <span className="font-bold">Discount</span>
                                                        <span className="font-bold">-₹{detailModal.discountPrice}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-base pt-1 font-black text-primary">
                                                    <span>Payable</span>
                                                    <span>₹{(detailModal.totalAmount - (detailModal.discountPrice || 0)).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                        <h4 className="text-[10px] font-black uppercase text-secondary-foreground/60 tracking-widest mb-3 flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Professional Info</h4>
                                        <div className="space-y-4">
                                            {(detailModal.assignedProviderName || detailModal.assignedProvider) ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary">
                                                        {(detailModal.assignedProviderName || providers.find(p => (p.id || p._id || p.phone) === detailModal.assignedProvider)?.name)?.charAt(0) || "P"}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black">{detailModal.assignedProviderName || providers.find(p => (p.id || p._id || p.phone) === detailModal.assignedProvider)?.name || "Assigned Provider"}</p>
                                                        <p className="text-[10px] font-bold text-muted-foreground">{detailModal.assignedProviderPhone || detailModal.assignedProvider}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-2">
                                                    <p className="text-xs font-bold text-muted-foreground italic mb-3">No professional assigned yet</p>
                                                </div>
                                            )}
                                            
                                            {["incoming", "pending", "unassigned", "rejected"].includes(detailModal.status?.toLowerCase()) && (
                                                <Button className="w-full h-10 rounded-xl font-bold bg-primary" onClick={() => { setAssignModal(detailModal); setDetailModal(null); }}>
                                                    {detailModal.assignedProvider ? "Change Provider" : "Assign Now"}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {detailModal.notes && (
                                <div className="bg-pink-50 rounded-2xl p-4 border border-pink-100">
                                    <h4 className="text-[10px] font-black uppercase text-pink-700 tracking-widest mb-1 flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Customer Notes</h4>
                                    <p className="text-xs font-medium text-pink-900 leading-relaxed italic">"{detailModal.notes}"</p>
                                </div>
                            )}

                            {/* Service Photos Section */}
                            {(detailModal.beforeImages?.length > 0 || detailModal.afterImages?.length > 0) && (
                                <div className="bg-muted/20 rounded-2xl p-5 border border-border/50 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black uppercase text-secondary-foreground/60 tracking-widest flex items-center gap-2">
                                            <Camera className="h-3.5 w-3.5" /> Service Documentation
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${detailModal.imagesApproved ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                                                {detailModal.imagesApproved ? "Approved" : "Pending Approval"}
                                            </span>
                                            <Button 
                                                size="sm" 
                                                className={`h-7 text-[9px] font-black uppercase rounded-lg ${detailModal.imagesApproved ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                                                onClick={(e) => { e.stopPropagation(); handleApproveImages(detailModal._id || detailModal.id, !detailModal.imagesApproved); }}
                                                disabled={updating}
                                            >
                                                {detailModal.imagesApproved ? "Revoke Approval" : "Approve Photos"}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Before Images */}
                                        {detailModal.beforeImages?.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Before Service</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {detailModal.beforeImages.map((img, i) => (
                                                        <div key={i} className="group relative w-20 h-20 rounded-xl overflow-hidden border border-border shadow-sm cursor-zoom-in" onClick={() => window.open(img, '_blank')}>
                                                            <img src={img} alt="Before" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Search className="h-4 w-4 text-white" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* After Images */}
                                        {detailModal.afterImages?.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-1">After Service</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {detailModal.afterImages.map((img, i) => (
                                                        <div key={i} className="group relative w-20 h-20 rounded-xl overflow-hidden border border-border shadow-sm cursor-zoom-in" onClick={() => window.open(img, '_blank')}>
                                                            <img src={img} alt="After" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Search className="h-4 w-4 text-white" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Product Images (if any) */}
                                    {detailModal.productImages?.length > 0 && (
                                        <div className="pt-2 border-t border-border/30">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-1 mb-2">Products Used</p>
                                            <div className="flex flex-wrap gap-2">
                                                {detailModal.productImages.map((img, i) => (
                                                    <div key={i} className="group relative w-16 h-16 rounded-xl overflow-hidden border border-border shadow-sm cursor-zoom-in" onClick={() => window.open(img, '_blank')}>
                                                        <img src={img} alt="Product" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-2">
                                <Button variant="outline" className="w-full h-12 rounded-2xl font-bold" onClick={() => setDetailModal(null)}>Close Window</Button>
                            </div>
                        </motion.div>
                    </div>,
                    document.body
                )}
            </div>
        );
    }
