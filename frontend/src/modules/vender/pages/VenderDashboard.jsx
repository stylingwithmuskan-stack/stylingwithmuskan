import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, CalendarRange, IndianRupee, TrendingUp, AlertTriangle,
    ArrowUpRight, CheckCircle, Clock, UserCheck, Shield, RefreshCw, Star,
    MapPin, Filter, BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/user/components/ui/select";
import { Link } from "react-router-dom";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function VenderDashboard() {
    const { getServiceProviders, getAllBookings, getSOSAlerts, getStats, vendor, hydrated, isLoggedIn } = useVenderAuth();
    const [stats, setStats] = useState({ sps: 0, pendingSPs: 0, bookings: 0, activeBookings: 0, revenue: 0, sosAlerts: 0, heatmap: {} });
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedZone, setSelectedZone] = useState("all");

    const load = async () => {
        try {
            if (!hydrated || !isLoggedIn) return;
            setLoading(true);
            const [sps, bookings, sos, apiStats] = await Promise.all([
                getServiceProviders(),
                getAllBookings(),
                getSOSAlerts(),
                getStats(),
            ]);
            
            const sArr = Array.isArray(sps) ? sps : [];
            const bArr = Array.isArray(bookings) ? bookings : [];
            const aArr = Array.isArray(sos) ? sos : [];

            setStats({
                sps: sArr.length,
                pendingSPs: sArr.filter(s => s.approvalStatus === "pending").length,
                bookings: bArr.length,
                activeBookings: bArr.filter(b => ["accepted", "travelling", "arrived", "in_progress"].includes(b.status)).length,
                revenue: bArr.filter(b => b.status === "completed").reduce((sum, b) => sum + (b.totalAmount || 0), 0),
                sosAlerts: aArr.filter(s => s.status !== "resolved").length,
                heatmap: apiStats.heatmap || {},
            });

            const recentSPs = sArr
                .filter(p => p.registrationComplete)
                .map(p => ({
                    type: "sp_new",
                    ts: new Date(p.createdAt || Date.now()).getTime(),
                    text: `New SP registration from '${p.name || p.phone || "Unknown"}'`,
                    icon: Clock,
                    color: "text-blue-500",
                    zone: p.zone
                }));

            const recentBookings = bArr.map(b => {
                const status = (b.status || "").toLowerCase();
                let icon = Clock, color = "text-blue-500", prefix = "Booking";
                if (status === "completed") { icon = CheckCircle; color = "text-green-500"; prefix = "SP completed"; }
                else if (["accepted", "in_progress", "arrived", "travelling"].includes(status)) { icon = Shield; color = "text-purple-500"; }
                else if (status === "cancelled") { icon = AlertTriangle; color = "text-red-500"; }
                return {
                    type: "booking",
                    ts: new Date(b.updatedAt || b.createdAt || Date.now()).getTime(),
                    text: `${prefix} ${b.customerName ? `for '${b.customerName}'` : `#${(b._id || "").toString().slice(-6)}`}`,
                    icon,
                    color,
                    zone: b.address?.area
                };
            });

            const items = [...recentSPs, ...recentBookings]
                .sort((a, b) => b.ts - a.ts);
            
            setActivities(items);
        } catch (err) {
            console.error("Failed to load dashboard data:", err);
            toast.error("Failed to refresh data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [hydrated, isLoggedIn]);

    const filteredActivities = useMemo(() => {
        if (selectedZone === "all") return activities.slice(0, 8);
        return activities.filter(a => a.zone === selectedZone).slice(0, 8);
    }, [activities, selectedZone]);

    const statCards = [
        { title: "Service Providers", value: stats.sps, icon: Users, color: "emerald", badge: stats.pendingSPs > 0 ? `${stats.pendingSPs} pending` : null, link: "/vender/service-providers" },
        { title: "Total Bookings", value: stats.bookings, icon: CalendarRange, color: "blue", badge: stats.activeBookings > 0 ? `${stats.activeBookings} active` : null, link: "/vender/bookings" },
        { title: "Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: IndianRupee, color: "purple", link: "/vender/payouts" },
        { title: "SOS Alerts", value: stats.sosAlerts, icon: AlertTriangle, color: stats.sosAlerts > 0 ? "red" : "green", link: "/vender/sos" },
    ];

    const colorMap = {
        emerald: { bg: "bg-emerald-100", text: "text-emerald-600", ring: "ring-emerald-100", gradient: "from-white to-emerald-50/40" },
        blue: { bg: "bg-blue-100", text: "text-blue-600", ring: "ring-blue-100", gradient: "from-white to-blue-50/40" },
        purple: { bg: "bg-purple-100", text: "text-purple-600", ring: "ring-purple-100", gradient: "from-white to-purple-50/40" },
        red: { bg: "bg-red-100", text: "text-red-600", ring: "ring-red-100", gradient: "from-white to-red-50/40" },
        green: { bg: "bg-green-100", text: "text-green-600", ring: "ring-green-100", gradient: "from-white to-green-50/40" },
    };

    const heatmapData = Object.entries(stats.heatmap).sort((a, b) => b[1] - a[1]);
    const maxBookings = Math.max(...Object.values(stats.heatmap), 1);

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-emerald-50">
                <div className="flex flex-row flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
                    <h1 className="text-xl md:text-3xl font-black tracking-tight">Dashboard</h1>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md py-0.5 px-2 text-[10px] md:text-xs h-6 flex items-center">
                            <MapPin className="h-3 w-3 mr-1 shrink-0" /> <span className="truncate max-w-[100px]">{vendor?.city || "Your City"}</span>
                        </Badge>
                        <div className="flex flex-wrap gap-1">
                            {(vendor?.zones || []).map(z => (
                                <Badge key={z} variant="outline" className="text-emerald-600 border-emerald-200 bg-white rounded-md truncate max-w-[100px] text-[10px] md:text-xs h-6 flex items-center">
                                    {z}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex flex-1 md:flex-none items-center gap-2 bg-muted/50 p-1.5 rounded-xl border border-border/50 overflow-hidden">
                        <Filter className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
                        <Select value={selectedZone} onValueChange={setSelectedZone}>
                            <SelectTrigger className="w-full md:w-[160px] h-9 border-none bg-transparent focus:ring-0 font-bold text-xs truncate">
                                <SelectValue placeholder="All Zones" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-emerald-100">
                                <SelectItem value="all" className="font-bold">All Zones</SelectItem>
                                {(vendor?.zones || []).map(z => (
                                    <SelectItem key={z} value={z} className="font-bold">{z}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" size="icon" className={`shrink-0 rounded-xl h-12 w-12 transition-all ${loading ? 'animate-spin border-emerald-500 text-emerald-600' : 'hover:border-emerald-500 hover:text-emerald-600'}`} onClick={() => load()}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <motion.div variants={container} initial="hidden" animate="show" className="grid gap-2 md:gap-4 grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => {
                    const Icon = stat.icon;
                    const colors = colorMap[stat.color];
                    return (
                        <motion.div key={stat.title} variants={item}>
                            <Link to={stat.link}>
                                <Card className={`border-none shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br ${colors.gradient} cursor-pointer group`}>
                                    <CardContent className="p-3 md:p-6">
                                        <div className="flex flex-col gap-2 md:gap-3">
                                            <div className={`h-8 w-8 md:h-10 md:w-10 shrink-0 rounded-lg md:rounded-xl ${colors.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                                <Icon className={`h-4 w-4 md:h-5 md:w-5 ${colors.text}`} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-lg md:text-2xl font-black tracking-tight">{stat.value}</div>
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 mt-0.5 md:mt-1 w-full">
                                                    <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest break-words">{stat.title}</p>
                                                    {stat.badge && (
                                                        <Badge variant="outline" className="text-[8px] md:text-[9px] font-black px-1 py-0 h-auto border-primary/30 text-primary self-start sm:self-auto max-w-full text-center">
                                                            {stat.badge}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>
                    );
                })}
            </motion.div>

            {/* Heatmap + Recent Activity */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Zone Heatmap */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-1">
                    <Card className="shadow-sm border-none bg-white">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-emerald-600" />
                                Zone Activity
                            </CardTitle>
                            <CardDescription>Bookings by area</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-5">
                                {heatmapData.length > 0 ? heatmapData.map(([zone, count]) => (
                                    <div key={zone} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <span className="text-muted-foreground uppercase tracking-wider">{zone}</span>
                                            <span className="text-emerald-600">{count} bookings</span>
                                        </div>
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(count / maxBookings) * 100}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                                            />
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-10 opacity-50">
                                        <MapPin className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-xs font-bold">No zone data yet</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                    
                    {/* Quick Actions Moved Here for Desktop */}
                    <div className="mt-6 space-y-3">
                        <Button asChild className="w-full justify-between h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 transition-all hover:scale-[1.02]">
                            <Link to="/vender/service-providers">
                                <span className="flex items-center gap-3"><UserCheck className="h-5 w-5" /> Review Pending SPs</span>
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="w-full justify-between h-12 rounded-xl font-bold border-emerald-100 hover:bg-emerald-50">
                            <Link to="/vender/bookings">
                                <span className="flex items-center gap-2"><CalendarRange className="h-4 w-4 text-emerald-600" /> Manage Bookings</span>
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </motion.div>

                {/* Recent Activity */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="lg:col-span-2">
                    <Card className="shadow-sm border-none bg-white min-h-[400px]">
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <div>
                                <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
                                <CardDescription>Latest updates from your city</CardDescription>
                            </div>
                            {selectedZone !== "all" && (
                                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200">
                                    Showing: {selectedZone}
                                </Badge>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {filteredActivities.length > 0 ? filteredActivities.map((activity, i) => {
                                    const AIcon = activity.icon || Clock;
                                    const rel = (() => {
                                        const diff = Date.now() - activity.ts;
                                        const mins = Math.round(diff / 60000);
                                        if (mins < 1) return "just now";
                                        if (mins < 60) return `${mins} min ago`;
                                        const hrs = Math.round(mins / 60);
                                        if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
                                        const days = Math.round(hrs / 24);
                                        return `${days} day${days > 1 ? "s" : ""} ago`;
                                    })();
                                    return (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.5 + i * 0.08 }}
                                            className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-emerald-50/50 transition-all border border-transparent hover:border-emerald-50"
                                        >
                                            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-white transition-colors">
                                                <AIcon className={`h-5 w-5 ${activity.color || "text-muted-foreground"}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-[13px] font-bold text-foreground truncate">{activity.text}</p>
                                                    {activity.zone && (
                                                        <span className="text-[9px] font-black uppercase tracking-tighter text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                            {activity.zone}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-muted-foreground font-medium">{rel}</p>
                                            </div>
                                        </motion.div>
                                    );
                                }) : (
                                    <div className="flex flex-col items-center justify-center py-20 opacity-30">
                                        <Clock className="h-12 w-12 mb-4" />
                                        <p className="text-sm font-bold">No activity found for {selectedZone === "all" ? "this city" : selectedZone}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
