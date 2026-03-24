import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Users, CalendarRange, IndianRupee, TrendingUp, AlertTriangle,
    ArrowUpRight, CheckCircle, Clock, UserCheck, Shield, RefreshCw, Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Link } from "react-router-dom";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function VenderDashboard() {
    const { getServiceProviders, getAllBookings, getSOSAlerts, vendor, hydrated, isLoggedIn } = useVenderAuth();
    const [stats, setStats] = useState({ sps: 0, pendingSPs: 0, bookings: 0, activeBookings: 0, revenue: 0, sosAlerts: 0 });
    const [activities, setActivities] = useState([]);

    const load = async () => {
        try {
            if (!hydrated || !isLoggedIn) return;
            const [sps, bookings, sos] = await Promise.all([
                getServiceProviders(),
                getAllBookings(),
                getSOSAlerts(),
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
            });
            const recentSPs = sArr
                .filter(p => p.registrationComplete)
                .map(p => ({
                    type: "sp_new",
                    ts: new Date(p.createdAt || Date.now()).getTime(),
                    text: `New SP registration from '${p.name || p.phone || "Unknown"}'`,
                    icon: Clock,
                    color: "text-blue-500",
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
                };
            });
            const items = [...recentSPs, ...recentBookings]
                .sort((a, b) => b.ts - a.ts)
                .slice(0, 8);
            setActivities(items);
        } catch {
            // ignore
        }
    };

    useEffect(() => { load(); }, [hydrated, isLoggedIn]);

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

    return (
        <div className="space-y-8">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">Dashboard</h1>
                    <p className="text-sm text-muted-foreground font-medium">
                        Overview for <span className="text-primary font-bold">{vendor?.city || "Your City"}</span>
                    </p>
                </div>
                <Button variant="outline" className="gap-2 rounded-xl font-bold" onClick={() => { load(); toast.success("Refreshed"); }}>
                    <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
            </motion.div>

            {/* Stats Grid */}
            <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => {
                    const Icon = stat.icon;
                    const colors = colorMap[stat.color];
                    return (
                        <motion.div key={stat.title} variants={item}>
                            <Link to={stat.link}>
                                <Card className={`border-none shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br ${colors.gradient} cursor-pointer group`}>
                                    <CardContent className="p-4 md:p-6">
                                        <div className="flex flex-col gap-3">
                                            <div className={`h-10 w-10 rounded-xl ${colors.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                                <Icon className={`h-5 w-5 ${colors.text}`} />
                                            </div>
                                            <div>
                                                <div className="text-xl md:text-2xl font-black tracking-tight">{stat.value}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.title}</p>
                                                    {stat.badge && (
                                                        <Badge variant="outline" className="text-[8px] font-black px-1.5 py-0 h-4 border-primary/30 text-primary">
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

            {/* Quick Actions + Recent Activity */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Quick Actions */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
                            <CardDescription>Manage your city operations</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            <Button asChild className="w-full justify-between h-12 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold">
                                <Link to="/vender/service-providers">
                                    <span className="flex items-center gap-2"><UserCheck className="h-4 w-4" /> Review Pending SPs</span>
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="w-full justify-between h-12 rounded-xl font-bold">
                                <Link to="/vender/bookings">
                                    <span className="flex items-center gap-2"><CalendarRange className="h-4 w-4 text-primary" /> Manage Bookings</span>
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="w-full justify-between h-12 rounded-xl font-bold">
                                <Link to="/vender/payouts">
                                    <span className="flex items-center gap-2"><IndianRupee className="h-4 w-4 text-primary" /> View Payouts</span>
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Recent Activity */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
                            <CardDescription>Latest updates from your city</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {activities.length > 0 ? activities.map((activity, i) => {
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
                                            className="flex items-center gap-3 pb-3 border-b border-border/50 last:border-0 last:pb-0"
                                        >
                                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                                <AIcon className={`h-4 w-4 ${activity.color || "text-muted-foreground"}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-semibold text-foreground truncate">{activity.text}</p>
                                                <p className="text-[10px] text-muted-foreground font-medium">{rel}</p>
                                            </div>
                                        </motion.div>
                                    );
                                }) : (
                                    <p className="text-sm text-center text-muted-foreground py-4">No recent activity</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
