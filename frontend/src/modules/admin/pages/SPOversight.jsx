import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, CheckCircle, XCircle, Ban, UserCheck, Phone, RefreshCw, Star, TrendingUp, Clock, AlertCircle, Award, FileText, Shield, Settings, Eye } from "lucide-react";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/user/components/ui/tabs";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const statusColors = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    pending_vendor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    pending_admin: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    approved: "bg-green-500/15 text-green-400 border-green-500/30",
    rejected: "bg-red-500/15 text-red-400 border-red-500/30",
    blocked: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function SPOversight() {
    const { getAllServiceProviders, updateSPStatus, approveProviderZones, rejectProviderZones } = useAdminAuth();
    const [providers, setProviders] = useState([]);
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("all");
    const [categoryRequests, setCategoryRequests] = useState([]);
    const [selectedSP, setSelectedSP] = useState(null);
    const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);

    const [feedback, setFeedback] = useState([]);

    const load = async () => {
        try {
            const items = await getAllServiceProviders();
            setProviders(Array.isArray(items) ? items : []);
        } catch {}
        setFeedback(JSON.parse(localStorage.getItem("muskan-feedback") || "[]"));
        setCategoryRequests(JSON.parse(localStorage.getItem("muskan-category-requests") || "[]"));
    };
    useEffect(() => { load(); }, []);

    const getSPRating = (nameOrId) => {
        const spFeedback = feedback.filter(f => (f.providerName === nameOrId || f.assignedProvider === nameOrId || f.providerId === nameOrId) && f.type === "customer_to_provider");
        if (spFeedback.length === 0) return "0.0";
        const sum = spFeedback.reduce((a, b) => a + Number(b.rating || 0), 0);
        return (sum / spFeedback.length).toFixed(1);
    };

    const getSPStats = (sp) => {
        const bookings = JSON.parse(localStorage.getItem("muskan-bookings") || "[]");
        const id = sp._id || sp.id;
        const name = sp.name;
        
        const spBookings = bookings.filter(b => b.assignedProvider === id || b.assignedProvider === name || b.providerName === name);
        const total = spBookings.length;
        
        if (total === 0) return { bookings: 0, cancelled: "0%", missed: 0, revenue: "0", acceptTime: "N/A" };
        
        const cancelled = spBookings.filter(b => b.status === "cancelled" || b.status === "rejected").length;
        const completed = spBookings.filter(b => b.status === "completed");
        const revenue = completed.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
        
        return {
            bookings: total,
            cancelled: `${Math.round((cancelled / total) * 100)}%`,
            missed: 0, // Missed not explicitly tracked in current status set
            revenue: revenue.toLocaleString(),
            acceptTime: "5 min" // Placeholder or default for active providers
        };
    };

    const filtered = providers.filter(sp => {
        const ms = sp.name?.toLowerCase().includes(search.toLowerCase()) || sp.phone?.includes(search);
        if (tab === "all") return ms;
        if (tab === "pending") return ms && (sp.approvalStatus === "pending" || sp.approvalStatus === "pending_vendor" || sp.approvalStatus === "pending_admin");
        if (tab === "approved") return ms && sp.approvalStatus === "approved";
        if (tab === "blocked") return ms && (sp.approvalStatus === "blocked" || sp.approvalStatus === "rejected");
        return ms;
    });

    const handleAction = async (id, status) => {
        try {
            await updateSPStatus(id, status);
            toast.success(`Status updated to ${status}`);
            load();
            if (selectedSP?._id === id || selectedSP?.id === id) {
                setSelectedSP(prev => ({ ...prev, approvalStatus: status }));
            }
        } catch {
            toast.error("Status update failed");
        }
    };

    const handleZoneAction = async (id, action) => {
        try {
            if (action === "approve") await approveProviderZones(id);
            else await rejectProviderZones(id);
            toast.success(`Zones ${action}d successfully`);
            load();
            if (selectedSP?._id === id || selectedSP?.id === id) {
                const updated = await getAllServiceProviders();
                const found = updated.find(u => u._id === id || u.id === id);
                if (found) setSelectedSP(found);
            }
        } catch {
            toast.error(`Zone ${action} failed`);
        }
    };

    const handleCategoryAction = (id, status) => {
        const requests = JSON.parse(localStorage.getItem("muskan-category-requests") || "[]");
        const updated = requests.map(req => req.id === id ? { ...req, status } : req);
        localStorage.setItem("muskan-category-requests", JSON.stringify(updated));
        load();
    };

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> Service Provider Oversight</h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Global view of all service providers</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={load} variant="outline" className="gap-2 rounded-xl font-bold"><RefreshCw className="h-4 w-4" /> Refresh</Button>
                    <Button onClick={() => setIsPerformanceModalOpen(true)} className="gap-2 rounded-xl font-bold bg-primary"><Settings className="h-4 w-4" /> Performance Criteria</Button>
                </div>
            </motion.div>

            <Tabs value={tab} onValueChange={setTab}>
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                    <TabsList className="bg-muted/30 rounded-xl p-1">
                        <TabsTrigger value="all" className="rounded-lg text-xs font-bold">All ({providers.length})</TabsTrigger>
                        <TabsTrigger value="pending" className="rounded-lg text-xs font-bold">Pending ({providers.filter(s => s.approvalStatus === "pending" || s.approvalStatus === "pending_vendor" || s.approvalStatus === "pending_admin").length})</TabsTrigger>
                        <TabsTrigger value="approved" className="rounded-lg text-xs font-bold">Active</TabsTrigger>
                        <TabsTrigger value="category-requests" className="rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600">Cat. Requests ({categoryRequests.filter(r => r.status === 'pending').length})</TabsTrigger>
                        <TabsTrigger value="blocked" className="rounded-lg text-xs font-bold">Blocked</TabsTrigger>
                    </TabsList>
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl h-10 bg-muted/30 border-border/50" />
                    </div>
                </div>
                <TabsContent value={tab} className="mt-0">
                    {filtered.length === 0 ? (
                        <Card className="border-border/50"><CardContent className="py-16 text-center">
                            <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-sm font-bold text-muted-foreground">No service providers found</p>
                        </CardContent></Card>
                    ) : (
                        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                            {filtered.map(sp => (
                                <motion.div key={sp._id || sp.id || sp.phone} variants={item}>
                                    <Card className="border-border/50 shadow-none hover:border-primary/30 transition-all">
                                        <CardContent className="p-4 flex flex-col gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-sm font-black text-primary">{sp.name?.charAt(0) || "?"}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm font-bold truncate">{sp.name || "Unknown"}</h3>
                                                        {sp.approvalStatus === "approved" && (
                                                            <Badge variant="outline" className={`text-[8px] font-black px-1.5 py-0 h-4 border ${sp.name?.length > 10 ? 'bg-amber-100 text-amber-700 border-amber-300' : sp.name?.length > 6 ? 'bg-slate-200 text-slate-700 border-slate-400' : 'bg-orange-100/50 text-orange-700 border-orange-300'}`}>
                                                                <Award className="h-2.5 w-2.5 mr-0.5" />
                                                                {sp.name?.length > 10 ? 'Gold' : sp.name?.length > 6 ? 'Silver' : 'Bronze'}
                                                            </Badge>
                                                        )}
                                                        <Badge variant="outline" className={`text-[8px] font-black px-1.5 py-0 h-4 ${statusColors[sp.approvalStatus] || statusColors.pending}`}>
                                                            {sp.approvalStatus || "pending"}
                                                        </Badge>
                                                    </div>
                                                    <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{sp.phone}</span>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 flex-shrink-0" 
                                                    onClick={(e) => { e.stopPropagation(); setSelectedSP(sp); }}
                                                    title="View Details"
                                                >
                                                    <Eye className="h-4 w-4 text-primary" />
                                                </Button>
                                                <div className="flex gap-1.5">
                                                    {(sp.approvalStatus === "pending" || sp.approvalStatus === "pending_vendor") && (
                                                        <Badge variant="outline" className="text-[10px] font-bold bg-amber-50 text-amber-600 border-amber-200 h-7 flex items-center px-2">
                                                            Awaiting Vendor
                                                        </Badge>
                                                    )}
                                                    {sp.approvalStatus === "pending_admin" && (
                                                        <>
                                                            <Button size="sm" className="h-7 text-[10px] font-bold bg-green-600 hover:bg-green-700 rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleAction(sp._id || sp.id, "approved"); }}><CheckCircle className="h-3 w-3 mr-1" />Final Approve</Button>
                                                            <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold border-red-500/30 text-red-400 rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleAction(sp._id || sp.id, "rejected"); }}><XCircle className="h-3 w-3 mr-1" />Reject</Button>
                                                        </>
                                                    )}
                                                    {sp.approvalStatus === "approved" && (
                                                        <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold border-red-500/30 text-red-400 rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleAction(sp._id || sp.id, "blocked"); }}><Ban className="h-3 w-3 mr-1" />Block</Button>
                                                    )}
                                                    {(sp.approvalStatus === "blocked" || sp.approvalStatus === "rejected") && (
                                                        <Button size="sm" className="h-7 text-[10px] font-bold bg-primary rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleAction(sp._id || sp.id, "approved"); }}><UserCheck className="h-3 w-3 mr-1" />Unblock</Button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {(sp.zones || []).map(z => (
                                                        <Badge key={z} variant="secondary" className="text-[9px] font-bold bg-muted/50 text-muted-foreground border-none">
                                                            {z}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                {sp.pendingZones?.length > 0 && (
                                                    <div className="mt-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50 flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">New Zone Request</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {sp.pendingZones.map(z => (
                                                                    <Badge key={z} className="bg-white text-amber-600 border-amber-200 text-[9px] font-bold">
                                                                        + {z}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1 ml-4">
                                                            <Button size="sm" className="h-6 text-[9px] font-black bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleZoneAction(sp._id || sp.id, "approve"); }}>Approve</Button>
                                                            <Button size="sm" variant="ghost" className="h-6 text-[9px] font-black text-amber-700 hover:bg-amber-100 rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleZoneAction(sp._id || sp.id, "reject"); }}>Reject</Button>
                                                        </div>
                                                    </div>
                                                )}

                                            {/* Advanced Stats (For View) */}
                                            {sp.approvalStatus === "approved" && (() => {
                                                const stats = getSPStats(sp);
                                                return (
                                                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 pt-3 border-t border-border/50">
                                                        <div className="bg-muted/30 p-2 rounded-xl">
                                                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3" /> Rating</p>
                                                            <p className="text-sm font-black mt-0.5 text-amber-500">{getSPRating(sp.name || sp._id || sp.id)}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-2 rounded-xl">
                                                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Bookings</p>
                                                            <p className="text-sm font-black mt-0.5 text-blue-500">{stats.bookings}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-2 rounded-xl">
                                                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><XCircle className="h-3 w-3" /> Cancelled</p>
                                                            <p className="text-sm font-black mt-0.5 text-red-500">{stats.cancelled}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-2 rounded-xl">
                                                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Missed</p>
                                                            <p className="text-sm font-black mt-0.5 text-amber-500">{stats.missed}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-2 rounded-xl">
                                                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Accept. Time</p>
                                                            <p className="text-sm font-black mt-0.5">{stats.acceptTime}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-2 rounded-xl">
                                                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Revenue</p>
                                                            <p className="text-sm font-black mt-0.5 text-green-600">₹{stats.revenue}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </TabsContent>

                <TabsContent value="category-requests" className="mt-0">
                    {categoryRequests.length === 0 ? (
                        <Card className="border-border/50"><CardContent className="py-16 text-center">
                            <RefreshCw className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-sm font-bold text-muted-foreground">No category requests found</p>
                        </CardContent></Card>
                    ) : (
                        <div className="space-y-2">
                            {categoryRequests.map(req => (
                                <Card key={req.id} className="border-border/50 shadow-none hover:border-primary/30 transition-all">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                                <Award className="h-5 w-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-bold">{req.providerName}</h3>
                                                    <Badge className={req.status === 'pending' ? 'bg-amber-100 text-amber-700' : req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                                        {req.status.toUpperCase()}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">Current: <span className="font-bold text-foreground">{req.currentCategory}</span> • Requesting <span className="font-bold text-primary">New Category Access</span></p>
                                                <p className="text-[10px] text-muted-foreground font-medium mt-1">Ref ID: {req.id} • {new Date(req.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {req.status === 'pending' ? (
                                                <>
                                                    <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 font-bold" onClick={() => handleCategoryAction(req.id, 'approved')}>Approve</Button>
                                                    <Button size="sm" variant="outline" className="h-8 border-red-500/30 text-red-400 font-bold" onClick={() => handleCategoryAction(req.id, 'rejected')}>Reject</Button>
                                                </>
                                            ) : (
                                                <Button size="sm" variant="ghost" className="h-8 text-xs font-bold" disabled>Handled</Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* SP Detail Modal */}
            <AnimatePresence>
                {selectedSP && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedSP(null)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-40%" }}
                            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                            exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-40%" }}
                            className="fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] sm:w-[500px] z-50 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[85vh] overflow-y-auto"
                        >
                            <div className="p-6 space-y-5">
                                {/* Header */}
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-green-500 flex items-center justify-center text-white text-2xl font-black">
                                        {selectedSP.name?.charAt(0) || "?"}
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black">{selectedSP.name || "Unknown"}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className={`text-[9px] font-black ${statusColors[selectedSP.approvalStatus] || statusColors.pending}`}>
                                                {selectedSP.approvalStatus || "pending"}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground font-medium">ID: {selectedSP._id || selectedSP.id}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Contact */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Phone</p>
                                        <p className="text-sm font-bold mt-1">{selectedSP.phone}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Email</p>
                                        <p className="text-sm font-bold mt-1">{selectedSP.email || "N/A"}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Experience</p>
                                        <p className="text-sm font-bold mt-1">{selectedSP.experience || "N/A"}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Hub Location</p>
                                        <p className="text-sm font-bold mt-1">{selectedSP.city || "N/A"} {selectedSP.zone ? `(${selectedSP.zone})` : ""}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Joined</p>
                                        <p className="text-sm font-bold mt-1">{selectedSP.createdAt ? new Date(selectedSP.createdAt).toLocaleDateString() : "N/A"}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3 col-span-2">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Full Address</p>
                                        <p className="text-sm font-bold mt-1">
                                            {[selectedSP.address, selectedSP.city].filter(Boolean).join(", ") || "N/A"}
                                        </p>
                                    </div>
                                </div>

                                {/* Professional Details */}
                                <div>
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Professional Details</h3>
                                    <div className="space-y-4">
                                        <div className="bg-muted/30 rounded-xl p-3">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Categories & Specializations</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedSP.documents?.primaryCategory?.length > 0 ? (
                                                    selectedSP.documents.primaryCategory.map(cat => (
                                                        <Badge key={cat} variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary border-none">
                                                            {cat}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">No primary categories</span>
                                                )}
                                                {selectedSP.documents?.specializations?.length > 0 && (
                                                    selectedSP.documents.specializations.map(spec => (
                                                        <Badge key={spec} variant="outline" className="text-[10px] font-bold border-primary/30 text-primary/70">
                                                            {spec}
                                                        </Badge>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                        
                                        {selectedSP.documents?.certifications?.length > 0 && (
                                            <div className="bg-muted/30 rounded-xl p-3">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Professional Certificates</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {selectedSP.documents.certifications.map((cert, idx) => (
                                                        <div key={idx} className="aspect-square rounded-lg bg-muted overflow-hidden border border-border/50 relative group">
                                                            <img src={cert} alt={`Cert ${idx}`} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Button size="sm" variant="secondary" className="h-7 text-[10px] font-bold" onClick={() => window.open(cert, '_blank')}>View Large</Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Documents */}
                                <div>
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Documents Verification</h3>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        {[
                                            { label: "Aadhar Front", key: "aadharFront" },
                                            { label: "Aadhar Back", key: "aadharBack" },
                                            { label: "PAN Card", key: "panCard" },
                                            { label: "Profile Photo", key: "profilePhoto", isProfile: true },
                                        ].map(doc => (
                                            <div key={doc.key} className="space-y-1">
                                                <p className="text-[10px] font-bold text-muted-foreground">{doc.label}</p>
                                                <div className="aspect-video rounded-lg bg-muted overflow-hidden border border-border/50 relative group">
                                                    {doc.isProfile ? (
                                                        selectedSP.profilePhoto ? (
                                                            <img src={selectedSP.profilePhoto} alt={doc.label} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30"><Users className="h-6 w-6" /></div>
                                                        )
                                                    ) : (
                                                        selectedSP.documents?.[doc.key] ? (
                                                            <img src={selectedSP.documents[doc.key]} alt={doc.label} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30"><FileText className="h-6 w-6" /></div>
                                                        )
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Button size="sm" variant="secondary" className="h-7 text-[10px] font-bold" onClick={() => window.open(doc.isProfile ? selectedSP.profilePhoto : selectedSP.documents?.[doc.key], '_blank')}>View Large</Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        {[
                                            { label: "Bank Name", key: "bankName" },
                                            { label: "Account No", key: "accountNumber" },
                                            { label: "IFSC Code", key: "ifscCode" },
                                            { label: "UPI ID", key: "upiId" },
                                        ].map(doc => (
                                            <div key={doc.key} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                                <span className="text-[12px] font-semibold flex items-center gap-2">
                                                    <Shield className="h-3.5 w-3.5 text-muted-foreground" /> {doc.label}
                                                </span>
                                                <span className="text-[12px] font-bold">
                                                    {selectedSP.documents?.[doc.key] || "N/A"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-2">
                                    {selectedSP.approvalStatus === "pending_admin" && (
                                        <>
                                            <Button className="flex-1 h-11 bg-green-600 hover:bg-green-700 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedSP._id || selectedSP.id, "approved")}>
                                                <CheckCircle className="h-4 w-4" /> Final Approve
                                            </Button>
                                            <Button variant="outline" className="flex-1 h-11 border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedSP._id || selectedSP.id, "rejected")}>
                                                <XCircle className="h-4 w-4" /> Reject
                                            </Button>
                                        </>
                                    )}
                                    {selectedSP.approvalStatus === "approved" && (
                                        <Button variant="outline" className="flex-1 h-11 border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedSP._id || selectedSP.id, "blocked")}>
                                            <Ban className="h-4 w-4" /> Block SP
                                        </Button>
                                    )}
                                    {(selectedSP.approvalStatus === "blocked" || selectedSP.approvalStatus === "rejected") && (
                                        <Button className="flex-1 h-11 bg-primary hover:bg-primary/90 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedSP._id || selectedSP.id, "approved")}>
                                            <UserCheck className="h-4 w-4" /> Unblock & Approve
                                        </Button>
                                    )}
                                    <Button variant="outline" className="h-11 rounded-xl font-bold" onClick={() => setSelectedSP(null)}>Close</Button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <PerformanceCriteriaModal isOpen={isPerformanceModalOpen} onClose={() => setIsPerformanceModalOpen(false)} />
        </div>
    );
}

const PerformanceCriteriaModal = ({ isOpen, onClose }) => {
    const { getPerformanceCriteria, updatePerformanceCriteria } = useAdminAuth();
    const [settings, setSettings] = useState({ minWeeklyHours: 20, minRatingThreshold: 4.5, maxCancellationsThreshold: 5 });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            getPerformanceCriteria()
                .then(data => setSettings(data))
                .catch(() => toast.error("Failed to load criteria"))
                .finally(() => setLoading(false));
        }
    }, [isOpen, getPerformanceCriteria]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await updatePerformanceCriteria(settings);
            toast.success("Performance criteria updated");
            onClose();
        } catch {
            toast.error("Failed to save criteria");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card rounded-2xl shadow-2xl border border-border w-[400px]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-border">
                    <h2 className="text-lg font-black flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Performance Criteria</h2>
                    <p className="text-sm text-muted-foreground mt-1">Set thresholds for provider performance.</p>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-sm font-bold">Minimum Weekly Hours</label>
                        <Input type="number" value={settings.minWeeklyHours} onChange={(e) => setSettings({ ...settings, minWeeklyHours: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                        <label className="text-sm font-bold">Minimum Rating Threshold</label>
                        <Input type="number" step="0.1" value={settings.minRatingThreshold} onChange={(e) => setSettings({ ...settings, minRatingThreshold: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                        <label className="text-sm font-bold">Maximum Cancellations Threshold</label>
                        <Input type="number" value={settings.maxCancellationsThreshold} onChange={(e) => setSettings({ ...settings, maxCancellationsThreshold: e.target.value })} className="mt-1" />
                    </div>
                </div>
                <div className="p-4 bg-muted/50 border-t border-border flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} className="bg-primary">Save Changes</Button>
                </div>
            </motion.div>
        </motion.div>
    );
};
