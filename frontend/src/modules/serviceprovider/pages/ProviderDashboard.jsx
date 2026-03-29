import React, { useEffect, useState, useMemo } from "react";

import { Link } from "react-router-dom";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/user/components/ui/select";
import {
    ArrowUpRight,
    TrendingUp,
    CreditCard,
    UserCheck,
    Star,
    Clock,
    Wallet,
    CalendarDays,
    IndianRupee,
    Briefcase,
    Award,
    Check,
    MapPin,
    Filter,
    BarChart3,
    RefreshCw
} from "lucide-react";
import { useProviderBookings } from "../contexts/ProviderBookingContext";
import { useProviderAuth } from "../contexts/ProviderAuthContext";
import { api } from "@/modules/user/lib/api";
import { toast } from "sonner";

const ProviderDashboard = () => {
    const { activeBookings, completedBookings, incomingBookings, refreshBookings } = useProviderBookings();
    const { provider } = useProviderAuth();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedZone, setSelectedZone] = useState("all");

    const loadSummary = async () => {
        if (!provider?.phone) return;
        setLoading(true);
        try {
            const s = await api.provider.summary(provider.phone);
            setSummary(s);
        } catch (err) {
            console.error("Failed to load summary:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSummary();
    }, [provider?.phone]);

    const handleRefresh = async () => {
        setLoading(true);
        try {
            await Promise.all([refreshBookings(), loadSummary()]);
            toast.success("Dashboard refreshed");
        } catch {
            toast.error("Refresh failed");
        } finally {
            setLoading(false);
        }
    };

    const [realRating, setRealRating] = useState(provider?.rating || 4.5);

    useEffect(() => {
        const feedback = JSON.parse(localStorage.getItem('muskan-feedback') || '[]');
        const spFeedback = feedback.filter(f =>
            (f.providerName === provider?.name || f.assignedProvider === provider?.id) &&
            f.type === 'customer_to_provider'
        );

        if (spFeedback.length > 0) {
            const sum = spFeedback.reduce((a, b) => a + b.rating, 0);
            setRealRating(sum / spFeedback.length);
        }
    }, [provider]);

    // Filtering logic
    const filteredIncoming = useMemo(() => {
        if (selectedZone === "all") return incomingBookings;
        return incomingBookings.filter(b => b.address?.area === selectedZone);
    }, [incomingBookings, selectedZone]);

    const filteredActive = useMemo(() => {
        if (selectedZone === "all") return activeBookings;
        return activeBookings.filter(b => b.address?.area === selectedZone);
    }, [activeBookings, selectedZone]);

    const filteredCompleted = useMemo(() => {
        if (selectedZone === "all") return completedBookings;
        return completedBookings.filter(b => b.address?.area === selectedZone);
    }, [completedBookings, selectedZone]);

    const totalRevenue = filteredCompleted.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const activeJobsCount = filteredActive.length;
    const providerGrade = realRating >= 4.5 ? "Elite Pro" : (realRating >= 4.0 ? "Pro" : "New");

    // Heatmap data
    const heatmap = useMemo(() => {
        const counts = {};
        (provider?.zones || []).forEach(z => counts[z] = 0);
        [...incomingBookings, ...activeBookings, ...completedBookings].forEach(b => {
            const area = b.address?.area;
            if (area && counts.hasOwnProperty(area)) counts[area]++;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [provider?.zones, incomingBookings, activeBookings, completedBookings]);

    const maxBookings = Math.max(...heatmap.map(x => x[1]), 1);

    const nextDates = React.useMemo(() => {
        const fmt = (date) =>
            date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const d1 = new Date();
        d1.setDate(d1.getDate() + 1);
        const d2 = new Date();
        d2.setDate(d2.getDate() + 2);
        return [fmt(d1), fmt(d2)];
    }, []);

    const availableHours = summary?.calendar?.availableHoursToday ?? null;

    return (
        <div className="flex flex-1 w-full flex-col gap-4 md:gap-8 pt-4 md:pt-0 pb-20">
            {/* Header with Zone Filter */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-[24px] shadow-sm shadow-violet-100 border border-violet-50">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black tracking-tight text-gray-900">Dashboard</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg py-1 px-3">
                            <MapPin className="h-3 w-3 mr-1" /> {provider?.city || "Your City"}
                        </Badge>
                        <div className="flex gap-1">
                            {(provider?.zones || []).map(z => (
                                <Badge key={z} variant="outline" className="text-violet-600 border-violet-200 bg-white rounded-lg text-[10px]">
                                    {z}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                        <Filter className="h-4 w-4 text-slate-400 ml-2" />
                        <Select value={selectedZone} onValueChange={setSelectedZone}>
                            <SelectTrigger className="w-[160px] h-9 border-none bg-transparent focus:ring-0 font-bold text-xs">
                                <SelectValue placeholder="All Zones" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-violet-100">
                                <SelectItem value="all" className="font-bold text-xs">All My Zones</SelectItem>
                                {(provider?.zones || []).map(z => (
                                    <SelectItem key={z} value={z} className="font-bold text-xs">{z}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" size="icon" className={`rounded-xl h-12 w-12 transition-all ${loading ? 'animate-spin border-violet-500 text-violet-600' : 'hover:border-violet-500 hover:text-violet-600'}`} onClick={handleRefresh}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Calendar Bar */}
            <div className="bg-white rounded-[20px] p-4 shadow-sm shadow-violet-100 flex items-center justify-between border border-violet-50 mx-1 md:mx-0">
                <div className="flex gap-8">
                    <div>
                        <p className="font-extrabold text-[13px] sm:text-sm text-gray-900 tracking-tight">{nextDates[0]}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className="h-1 w-1 bg-green-500 rounded-full"></div>
                            <span className="text-[9px] font-black tracking-widest text-green-600 uppercase">{availableHours ? "Available" : "Check"}</span>
                        </div>
                    </div>
                    <div>
                        <p className="font-extrabold text-[13px] sm:text-sm text-gray-900 tracking-tight">{nextDates[1]}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className="h-1 w-1 bg-green-500 rounded-full"></div>
                            <span className="text-[9px] font-black tracking-widest text-green-600 uppercase">{availableHours ? "Available" : "Check"}</span>
                        </div>
                    </div>
                </div>
                <Link to="/provider/availability" className="h-10 w-10 flex items-center justify-center bg-gray-50 text-gray-600 rounded-[12px] hover:bg-violet-50 hover:text-violet-600 transition-colors">
                    <CalendarDays className="h-5 w-5" />
                </Link>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 px-1 md:px-0">
                <Card className="rounded-[24px] border-none shadow-sm shadow-violet-100/50 bg-gradient-to-br from-white to-purple-50/30">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col gap-3">
                            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                                <IndianRupee className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">₹{totalRevenue.toLocaleString()}</div>
                                <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Revenue</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[24px] border-none shadow-sm shadow-violet-100/50 bg-gradient-to-br from-white to-blue-50/30">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <Briefcase className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">{activeJobsCount}</div>
                                <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Active Jobs</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[24px] border-none shadow-sm shadow-violet-100/50 bg-gradient-to-br from-white to-orange-50/30">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col gap-3">
                            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                                <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                                    {availableHours !== null ? `${availableHours}h` : "--"}
                                </div>
                                <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Availability</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[24px] border-none shadow-sm shadow-violet-100/50 bg-gradient-to-br from-white to-yellow-50/30 ring-1 ring-yellow-100/50">
                    <CardContent className="p-4 sm:p-6 relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 opacity-10">
                            <Star className="h-24 w-24 text-yellow-500 fill-yellow-500" />
                        </div>
                        <div className="flex flex-col gap-3 relative z-10">
                            <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                                <Award className="h-5 w-5 text-yellow-600" />
                            </div>
                            <div>
                                <div className="text-xl sm:text-2xl font-black text-yellow-600 tracking-tight">{providerGrade}</div>
                                <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Grade</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
                {/* Zone Activity Heatmap */}
                <Card className="lg:col-span-1 border-none shadow-sm shadow-violet-100">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-violet-700">
                            <BarChart3 className="h-5 w-5" />
                            Zone Activity
                        </CardTitle>
                        <CardDescription className="text-xs">Jobs in your assigned areas</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-5">
                            {heatmap.length > 0 ? heatmap.map(([zone, count]) => (
                                <div key={zone} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                                        <span className="text-slate-400">{zone}</span>
                                        <span className="text-violet-600">{count} jobs</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(count / maxBookings) * 100}%` }}
                                            transition={{ duration: 1, ease: "easeOut" }}
                                            className="h-full bg-gradient-to-r from-violet-400 to-purple-600 rounded-full"
                                        />
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-10 opacity-30">
                                    <MapPin className="h-10 w-10 mx-auto mb-2 text-slate-400" />
                                    <p className="text-xs font-bold">No zone data yet</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Leads */}
                <Card className="lg:col-span-2 border-none shadow-sm shadow-violet-100">
                    <CardHeader className="flex flex-row items-center">
                        <div className="grid gap-1">
                            <CardTitle className="text-lg font-bold">Recent Leads</CardTitle>
                            <CardDescription className="text-xs">
                                {selectedZone === "all" ? "Opportunities in all your areas" : `New jobs in ${selectedZone}`}
                            </CardDescription>
                        </div>
                        <Button asChild size="sm" variant="ghost" className="ml-auto gap-1 text-violet-600 hover:bg-violet-50 font-bold">
                            <Link to="/provider/bookings">
                                View All
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {filteredIncoming.length > 0 ? filteredIncoming.slice(0, 4).map((job, i) => (
                                <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                                    <div className="flex flex-col gap-1 w-full max-w-[200px]">
                                        <span className="font-bold text-sm truncate text-slate-800">{job.items?.[0]?.name || job.services?.[0]?.name || "Service Booking"}</span>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[8px] font-black uppercase text-violet-500 border-violet-100 px-1.5 h-4">
                                                {job.address?.area}
                                            </Badge>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                {new Date(job.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-sm font-black text-slate-900">₹{job.totalAmount}</span>
                                        <Button size="sm" className="h-8 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-black px-3">
                                            Details
                                        </Button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-12">
                                    <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Clock className="h-6 w-6 text-slate-300" />
                                    </div>
                                    <p className="text-sm text-slate-400 font-bold">No new leads in this area</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-sm shadow-violet-100 overflow-hidden">
                <CardHeader className="bg-slate-50/50">
                    <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                    <Button className="h-14 bg-violet-600 hover:bg-violet-700 text-white justify-start rounded-2xl shadow-lg shadow-violet-100" size="lg">
                        <Wallet className="mr-3 h-5 w-5" /> 
                        <div>
                            <p className="text-xs font-black uppercase text-white/70 tracking-widest text-left">Wallet</p>
                            <p className="font-bold">Buy Credits (₹500 / 1000)</p>
                        </div>
                    </Button>
                    <Button variant="outline" className="h-14 justify-start rounded-2xl border-violet-100 hover:bg-violet-50 group" size="lg" asChild>
                        <Link to="/provider/availability">
                            <Clock className="mr-3 h-5 w-5 text-violet-600 group-hover:scale-110 transition-transform" />
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-left">Calendar</p>
                                <p className="font-bold text-slate-700">Update Availability</p>
                            </div>
                        </Link>
                    </Button>
                    <div className="rounded-2xl border bg-red-50/50 p-4 border-l-4 border-l-red-500 flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                        <div className="font-black text-[10px] uppercase tracking-widest text-red-600 flex items-center gap-2">
                            <TrendingUp className="h-3.5 w-3.5" /> Performance Alert
                        </div>
                        <p className="text-[11px] text-red-700/80 font-bold leading-relaxed">
                            Your cancellation rate is slightly high. Please fulfill the next 3 booked jobs to avoid a penalty limit.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ProviderDashboard;
