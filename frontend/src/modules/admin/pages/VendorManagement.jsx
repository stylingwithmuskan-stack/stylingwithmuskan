import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Store, Search, CheckCircle, Ban, MapPin, Mail, Phone, RefreshCw, UserCheck, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function VendorManagement() {
    const { isLoggedIn, getAllVendors, updateVendorStatus } = useAdminAuth();
    const [vendors, setVendors] = useState([]);
    const [search, setSearch] = useState("");

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
        } catch {
            toast.error("Status update failed");
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
                <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2">
                    {filtered.map(v => (
                        <motion.div key={v._id || v.id} variants={item}>
                            <Card className="shadow-none border-border/50 hover:border-primary/30 transition-all duration-200">
                                <CardContent className="p-5">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                                            <span className="text-lg font-black text-primary">{v.name?.charAt(0) || "V"}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold truncate">{v.name}</h3>
                                                <Badge variant="outline" className={`text-[8px] font-black px-1.5 py-0 h-4 ${v.status === "approved" ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-red-500/15 text-red-400 border-red-500/30"}`}>
                                                    {v.status || "Pending"}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-muted-foreground font-medium">
                                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{v.city || "N/A"}</span>
                                                <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{v.email}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5">
                                            {v.status !== "blocked" ? (
                                                <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg" onClick={() => handleAction(v._id || v.id, "blocked")}>
                                                    <Ban className="h-3 w-3 mr-1" /> Block
                                                </Button>
                                            ) : (
                                                <Button size="sm" className="h-8 text-[10px] font-bold bg-primary rounded-lg" onClick={() => handleAction(v._id || v.id, "approved")}>
                                                    <UserCheck className="h-3 w-3 mr-1" /> Unblock
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
}
