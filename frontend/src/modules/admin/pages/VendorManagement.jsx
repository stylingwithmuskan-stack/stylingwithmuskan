import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Store, Search, CheckCircle, Ban, MapPin, Mail, Phone, RefreshCw, UserCheck, ChevronRight, XCircle, FileText, Shield, X } from "lucide-react";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const statusColors = {
    approved: "bg-green-500/15 text-green-400 border-green-500/30",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    rejected: "bg-red-500/15 text-red-400 border-red-500/30",
    blocked: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function VendorManagement() {
    const { isLoggedIn, getAllVendors, updateVendorStatus, approveVendorZones, rejectVendorZones } = useAdminAuth();
    const [vendors, setVendors] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedVendor, setSelectedVendor] = useState(null);

    const load = async () => {
        if (!isLoggedIn) return;
        try {
            const items = await getAllVendors();
            setVendors(Array.isArray(items) ? items : []);
        } catch {}
    };
    useEffect(() => { load(); }, [isLoggedIn]);

    const filtered = vendors.filter(v => v.name?.toLowerCase().includes(search.toLowerCase()) || v.city?.toLowerCase().includes(search.toLowerCase()));

    const handleAction = async (id, status) => {
        try {
            await updateVendorStatus(id, status);
            toast.success(`Status updated to ${status}`);
            load();
            // Update selected vendor if it's the one being modified
            if (selectedVendor?._id === id || selectedVendor?.id === id) {
                setSelectedVendor(prev => ({ ...prev, status }));
            }
        } catch {
            toast.error("Status update failed");
        }
    };

    const handleZoneAction = async (id, action) => {
        try {
            if (action === "approve") await approveVendorZones(id);
            else await rejectVendorZones(id);
            toast.success(`Zones ${action}d successfully`);
            load();
            // Update selected vendor if it's the one being modified
            if (selectedVendor?._id === id || selectedVendor?.id === id) {
                const updated = await getAllVendors();
                const found = updated.find(u => u._id === id || u.id === id);
                if (found) setSelectedVendor(found);
            }
        } catch {
            toast.error(`Zone ${action} failed`);
        }
    };

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2"><Store className="h-7 w-7 text-primary" /> Vendor Management</h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Manage all city vendors</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative max-w-sm flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by name or city..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl h-10" />
                    </div>
                    <Button onClick={load} variant="outline" className="gap-2 rounded-xl font-bold"><RefreshCw className="h-4 w-4" /></Button>
                </div>
            </motion.div>

            {filtered.length === 0 ? (
                <Card><CardContent className="py-16 text-center">
                    <Store className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-bold text-muted-foreground">No vendors registered yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Vendors will appear here once they register via /vender/register</p>
                </CardContent></Card>
            ) : (
                <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                    {filtered.map(v => (
                        <motion.div key={v._id || v.id} variants={item}>
                            <Card className="border-border/50 shadow-none hover:border-primary/30 transition-all cursor-pointer" onClick={() => setSelectedVendor(v)}>
                                <CardContent className="p-4 flex flex-col gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm font-black text-primary">{v.name?.charAt(0) || "V"}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold truncate">{v.name}</h3>
                                                <Badge variant="outline" className={`text-[8px] font-black px-1.5 py-0 h-4 border ${statusColors[v.status] || statusColors.pending}`}>
                                                    {(v.status || "pending").toUpperCase()}
                                                </Badge>
                                            </div>
                                            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{v.phone || "N/A"}</span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            {v.status === "pending" && (
                                                <>
                                                    <Button size="sm" className="h-7 text-[10px] font-bold bg-green-600 hover:bg-green-700 rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleAction(v._id || v.id, "approved"); }}><CheckCircle className="h-3 w-3 mr-1" />Approve</Button>
                                                    <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold border-red-500/30 text-red-400 rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleAction(v._id || v.id, "rejected"); }}><XCircle className="h-3 w-3 mr-1" />Reject</Button>
                                                </>
                                            )}
                                            {v.status === "approved" && (
                                                <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold border-red-500/30 text-red-400 rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleAction(v._id || v.id, "blocked"); }}><Ban className="h-3 w-3 mr-1" />Block</Button>
                                            )}
                                            {(v.status === "blocked" || v.status === "rejected") && (
                                                <Button size="sm" className="h-7 text-[10px] font-bold bg-primary rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleAction(v._id || v.id, "approved"); }}><UserCheck className="h-3 w-3 mr-1" />Unblock</Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {(v.zones || []).map(z => (
                                            <Badge key={z} variant="secondary" className="text-[9px] font-bold bg-muted/50 text-muted-foreground border-none">
                                                {z}
                                            </Badge>
                                        ))}
                                    </div>
                                    {v.pendingZones?.length > 0 && (
                                        <div className="mt-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50 flex items-center justify-between">
                                            <div className="flex-1">
                                                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">New Zone Request</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {v.pendingZones.map(z => (
                                                        <Badge key={z} className="bg-white text-amber-600 border-amber-200 text-[9px] font-bold">
                                                            + {z}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 ml-4">
                                                <Button size="sm" className="h-7 text-[9px] font-black bg-amber-600 hover:bg-amber-700 text-white rounded-lg" onClick={(e) => { e.stopPropagation(); handleZoneAction(v._id || v.id, "approve"); }}>
                                                    Approve
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 text-[9px] font-black text-amber-700 hover:bg-amber-100 rounded-lg" onClick={(e) => { e.stopPropagation(); handleZoneAction(v._id || v.id, "reject"); }}>
                                                    Reject
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            )}

            {/* Vendor Details Modal */}
            <AnimatePresence>
                {selectedVendor && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedVendor(null)} />
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
                                        {selectedVendor.name?.charAt(0) || "V"}
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-lg font-black">{selectedVendor.name || "Unknown"}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className={`text-[9px] font-black ${statusColors[selectedVendor.status] || statusColors.pending}`}>
                                                {selectedVendor.status || "pending"}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground font-medium">ID: {selectedVendor._id || selectedVendor.id}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedVendor(null)}
                                        className="w-8 h-8 bg-muted hover:bg-muted/80 rounded-full flex items-center justify-center transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Contact */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Phone</p>
                                        <p className="text-sm font-bold mt-1">{selectedVendor.phone || "N/A"}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Email</p>
                                        <p className="text-sm font-bold mt-1">{selectedVendor.email || "N/A"}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">City</p>
                                        <p className="text-sm font-bold mt-1">{selectedVendor.city || "N/A"}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Joined</p>
                                        <p className="text-sm font-bold mt-1">{selectedVendor.createdAt ? new Date(selectedVendor.createdAt).toLocaleDateString() : "N/A"}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3 col-span-2">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Full Address</p>
                                        <p className="text-sm font-bold mt-1">{selectedVendor.address || "N/A"}</p>
                                    </div>
                                </div>

                                {/* Zone Management */}
                                <div>
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Zone Management</h3>
                                    <div className="space-y-4">
                                        <div className="bg-muted/30 rounded-xl p-3">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Approved Zones</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedVendor.zones?.length > 0 ? (
                                                    selectedVendor.zones.map(zone => (
                                                        <Badge key={zone} variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary border-none">
                                                            {zone}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">No approved zones</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {selectedVendor.pendingZones?.length > 0 && (
                                            <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100/50">
                                                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2">Pending Zone Requests</p>
                                                <div className="flex flex-wrap gap-1.5 mb-3">
                                                    {selectedVendor.pendingZones.map(zone => (
                                                        <Badge key={zone} className="bg-white text-amber-600 border-amber-200 text-[10px] font-bold">
                                                            + {zone}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" className="flex-1 h-8 text-[10px] font-black bg-amber-600 hover:bg-amber-700 text-white rounded-lg" onClick={() => handleZoneAction(selectedVendor._id || selectedVendor.id, "approve")}>
                                                        Approve All
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] font-black border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg" onClick={() => handleZoneAction(selectedVendor._id || selectedVendor.id, "reject")}>
                                                        Reject All
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Business Details */}
                                {(selectedVendor.businessName || selectedVendor.gstNumber || selectedVendor.registrationNumber) && (
                                    <div>
                                        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Business Details</h3>
                                        <div className="space-y-2">
                                            {selectedVendor.businessName && (
                                                <div className="flex items-center justify-between py-2 border-b border-border/30">
                                                    <span className="text-[12px] font-semibold flex items-center gap-2">
                                                        <Store className="h-3.5 w-3.5 text-muted-foreground" /> Business Name
                                                    </span>
                                                    <span className="text-[12px] font-bold">{selectedVendor.businessName}</span>
                                                </div>
                                            )}
                                            {selectedVendor.gstNumber && (
                                                <div className="flex items-center justify-between py-2 border-b border-border/30">
                                                    <span className="text-[12px] font-semibold flex items-center gap-2">
                                                        <FileText className="h-3.5 w-3.5 text-muted-foreground" /> GST Number
                                                    </span>
                                                    <span className="text-[12px] font-bold">{selectedVendor.gstNumber}</span>
                                                </div>
                                            )}
                                            {selectedVendor.registrationNumber && (
                                                <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                                    <span className="text-[12px] font-semibold flex items-center gap-2">
                                                        <Shield className="h-3.5 w-3.5 text-muted-foreground" /> Registration No
                                                    </span>
                                                    <span className="text-[12px] font-bold">{selectedVendor.registrationNumber}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 pt-2">
                                    {selectedVendor.status === "pending" && (
                                        <>
                                            <Button className="flex-1 h-11 bg-green-600 hover:bg-green-700 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedVendor._id || selectedVendor.id, "approved")}>
                                                <CheckCircle className="h-4 w-4" /> Approve Vendor
                                            </Button>
                                            <Button variant="outline" className="flex-1 h-11 border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedVendor._id || selectedVendor.id, "rejected")}>
                                                <XCircle className="h-4 w-4" /> Reject
                                            </Button>
                                        </>
                                    )}
                                    {selectedVendor.status === "approved" && (
                                        <Button variant="outline" className="flex-1 h-11 border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedVendor._id || selectedVendor.id, "blocked")}>
                                            <Ban className="h-4 w-4" /> Block Vendor
                                        </Button>
                                    )}
                                    {(selectedVendor.status === "blocked" || selectedVendor.status === "rejected") && (
                                        <Button className="flex-1 h-11 bg-primary hover:bg-primary/90 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedVendor._id || selectedVendor.id, "approved")}>
                                            <UserCheck className="h-4 w-4" /> Unblock Vendor
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
