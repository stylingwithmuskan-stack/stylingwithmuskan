import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, Search, CheckCircle, XCircle, Ban, Eye, Shield, UserCheck,
    Phone, Mail, Calendar, FileText, ChevronRight, Filter, RefreshCw, Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/user/components/ui/tabs";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function SPManagement() {
    const { getServiceProviders, updateSPStatus, hydrated, isLoggedIn } = useVenderAuth();
    const [providers, setProviders] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedSP, setSelectedSP] = useState(null);
    const [activeTab, setActiveTab] = useState("all");
    const [feedback, setFeedback] = useState([]);
    const [allBookings, setAllBookings] = useState([]);
    const loadProviders = async () => {
        try {
            if (!hydrated || !isLoggedIn) return;
            const sps = await getServiceProviders();
            setProviders(Array.isArray(sps) ? sps : []);
        } catch {}
        setFeedback(JSON.parse(localStorage.getItem('muskan-feedback') || '[]'));
        setAllBookings(JSON.parse(localStorage.getItem('muskan-bookings') || '[]'));
    };
    useEffect(() => { loadProviders(); }, [hydrated, isLoggedIn]);

    const getSPRating = (sp) => {
        const spFeedback = feedback.filter(f => (f.providerName === sp.name || f.assignedProvider === sp.id) && f.type === 'customer_to_provider');
        if (spFeedback.length === 0) return 0;
        const sum = spFeedback.reduce((a, b) => a + b.rating, 0);
        return (sum / spFeedback.length).toFixed(1);
    };

    const getSPJobs = (sp) => {
        return allBookings.filter(b => b.assignedProvider === sp.id || b.providerName === sp.name).length;
    };

    const filtered = providers.filter(sp => {
        const matchSearch = sp.name?.toLowerCase().includes(search.toLowerCase()) || sp.phone?.includes(search);
        if (activeTab === "all") return matchSearch;
        if (activeTab === "pending") return matchSearch && sp.approvalStatus === "pending";
        if (activeTab === "approved") return matchSearch && sp.approvalStatus === "approved";
        if (activeTab === "blocked") return matchSearch && (sp.approvalStatus === "blocked" || sp.approvalStatus === "rejected");
        return matchSearch;
    });

    const handleAction = async (id, status) => {
        try {
            await updateSPStatus(id, status);
            toast.success(`Status updated to ${status}`);
            loadProviders();
            if (selectedSP?._id === id) setSelectedSP(prev => ({ ...prev, approvalStatus: status }));
        } catch {
            toast.error("Status update failed");
        }
    };

    const statusConfig = {
        pending: { label: "Pending", color: "bg-amber-100 text-amber-700 border-amber-200" },
        approved: { label: "Approved", color: "bg-green-100 text-green-700 border-green-200" },
        rejected: { label: "Rejected", color: "bg-red-100 text-red-700 border-red-200" },
        blocked: { label: "Blocked", color: "bg-red-100 text-red-700 border-red-200" },
    };

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                        <Users className="h-7 w-7 text-primary" /> SP Management
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Manage service providers in your city</p>
                </div>
                <Button onClick={loadProviders} variant="outline" className="gap-2 rounded-xl font-bold">
                    <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
            </motion.div>

            {/* Tabs + Search */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                        <TabsList className="bg-muted/50 rounded-xl p-1">
                            <TabsTrigger value="all" className="rounded-lg text-xs font-bold">All ({providers.length})</TabsTrigger>
                            <TabsTrigger value="pending" className="rounded-lg text-xs font-bold">Pending ({providers.filter(s => s.approvalStatus === "pending").length})</TabsTrigger>
                            <TabsTrigger value="approved" className="rounded-lg text-xs font-bold">Approved ({providers.filter(s => s.approvalStatus === "approved").length})</TabsTrigger>
                            <TabsTrigger value="blocked" className="rounded-lg text-xs font-bold">Blocked</TabsTrigger>
                        </TabsList>
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl h-10" />
                        </div>
                    </div>

                    <TabsContent value={activeTab} className="mt-0">
                        {filtered.length === 0 ? (
                            <Card className="shadow-sm">
                                <CardContent className="py-16 text-center">
                                    <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-muted-foreground">No service providers found</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">They'll appear here once they register</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3">
                                {filtered.map((sp) => {
                                    const stConfig = statusConfig[sp.approvalStatus] || statusConfig.pending;
                                    return (
                                        <motion.div key={sp._id || sp.id || sp.phone} variants={item}>
                                            <Card className="shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group" onClick={() => setSelectedSP(sp)}>
                                                <CardContent className="p-4 md:p-5">
                                                    <div className="flex items-center gap-4">
                                                        {/* Avatar */}
                                                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-lg font-black text-primary">{sp.name?.charAt(0) || "?"}</span>
                                                        </div>
                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="text-sm font-bold truncate">{sp.name || "Unknown"}</h3>
                                                                <Badge variant="outline" className={`text-[8px] font-black px-1.5 py-0 h-4 ${stConfig.color} border`}>
                                                                    {stConfig.label}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-medium">
                                                                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{sp.phone}</span>
                                                                <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500 fill-amber-500" />{getSPRating(sp) || "N/A"}</span>
                                                                <span className="flex items-center gap-1 hidden sm:flex"><CheckCircle className="h-3 w-3 text-primary" />{getSPJobs(sp)} Jobs</span>
                                                            </div>
                                                        </div>
                                                        {/* Actions */}
                                                        <div className="flex items-center gap-2">
                                                            {sp.approvalStatus === "pending" && (
                                                                <>
                                                                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                                                        <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-bold gap-1" onClick={(e) => { e.stopPropagation(); handleAction(sp._id || sp.id, "approved"); }}>
                                                                            <CheckCircle className="h-3.5 w-3.5" /> Approve
                                                                        </Button>
                                                                    </motion.div>
                                                                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                                                        <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-[11px] font-bold gap-1" onClick={(e) => { e.stopPropagation(); handleAction(sp._id || sp.id, "rejected"); }}>
                                                                            <XCircle className="h-3.5 w-3.5" /> Reject
                                                                        </Button>
                                                                    </motion.div>
                                                                </>
                                                            )}
                                                            {sp.approvalStatus === "approved" && (
                                                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                                                    <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-[11px] font-bold gap-1" onClick={(e) => { e.stopPropagation(); handleAction(sp._id || sp.id, "blocked"); }}>
                                                                        <Ban className="h-3.5 w-3.5" /> Block
                                                                    </Button>
                                                                </motion.div>
                                                            )}
                                                            {(sp.approvalStatus === "blocked" || sp.approvalStatus === "rejected") && (
                                                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                                                    <Button size="sm" className="h-8 bg-primary hover:bg-primary/90 text-white rounded-lg text-[11px] font-bold gap-1" onClick={(e) => { e.stopPropagation(); handleAction(sp._id || sp.id, "approved"); }}>
                                                                        <UserCheck className="h-3.5 w-3.5" /> Unblock
                                                                    </Button>
                                                                </motion.div>
                                                            )}
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 hidden md:block" />
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </TabsContent>
                </Tabs>
            </motion.div>

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
                                            <Badge variant="outline" className={`text-[9px] font-black ${(statusConfig[selectedSP.approvalStatus] || statusConfig.pending).color}`}>
                                                {(statusConfig[selectedSP.approvalStatus] || statusConfig.pending).label}
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
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Joined</p>
                                        <p className="text-sm font-bold mt-1">{selectedSP.createdAt ? new Date(selectedSP.createdAt).toLocaleDateString() : "N/A"}</p>
                                    </div>
                                </div>

                                {/* Documents */}
                                <div>
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Documents Verification</h3>
                                    <div className="space-y-2">
                                        {[
                                            { label: "Aadhar Card (Front)", key: "aadharFront" },
                                            { label: "Aadhar Card (Back)", key: "aadharBack" },
                                            { label: "PAN Card", key: "panCard" },
                                            { label: "Bank Details", key: "bankName" },
                                        ].map(doc => (
                                            <div key={doc.key} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                                <span className="text-[12px] font-semibold flex items-center gap-2">
                                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {doc.label}
                                                </span>
                                                <Badge variant="outline" className={`text-[8px] font-black ${selectedSP.documents?.[doc.key] ? "bg-green-50 text-green-600 border-green-200" : "bg-amber-50 text-amber-600 border-amber-200"}`}>
                                                    {selectedSP.documents?.[doc.key] ? "Submitted" : "Missing"}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-2">
                                    {selectedSP.approvalStatus === "pending" && (
                                        <>
                                            <Button className="flex-1 h-11 bg-green-600 hover:bg-green-700 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedSP._id || selectedSP.id, "approved")}>
                                                <CheckCircle className="h-4 w-4" /> Approve
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
        </div>
    );
}
