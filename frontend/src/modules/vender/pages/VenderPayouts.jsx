import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, IndianRupee, TrendingUp, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle, Ban, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function VenderPayouts() {
    const { getServiceProviders, getAllBookings, hydrated, isLoggedIn,updatePayoutStatus } = useVenderAuth();
    const [search, setSearch] = useState("");
    const [providers, setProviders] = useState([]);
    const [bookings, setBookings] = useState([]);

    const load = async () => {
        try {
            if (!hydrated || !isLoggedIn) return;
            const [sps, bks] = await Promise.all([getServiceProviders(), getAllBookings()]);
            setProviders((Array.isArray(sps) ? sps : []).filter(sp => sp.approvalStatus === "approved"));
            setBookings(Array.isArray(bks) ? bks : []);
        } catch {}
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (!hydrated || !isLoggedIn) return;
                const [sps, bks] = await Promise.all([getServiceProviders(), getAllBookings()]);
                if (cancelled) return;
                setProviders((Array.isArray(sps) ? sps : []).filter(sp => sp.approvalStatus === "approved"));
                setBookings(Array.isArray(bks) ? bks : []);
            } catch {}
        })();
        return () => { cancelled = true; };
    }, [hydrated, isLoggedIn]);

    const completedBookings = bookings.filter(b => b.status === "completed");
    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const commissionRate = 0.15;
    const totalCommission = Math.round(totalRevenue * commissionRate);

    // Derive payout history from bookings
    const providerName = (id) => {
        const p = providers.find(p => (p._id || p.id) === id);
        return p?.name || "Unknown";
    };
    const payouts = completedBookings.map(b => {
        const provider = providers.find(p => (p._id || p.id) === b.assignedProvider || p.phone === b.assignedProvider);
        return {
            id: b._id || b.id,
            spName: provider ? provider.name : "Unknown SP",
            amount: Math.round((b.totalAmount || 0) * (1 - commissionRate)),
            status: b.payoutStatus || "pending",
            date: b.slot?.date || b.createdAt?.slice(0, 10) || "N/A"
        };
    }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const handleStatusUpdate = (id, newStatus) => {
        if (updatePayoutStatus) {
            updatePayoutStatus(id, newStatus);
            load();
        }
    };

    const filteredPayouts = payouts.filter(p => p.spName.toLowerCase().includes(search.toLowerCase()) || p.id?.includes(search));

    const statusConfig = {
        completed: { label: "Paid", icon: CheckCircle, color: "bg-green-100 text-green-700 border-green-200" },
        pending: { label: "Pending", icon: Clock, color: "bg-amber-100 text-amber-700 border-amber-200" },
        on_hold: { label: "On Hold", icon: Ban, color: "bg-red-100 text-red-700 border-red-200" },
    };

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                    <Wallet className="h-7 w-7 text-primary" /> Payouts & Commission
                </h1>
                <p className="text-sm text-muted-foreground font-medium mt-1">Track earnings and manage payouts</p>
            </motion.div>

            {/* Overview Cards */}
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { title: "Total Revenue", value: `₹${totalRevenue.toLocaleString()}`, icon: IndianRupee, color: "emerald", sub: `${completedBookings.length} completed jobs` },
                    { title: "Commission (15%)", value: `₹${totalCommission.toLocaleString()}`, icon: TrendingUp, color: "purple", sub: "Platform earnings" },
                    { title: "Pending Payouts", value: `₹${payouts.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0).toLocaleString()}`, icon: Clock, color: "amber", sub: `${payouts.filter(p => p.status === "pending").length} pending` },
                    { title: "On Hold", value: `₹${payouts.filter(p => p.status === "on_hold").reduce((s, p) => s + p.amount, 0).toLocaleString()}`, icon: Ban, color: "red", sub: `${payouts.filter(p => p.status === "on_hold").length} held` },
                ].map((stat) => {
                    const Icon = stat.icon;
                    const bgMap = { emerald: "from-white to-emerald-50/40", purple: "from-white to-purple-50/40", amber: "from-white to-amber-50/40", red: "from-white to-red-50/40" };
                    const iconBgMap = { emerald: "bg-emerald-100 text-emerald-600", purple: "bg-purple-100 text-purple-600", amber: "bg-amber-100 text-amber-600", red: "bg-red-100 text-red-600" };
                    return (
                        <motion.div key={stat.title} variants={item}>
                            <Card className={`border-none shadow-sm bg-gradient-to-br ${bgMap[stat.color]}`}>
                                <CardContent className="p-4 md:p-5">
                                    <div className={`h-9 w-9 rounded-xl ${iconBgMap[stat.color]} flex items-center justify-center mb-3`}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="text-xl font-black tracking-tight">{stat.value}</div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{stat.title}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{stat.sub}</p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    );
                })}
            </motion.div>

            {/* Payout History */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <CardTitle className="text-lg font-bold">Payout History</CardTitle>
                            <CardDescription>Recent transactions and payouts</CardDescription>
                        </div>
                        <div className="relative max-w-sm w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl h-9" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                            {filteredPayouts.map((payout) => {
                                const sc = statusConfig[payout.status];
                                const SIcon = sc.icon;
                                return (
                                    <motion.div key={payout.id} variants={item} className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                                                <span className="text-sm font-black text-primary">{payout.spName.charAt(0)}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{payout.spName}</p>
                                                <p className="text-[10px] text-muted-foreground font-medium">{payout.date} • #{payout.id}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-black">₹{payout.amount.toLocaleString()}</span>
                                            <Badge variant="outline" className={`text-[8px] font-black ${sc.color} border gap-1`}>
                                                <SIcon className="h-2.5 w-2.5" /> {sc.label}
                                            </Badge>
                                            {/* Actions could call an admin payout API in future */}
                                            {payout.status === "pending" && (
                                                <div className="flex gap-1">
                                                    <Button size="sm" onClick={() => handleStatusUpdate(payout.id, "completed")} className="h-7 text-[10px] font-bold bg-green-600 hover:bg-green-700 rounded-lg px-2">Release</Button>
                                                    <Button size="sm" onClick={() => handleStatusUpdate(payout.id, "on_hold")} variant="outline" className="h-7 text-[10px] font-bold border-red-200 text-red-600 rounded-lg px-2 hover:bg-red-50">Hold</Button>
                                                </div>
                                            )}
                                            {payout.status === "on_hold" && (
                                                <Button size="sm" onClick={() => handleStatusUpdate(payout.id, "pending")} className="h-7 text-[10px] font-bold bg-primary rounded-lg px-2">Un-Hold</Button>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                            {filteredPayouts.length === 0 && (
                                <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                                    No payouts tracking right now. Payouts generate automatically for completed bookings.
                                </div>
                            )}
                        </motion.div>
                    </CardContent>
                </Card>
            </motion.div>
            <div className="flex justify-end">
                <Button variant="outline" className="gap-2 rounded-xl font-bold" onClick={() => { load(); toast.success("Refreshed payouts"); }}>
                    <ArrowDownCircle className="h-4 w-4" /> Refresh
                </Button>
            </div>
        </div>
    );
}
