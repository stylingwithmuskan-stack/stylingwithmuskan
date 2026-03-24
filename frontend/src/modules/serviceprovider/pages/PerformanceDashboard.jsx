import React, { useEffect, useMemo, useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/modules/user/components/ui/card";
import { Progress } from "@/modules/user/components/ui/progress";
import { Badge } from "@/modules/user/components/ui/badge";
import { Button } from "@/modules/user/components/ui/button";
import { 
    AlertCircle, Star, XCircle, Clock, ShieldCheck, PauseCircle, 
    Briefcase, DownloadIcon, MoreVerticalIcon, AwardIcon, TrendingUp, TrendingDown, Zap 
} from "lucide-react";
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { Link } from "react-router-dom";
import { useProviderAuth } from "../contexts/ProviderAuthContext";
import { api } from "@/modules/user/lib/api";
import { motion } from "framer-motion";

export default function PerformanceDashboard() {
    const { provider } = useProviderAuth();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        let cancel = false;
        const run = async () => {
            if (!provider?.phone) return;
            setLoading(true);
            setError("");
            try {
                const s = await api.provider.summary(provider.phone);
                if (!cancel) setSummary(s);
            } catch {
                if (!cancel) setError("Failed to load performance");
            } finally {
                if (!cancel) setLoading(false);
            }
        };
        run();
        return () => { cancel = true; };
    }, [provider?.phone]);
    const metrics = useMemo(() => ({
        rating: summary?.provider?.rating ?? 0,
        responseRate: summary?.performance?.responseRate ?? 0,
        cancellations: summary?.performance?.cancellations ?? 0,
        grade: summary?.performance?.grade ?? "N/A",
        isActive: provider?.approvalStatus === "approved",
        weeklyTrend: summary?.performance?.weeklyTrend ?? [],
    }), [summary, provider?.approvalStatus]);

    const isPaused = (metrics.rating < 4.7 && metrics.rating > 0) || !metrics.isActive;

    return (
        <div className="flex flex-1 w-full flex-col gap-6 pt-4 md:pt-0">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Performance & Compliance</h1>
                <p className="text-muted-foreground">Track your metrics and ensure adherence to UC standards.</p>
            </div>

            {isPaused && (
                <div className="rounded-lg border bg-destructive/10 text-destructive border-destructive p-4 flex gap-4 items-start shadow-sm">
                    <PauseCircle className="h-5 w-5 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-semibold tracking-tight">Jobs Paused</h3>
                        <p className="text-sm mt-1 whitespace-pre-wrap">
                            Your profile is currently paused from receiving new leads because your rating has fallen below 4.7. You must complete a refresher training module to reactivate your dashboard.
                        </p>
                    </div>
                </div>
            )}

            {metrics.cancellations > 3 && (
                <div className="rounded-lg border bg-white p-4 flex flex-col items-center justify-between shadow-sm sm:flex-row gap-4 border-gray-100">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-bold text-[#b94a2a] uppercase flex items-center gap-1">
                            <XCircle className="h-4 w-4" /> HIGH CANCELLATIONS
                        </h3>
                        <p className="text-sm text-gray-700">
                            Complete training & do not cancel jobs
                        </p>
                    </div>
                    <Button className="bg-[#5944d1] hover:bg-[#4331a6] text-white w-full sm:w-auto h-10 px-6 rounded-lg text-sm font-medium">
                        Details
                    </Button>
                </div>
            )}

            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                {/* Rating - Hero Metric with Interactive Circular Progress */}
                <div className="col-span-2 lg:col-span-3 flex flex-col items-center justify-center py-10">
                    <div className="relative flex items-center justify-center w-56 h-56">
                        {/* SVG Circular Progress Bar */}
                        <svg className="w-56 h-56 transform -rotate-90">
                            {/* Background Track */}
                            <circle
                                cx="112"
                                cy="112"
                                r="100"
                                fill="none"
                                stroke="#f3f4f6"
                                strokeWidth="10"
                            />
                            {/* Color-coded Progress Stroke */}
                            <circle
                                cx="112"
                                cy="112"
                                r="100"
                                fill="none"
                                stroke={metrics.rating >= 4.7 ? "#22c55e" : "#ef4444"}
                                strokeWidth="14"
                                strokeDasharray="628.3"
                                strokeDashoffset={628.3 - (628.3 * metrics.rating) / 5}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-in-out drop-shadow-sm"
                            />
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center translate-y-[-4px]">
                            <h2 className="text-5xl font-extrabold tracking-tight text-slate-900">{metrics.rating.toFixed(2)}</h2>
                            <div className="flex items-center justify-center gap-1 text-sm font-bold mt-1 text-slate-500">
                                Rating <span className="text-slate-400 font-bold">&gt;</span>
                            </div>
                        </div>

                        {/* Floating Status Badge mimicking image */}
                        <div className="absolute -bottom-5 bg-[#334155] backdrop-blur-md text-white rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl border border-white/10">
                            <AwardIcon className="h-5 w-5 text-slate-300" />
                            <div className="flex flex-col items-center">
                                <Star className={`h-5 w-5 fill-white ${metrics.rating >= 4.7 ? "text-green-400" : "text-red-400"}`} />
                                <span className="text-[10px] uppercase font-black mt-0.5 tracking-wider">Min: 4.7</span>
                            </div>
                            <MoreVerticalIcon className="h-5 w-5 text-slate-300" />
                        </div>
                    </div>
                </div>

                {/* Weekend Hours Metric */}
                <Card className="shadow-sm border-gray-200">
                    <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between space-y-0">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-gray-700" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-4 px-4">
                        <div className="text-2xl font-bold mt-2">{loading ? "…" : `${summary?.calendar?.availableHoursWeek ?? 0} hrs`}</div>
                        <p className="text-xs text-muted-foreground mt-1">Weekend hours</p>
                    </CardContent>
                </Card>

                {/* Cancellations */}
                <Card className="shadow-sm border-red-200 bg-red-50/10">
                    <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between space-y-0">
                        <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <XCircle className="h-4 w-4 text-red-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-4 px-4">
                        <div className="text-2xl font-bold mt-2">{loading ? "…" : metrics.cancellations}</div>
                        <p className="text-xs text-muted-foreground mt-1">Cancellations</p>
                    </CardContent>
                </Card>

                {/* Response Rate Metric */}
                <Card className="shadow-sm border-gray-200">
                    <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between space-y-0">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <DownloadIcon className="h-4 w-4 text-gray-700" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-4 px-4">
                        <div className="text-2xl font-bold mt-2">{loading ? "…" : `${metrics.responseRate}%`}</div>
                        <p className="text-xs text-muted-foreground mt-1">Response rate</p>
                    </CardContent>
                </Card>

                {/* Overall Grade Usage */}
                <Card className="shadow-sm border-gray-200">
                    <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between space-y-0">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <AwardIcon className="h-4 w-4 text-gray-700" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-4 px-4">
                        <div className="text-2xl font-bold mt-2 text-purple-600">{loading ? "…" : metrics.grade}</div>
                        <p className="text-xs text-muted-foreground mt-1">Overall Grade</p>
                    </CardContent>
                </Card>

                {/* Weekly Performance Trend Section */}
                <div className="col-span-2 lg:col-span-3 mt-4">
                    <Card className="shadow-md border-slate-100 overflow-hidden bg-white rounded-3xl">
                        <CardHeader className="bg-slate-50/30 border-b border-slate-100/50 pb-6 pt-7 px-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-purple-100 rounded-lg">
                                            <TrendingUp className="h-4 w-4 text-purple-600" />
                                        </div>
                                        <CardTitle className="text-lg font-black tracking-tight text-slate-900">Weekly Performance Trend</CardTitle>
                                    </div>
                                    <CardDescription className="text-xs font-medium text-slate-500">Live efficiency & satisfaction tracking</CardDescription>
                                </div>
                                <div className="bg-slate-900 text-white rounded-2xl px-5 py-3 shadow-xl shadow-slate-200 flex items-center gap-4 shrink-0 transition-transform hover:scale-105 duration-300">
                                    <div className="text-right border-r border-white/10 pr-4">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Current Rank</p>
                                        <span className="text-xl font-black text-white italic tracking-tighter">#Top 5%</span>
                                    </div>
                                    <Zap className="h-5 w-5 text-amber-400 fill-amber-400 animate-pulse" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6 overflow-hidden">
                            {/* Interactive Performance Graph */}
                            <div className="h-[280px] w-full mt-6 bg-white relative px-2 sm:px-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart 
                                        data={[
                                            { day: "Mon", score: 72, quality: 85, jobs: 4 },
                                            { day: "Tue", score: 85, quality: 90, jobs: 6 },
                                            { day: "Wed", score: 68, quality: 78, jobs: 3 },
                                            { day: "Thu", score: 94, quality: 96, jobs: 8 },
                                            { day: "Fri", score: 88, quality: 92, jobs: 7 },
                                            { day: "Sat", score: 98, quality: 99, jobs: 12 },
                                            { day: "Sun", score: 90, quality: 92, jobs: 9 },
                                        ]}
                                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#c084fc" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="day" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                                            dy={10}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                            domain={[0, 100]}
                                        />
                                        <Tooltip 
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-2xl backdrop-blur-md">
                                                            <p className="text-white font-black text-xs uppercase tracking-widest mb-3 border-b border-white/10 pb-2">{label}</p>
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between gap-6">
                                                                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tight">Efficiency</span>
                                                                    <span className="text-purple-400 font-black text-xs">{payload[0].value}%</span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-6">
                                                                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tight">Quality Score</span>
                                                                    <span className="text-emerald-400 font-black text-xs">{payload[0].payload.quality}%</span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-6 pt-1">
                                                                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tight">Jobs Done</span>
                                                                    <span className="text-amber-400 font-black text-xs underline decoration-2">{payload[0].payload.jobs}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="score" 
                                            stroke="#8b5cf6" 
                                            strokeWidth={4} 
                                            fillOpacity={1} 
                                            fill="url(#colorScore)" 
                                            animationDuration={2000}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="mt-8 px-6 pb-6 grid grid-cols-2 gap-4">
                                <motion.div 
                                    whileHover={{ y: -5 }}
                                    className="bg-emerald-50/50 p-5 rounded-[24px] border border-emerald-100 relative overflow-hidden group"
                                >
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Clock className="h-10 w-10 text-emerald-600" />
                                    </div>
                                    <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest leading-none mb-3">Avg Response Time</p>
                                    <p className="text-2xl font-black text-emerald-900">12 Mins</p>
                                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-600 font-black bg-emerald-100/50 w-fit px-2 py-0.5 rounded-full">
                                        <TrendingDown className="h-3 w-3" /> 4 mins faster
                                    </div>
                                </motion.div>
                                <motion.div 
                                    whileHover={{ y: -5 }}
                                    className="bg-purple-50/50 p-5 rounded-[24px] border border-purple-100 relative overflow-hidden group"
                                >
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Briefcase className="h-10 w-10 text-purple-600" />
                                    </div>
                                    <p className="text-[10px] text-purple-600 font-black uppercase tracking-widest leading-none mb-3">Job Conversion</p>
                                    <p className="text-2xl font-black text-purple-900">92%</p>
                                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-purple-600 font-black bg-purple-100/50 w-fit px-2 py-0.5 rounded-full">
                                        <TrendingUp className="h-3 w-3" /> 5% Increase
                                    </div>
                                </motion.div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Detailed Compliance/Badges */}
                    <Card className="shadow-sm border-purple-200 bg-purple-50/30 mt-6 overflow-hidden">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-md">
                                <ShieldCheck className="h-5 w-5 text-purple-600" /> Professional Standards
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="bg-white rounded-xl p-4 border border-slate-100 flex items-center gap-4 shadow-sm">
                                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                    <AwardIcon className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-slate-900">Punctuality Legend</p>
                                    <p className="text-[11px] text-slate-500">You reached 100% of jobs on time this week.</p>
                                </div>
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Active</Badge>
                            </div>

                            <div className="bg-white rounded-xl p-4 border border-slate-100 flex items-center gap-4 shadow-sm">
                                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                                    <AlertCircle className="h-5 w-5 text-destructive" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-slate-900">Customer Feedback</p>
                                    <p className="text-[11px] text-slate-500">1 complaint recorded regarding start time delay.</p>
                                </div>
                                <Badge variant="outline" className="text-destructive border-destructive ml-auto">Review</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
