import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, Store, CalendarRange, IndianRupee, TrendingUp, TrendingDown, UserPlus, ShieldAlert, ArrowUpRight, Percent, MapPin, Map as MapIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/user/components/ui/select";
import { Link } from "react-router-dom";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

const defaultRevenueData = [
    { month: "Jan", revenue: 45000, commission: 6750 },
    { month: "Feb", revenue: 62000, commission: 9300 },
    { month: "Mar", revenue: 58000, commission: 8700 },
    { month: "Apr", revenue: 73000, commission: 10950 },
    { month: "May", revenue: 81000, commission: 12150 },
    { month: "Jun", revenue: 95000, commission: 14250 },
];

const defaultBookingTrend = [
    { day: "Mon", bookings: 28 }, { day: "Tue", bookings: 35 }, { day: "Wed", bookings: 42 },
    { day: "Thu", bookings: 38 }, { day: "Fri", bookings: 55 }, { day: "Sat", bookings: 68 }, { day: "Sun", bookings: 45 },
];

const defaultCustomersByMonth = [
    { month: "Jan", customers: 0 },
    { month: "Feb", customers: 0 },
    { month: "Mar", customers: 0 },
    { month: "Apr", customers: 0 },
    { month: "May", customers: 0 },
    { month: "Jun", customers: 0 },
];

const defaultProvidersByMonth = [
    { month: "Jan", providers: 0 },
    { month: "Feb", providers: 0 },
    { month: "Mar", providers: 0 },
    { month: "Apr", providers: 0 },
    { month: "May", providers: 0 },
    { month: "Jun", providers: 0 },
];

