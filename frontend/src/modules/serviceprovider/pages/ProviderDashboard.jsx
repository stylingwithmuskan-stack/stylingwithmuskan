import React, { useEffect, useState } from "react";

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
    Check
} from "lucide-react";
import { useProviderBookings } from "../contexts/ProviderBookingContext";
import { useProviderAuth } from "../contexts/ProviderAuthContext";
import { api } from "@/modules/user/lib/api";

const ProviderDashboard = () => {
    const { activeBookings, completedBookings, incomingBookings } = useProviderBookings();
    const { provider } = useProviderAuth();
    const [summary, setSummary] = useState(null);
    useEffect(() => {
        let cancelled = false;
        if (provider?.phone) {
            api.provider.summary(provider.phone).then((s) => {
                if (!cancelled) setSummary(s);
            }).catch(() => {});
        }
        return () => { cancelled = true; };
    }, [provider?.phone]);

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

    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const activeJobsCount = activeBookings.length;
    const providerGrade = realRating >= 4.5 ? "Elite Pro" : (realRating >= 4.0 ? "Pro" : "New");

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
        <div className="flex flex-1 w-full flex-col gap-4 md:gap-8 pt-4 md:pt-0">
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

            <div className="flex items-center gap-4 px-1">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900">Dashboard Overview</h1>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 px-1 md:px-0">
                <Card x-chunk="dashboard-01-chunk-0" className="rounded-[24px] border-none shadow-sm shadow-violet-100/50 bg-gradient-to-br from-white to-purple-50/30">
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

                <Card x-chunk="dashboard-01-chunk-1" className="rounded-[24px] border-none shadow-sm shadow-violet-100/50 bg-gradient-to-br from-white to-blue-50/30">
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

                <Card x-chunk="dashboard-01-chunk-2" className="rounded-[24px] border-none shadow-sm shadow-violet-100/50 bg-gradient-to-br from-white to-orange-50/30">
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

                <Card x-chunk="dashboard-01-chunk-3" className="rounded-[24px] border-none shadow-sm shadow-violet-100/50 bg-gradient-to-br from-white to-yellow-50/30 ring-1 ring-yellow-100/50">
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

            <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
                <Card className="xl:col-span-2" x-chunk="dashboard-01-chunk-4">
                    <CardHeader className="flex flex-row items-center">
                        <div className="grid gap-2">
                            <CardTitle>Recent Leads</CardTitle>
                            <CardDescription>
                                New job opportunities in your area.
                            </CardDescription>
                        </div>
                        <Button asChild size="sm" className="ml-auto gap-1 bg-purple-600 hover:bg-purple-700 text-white">
                            <Link to="/provider/bookings">
                                View All
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {incomingBookings.length > 0 ? incomingBookings.slice(0, 3).map((job, i) => (
                                <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                    <div className="flex flex-col gap-1 w-full max-w-[200px]">
                                        <span className="font-semibold text-sm truncate">{job.items?.[0]?.name || job.services?.[0]?.name || "Service Booking"}</span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                            {job.address?.area || job.address?.city} • {new Date(job.createdAt).toLocaleDateString()}
                                        </span>
                                        {(!job.customerBookingCount || job.customerBookingCount <= 1) ? (
                                            <span className="text-[9px] w-fit font-black uppercase px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200 mt-1">
                                                Newly
                                            </span>
                                        ) : (
                                            <span className="text-[9px] w-fit font-black uppercase px-2 py-0.5 flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 mt-1">
                                                <Check className="w-2.5 h-2.5" /> Verified Customer
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-sm font-medium whitespace-nowrap">₹{job.totalAmount}</span>
                                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">New Job</Badge>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-6 text-sm text-gray-400 font-medium">
                                    No new job requests assigned yet.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card x-chunk="dashboard-01-chunk-5">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white justify-start" size="lg">
                            <Wallet className="mr-2 h-4 w-4" /> Buy Credits (₹500 / 1000)
                        </Button>
                        <Button variant="outline" className="w-full justify-start" size="lg" asChild>
                            <Link to="/provider/availability">
                                <Clock className="mr-2 h-4 w-4 text-purple-600" /> Update Today's Availability
                            </Link>
                        </Button>
                        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 mt-2 border-l-4 border-l-red-500 flex flex-col gap-2">
                            <div className="font-semibold text-sm flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-red-500 shrink-0" /> Alert
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Your cancellation rate is slightly high. Please fulfill the next 3 booked jobs to avoid a penalty limit.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ProviderDashboard;