export default function AdminDashboard() {
    const {
        isLoggedIn,
        getAllVendors,
        getAllServiceProviders,
        getAllBookings,
        getUserBookings,
        getSOSAlerts,
        getMetricsOverview,
        getRevenueByMonth,
        getCustomersByMonth,
        getProvidersByMonth,
        getBookingTrend,
        getMetricsCities,
    } = useAdminAuth();
    const [stats, setStats] = useState({});
    const [revenueSeries, setRevenueSeries] = useState(defaultRevenueData);
    const [bookingSeries, setBookingSeries] = useState(defaultBookingTrend);
    const [customersSeries, setCustomersSeries] = useState(defaultCustomersByMonth);
    const [providersSeries, setProvidersSeries] = useState(defaultProvidersByMonth);
    const [allBookings, setAllBookings] = useState([]);
    const [cities, setCities] = useState([]);
    const [selectedCity, setSelectedCity] = useState("");
    const now = new Date();
    const [selectedPeriod, setSelectedPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });

    useEffect(() => {
        if (!isLoggedIn) return;
        let cancelled = false;
        (async () => {
            try {
                // Prefer server-provided city list for dropdown (fast). Fallback stays below.
                const list = await getMetricsCities?.();
                if (cancelled) return;
                if (Array.isArray(list) && list.length) {
                    const cleaned = list.map((c) => String(c || "").trim()).filter((c) => c && c !== "All Cities");
                    setCities(cleaned);
                }
            } catch {
                // ignore (fallback will populate cities if needed)
            }
        })();
        return () => { cancelled = true; };
    }, [isLoggedIn]);

    useEffect(() => {
        if (!isLoggedIn) return;
        let cancelled = false;
        (async () => {
            try {
                // Keep local copies for fallback computations (only used if metrics endpoints fail)
                const [vendors, sps, providerBookings, userBookings, sos] = await Promise.all([
                    getAllVendors(),
                    getAllServiceProviders(),
                    getAllBookings(),
                    getUserBookings(),
                    getSOSAlerts(),
                ]);
                if (cancelled) return;
                const pBookings = Array.isArray(providerBookings) ? providerBookings : [];
                const uBookings = Array.isArray(userBookings) ? userBookings : [];
                const merged = [...pBookings, ...uBookings];
                setAllBookings(merged);
                const citySet = new Set();
                (vendors || []).forEach(v => v?.city && citySet.add(v.city));
                (sps || []).forEach(sp => sp?.city && citySet.add(sp.city));
                (merged || []).forEach(b => { const c = b.address?.city || b.address?.area; if (c) citySet.add(c); });
                setCities((prev) => (prev && prev.length ? prev : Array.from(citySet).sort()));
                // If metrics endpoints are down, at least show SOS in cards
                setStats((prev) => ({
                    ...prev,
                    sosAlerts: (sos || []).filter(s => s.status !== "resolved").length,
                }));
            } catch {
                // ignore (metrics effect below will set defaults)
            }
        })();
        return () => { cancelled = true; };
    }, [isLoggedIn]);

    useEffect(() => {
        if (!isLoggedIn) return;
        let cancelled = false;
        (async () => {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
            const period = `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, "0")}`;
            const params = { tz, period };
            if (selectedCity) params.city = selectedCity;

            const matchCity = (b) => {
                if (!selectedCity) return true;
                const c = b?.address?.city || b?.address?.area || "";
                return String(c) === String(selectedCity);
            };
            const inSelectedMonth = (b) => {
                try {
                    const d = new Date(b?.createdAt || 0);
                    if (isNaN(d.getTime())) return false;
                    return d.getFullYear() === selectedPeriod.year && (d.getMonth() + 1) === selectedPeriod.month;
                } catch { return false; }
            };

            try {
                const [overview, rev, custSeries, provSeries, trend] = await Promise.all([
                    getMetricsOverview?.(params),
                    getRevenueByMonth?.({ ...params, months: 6 }),
                    getCustomersByMonth?.({ ...params, months: 6 }),
                    getProvidersByMonth?.({ ...params, months: 6 }),
                    getBookingTrend?.({ ...params, days: 7 }),
                ]);
                if (cancelled) return;
                const mapped = {
                    ...(overview || {}),
                    sosAlerts: Number(overview?.sosActive ?? overview?.sosAlerts ?? 0),
                    zones: Array.isArray(overview?.zones) ? overview.zones : undefined,
                };
                if (!Array.isArray(mapped.zones) || mapped.zones.length === 0) {
                    const filtered = (allBookings || []).filter(matchCity).filter(inSelectedMonth);
                    mapped.zones = getZones(filtered);
                }
                setStats(mapped);
                if (Array.isArray(rev) && rev.length) setRevenueSeries(rev);
                if (Array.isArray(custSeries) && custSeries.length) setCustomersSeries(custSeries);
                if (Array.isArray(provSeries) && provSeries.length) setProvidersSeries(provSeries);
                if (Array.isArray(trend) && trend.length) setBookingSeries(trend);
            } catch {
                if (cancelled) return;
                // Fallback: compute filtered booking-based metrics locally (keeps UI working if API fails)
                const filtered = (allBookings || []).filter(matchCity).filter(inSelectedMonth);
                const completed = filtered.filter(b => (b.status || "").toLowerCase() === "completed");
                const cancelledBookings = filtered.filter(b => ["cancelled", "rejected"].includes((b.status || "").toLowerCase()));
                const totalRevenue = completed.reduce((s, b) => s + (b.totalAmount || 0), 0);

                setStats((prev) => ({
                    ...prev,
                    totalBookings: filtered.length,
                    activeBookings: filtered.filter(b => ["accepted", "travelling", "arrived", "in_progress"].includes((b.status || "").toLowerCase())).length,
                    totalRevenue,
                    commissionEarned: Math.round(totalRevenue * 0.15),
                    cancellationRate: filtered.length > 0 ? Math.round((cancelledBookings.length / filtered.length) * 100) : 0,
                    customerCount: new Set(filtered.map(b => b.customerId).filter(Boolean)).size,
                    zones: getZones(filtered),
                }));

                // Revenue series fallback (last 6 months ending at selected period)
                const monthKeys = [];
                const endIdx = selectedPeriod.year * 12 + (selectedPeriod.month - 1);
                for (let i = 5; i >= 0; i--) {
                    const idx = endIdx - i;
                    const y = Math.floor(idx / 12);
                    const m = (idx % 12) + 1;
                    monthKeys.push(`${y}-${String(m).padStart(2, "0")}`);
                }
                const map = new Map();
                (allBookings || []).filter(matchCity).filter(b => (b.status || "").toLowerCase() === "completed").forEach(b => {
                    const d = new Date(b.createdAt || Date.now());
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    map.set(key, (map.get(key) || 0) + (b.totalAmount || 0));
                });
                const revSeries = monthKeys.map((key) => {
                    const [y, m] = key.split("-").map(Number);
                    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short" });
                    const revenue = map.get(key) || 0;
                    return { key, month: label, revenue, commission: Math.round(revenue * 0.15) };
                });
                setRevenueSeries(revSeries);

                // Customers series fallback
                const custMap = new Map();
                (allBookings || []).filter(matchCity).forEach((b) => {
                    const d = new Date(b.createdAt || Date.now());
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    if (!monthKeys.includes(key)) return;
                    const cid = b.customerId;
                    if (!cid) return;
                    const set = custMap.get(key) || new Set();
                    set.add(String(cid));
                    custMap.set(key, set);
                });
                setCustomersSeries(monthKeys.map((key) => {
                    const [y, m] = key.split("-").map(Number);
                    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short" });
                    return { key, month: label, customers: (custMap.get(key)?.size || 0) };
                }));

                // Providers series fallback (distinct assignedProvider per month)
                const provMap = new Map();
                (allBookings || []).filter(matchCity).forEach((b) => {
                    const d = new Date(b.createdAt || Date.now());
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    if (!monthKeys.includes(key)) return;
                    const pid = b.assignedProvider;
                    if (!pid) return;
                    const set = provMap.get(key) || new Set();
                    set.add(String(pid));
                    provMap.set(key, set);
                });
                setProvidersSeries(monthKeys.map((key) => {
                    const [y, m] = key.split("-").map(Number);
                    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short" });
                    return { key, month: label, providers: (provMap.get(key)?.size || 0) };
                }));
            }
        })();
        return () => { cancelled = true; };
    }, [isLoggedIn, selectedCity, selectedPeriod.year, selectedPeriod.month, allBookings]);
    const getZones = (bookings) => {
        const zonesMap = {};
        if (Array.isArray(bookings)) {
            bookings.forEach(b => {
                const z = b.address?.area || b.address?.city;
                if (z) {
                    zonesMap[z] = (zonesMap[z] || 0) + 1;
                }
            });
        }

        let zonesArray = Object.entries(zonesMap);
        return zonesArray.sort((a, b) => b[1] - a[1]);
    };

    const statCards = [
        { title: "Total Revenue", value: `₹${(stats.totalRevenue || 0).toLocaleString()}`, icon: IndianRupee, color: "from-indigo-500/20 to-indigo-500/5", iconBg: "bg-indigo-500/20 text-indigo-400", trend: "+18%", up: true },
        { title: "Commission Earned", value: `₹${(stats.commissionEarned || 0).toLocaleString()}`, icon: Percent, color: "from-purple-500/20 to-purple-500/5", iconBg: "bg-purple-500/20 text-purple-400", trend: "+12%", up: true },
        { title: "Total Bookings", value: stats.totalBookings || 0, icon: CalendarRange, color: "from-blue-500/20 to-blue-500/5", iconBg: "bg-blue-500/20 text-blue-400", badge: stats.activeBookings ? `${stats.activeBookings} active` : null },
        { title: "Active SPs", value: stats.activeSPs || 0, icon: Users, color: "from-emerald-500/20 to-emerald-500/5", iconBg: "bg-emerald-500/20 text-emerald-400", badge: stats.pendingSPs ? `${stats.pendingSPs} pending` : null },
        { title: "Vendors", value: stats.totalVendors || 0, icon: Store, color: "from-teal-500/20 to-teal-500/5", iconBg: "bg-teal-500/20 text-teal-400" },
        { title: "Customers", value: stats.customerCount || 0, icon: UserPlus, color: "from-pink-500/20 to-pink-500/5", iconBg: "bg-pink-500/20 text-pink-400", trend: "+25%", up: true },
        { title: "Cancellation Rate", value: `${stats.cancellationRate || 0}%`, icon: TrendingDown, color: "from-red-500/20 to-red-500/5", iconBg: "bg-red-500/20 text-red-400", trend: stats.cancellationRate > 15 ? "High" : "Normal", up: false },
        { title: "SOS Alerts", value: stats.sosAlerts || 0, icon: ShieldAlert, color: stats.sosAlerts > 0 ? "from-red-500/20 to-red-500/5" : "from-green-500/20 to-green-500/5", iconBg: stats.sosAlerts > 0 ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400" },
    ];

    return (
        <div className="space-y-8">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">Admin Dashboard</h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Global overview of stylingwithmuskan</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select
                        value={selectedCity || "__ALL__"}
                        onValueChange={(v) => setSelectedCity(v === "__ALL__" ? "" : v)}
                    >
                        <SelectTrigger className="w-[160px] h-10 rounded-xl">
                            <SelectValue placeholder="Select Zone" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__ALL__">All Cities</SelectItem>
                            {cities.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={`${selectedPeriod.year}-${selectedPeriod.month}`} onValueChange={(v) => { const [y, m] = v.split("-").map(Number); setSelectedPeriod({ year: y, month: m }); }}>
                        <SelectTrigger className="w-[160px] h-10 rounded-xl">
                            <SelectValue placeholder="Month & Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {(() => {
                                const opts = [];
                                const now = new Date();
                                const start = new Date(); start.setMonth(start.getMonth() - 23); // last 24 months
                                for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= new Date(now.getFullYear(), now.getMonth(), 1); d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
                                    const y = d.getFullYear(); const m = d.getMonth() + 1;
                                    const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
                                    opts.push({ value: `${y}-${m}`, label });
                                }
                                return opts.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>));
                            })()}
                        </SelectContent>
                    </Select>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div key={stat.title} variants={item}>
                            <Card className={`border-border/50 shadow-none bg-gradient-to-br ${stat.color} hover:border-primary/30 transition-all duration-300 cursor-default`}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className={`h-9 w-9 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        {stat.trend && (
                                            <span className={`text-[10px] font-black flex items-center gap-0.5 ${stat.up ? "text-green-400" : "text-red-400"}`}>
                                                {stat.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                {stat.trend}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xl font-black tracking-tight">{stat.value}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{stat.title}</p>
                                        {stat.badge && <Badge variant="outline" className="text-[7px] font-black px-1 py-0 h-3.5 border-primary/30 text-primary">{stat.badge}</Badge>}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    );
                })}
            </motion.div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <Card className="border-border/50 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-base font-bold">Revenue & Commission</CardTitle>
                            <CardDescription className="text-xs">Monthly breakdown</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={revenueSeries}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="commission" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                    <Card className="border-border/50 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-base font-bold">Booking Trend</CardTitle>
                            <CardDescription className="text-xs">This week</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={bookingSeries}>
                                    <defs>
                                        <linearGradient id="bookingGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                                    <Area type="monotone" dataKey="bookings" stroke="hsl(var(--primary))" fill="url(#bookingGrad)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
                    <Card className="border-border/50 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-base font-bold">Customers</CardTitle>
                            <CardDescription className="text-xs">Monthly active customers</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={customersSeries}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                                    <Bar dataKey="customers" fill="hsl(var(--primary) / 0.8)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                    <Card className="border-border/50 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-base font-bold">Service Providers</CardTitle>
                            <CardDescription className="text-xs">Monthly active providers</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={providersSeries}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                                    <Bar dataKey="providers" fill="hsl(var(--primary) / 0.5)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Zone Analysis */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="lg:col-span-2">
                    <Card className="border-border/50 shadow-none">
                        <CardHeader className="pb-3 border-b border-border/50">
                            <CardTitle className="text-base font-bold flex items-center gap-2"><MapIcon className="h-4 w-4 text-primary" /> Zone-wise Analysis</CardTitle>
                            <CardDescription className="text-xs">Geographic performance mapping</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
                                {/* Top Zones */}
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-black text-emerald-600">
                                        <div className="p-1.5 rounded-lg bg-emerald-100"><TrendingUp className="h-4 w-4" /></div> Most Active Zones
                                    </div>
                                    <div className="space-y-3">
                                        {stats.zones?.slice(0, 3).map((zone, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs">#{i + 1}</div>
                                                    <span className="text-sm font-bold flex items-center gap-1.5"><MapPin className="h-3 w-3 text-muted-foreground" /> {zone[0]}</span>
                                                </div>
                                                <span className="text-sm font-black">{zone[1]} Bookings</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Low Zones */}
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-black text-red-600">
                                        <div className="p-1.5 rounded-lg bg-red-100"><TrendingDown className="h-4 w-4" /></div> Low-Performing Zones
                                    </div>
                                    <div className="space-y-3">
                                        {stats.zones?.slice(-3).reverse().map((zone, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-black text-xs text-center leading-none">!</div>
                                                    <span className="text-sm font-bold flex items-center gap-1.5"><MapPin className="h-3 w-3 text-muted-foreground" /> {zone[0]}</span>
                                                </div>
                                                <span className="text-sm font-black opacity-70">{zone[1]} Bookings</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
