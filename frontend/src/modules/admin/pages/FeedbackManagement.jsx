import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    MessageSquare, Star, Search, RefreshCw, Filter, TrendingUp,
    ThumbsUp, ThumbsDown, User, Users, Tag, Eye, Trash2, BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/modules/user/components/ui/tabs";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export default function FeedbackManagement() {
    const { getFeedback, getFeedbackStats, deleteFeedback: deleteFeedbackAPI } = useAdminAuth();
    const [feedbacks, setFeedbacks] = useState([]);
    const [stats, setStats] = useState(null);
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("all");
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const [feedbackData, statsData] = await Promise.all([
                getFeedback(),
                getFeedbackStats(),
            ]);
            setFeedbacks(Array.isArray(feedbackData) ? feedbackData : []);
            setStats(statsData || null);
        } catch (error) {
            toast.error(error?.message || "Failed to load feedback");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this feedback?")) return;
        try {
            await deleteFeedbackAPI(id);
            toast.success("Feedback deleted successfully");
            await load();
        } catch (error) {
            toast.error(error?.message || "Failed to delete feedback");
        }
    };

    // Stats from backend
    const totalFeedback = stats?.totalReviews || 0;
    const avgRating = stats?.avgRating || "0.0";
    const customerToSP = stats?.customerToSP || 0;
    const spToCustomer = stats?.spToCustomer || 0;
    const positiveCount = stats?.positiveCount || 0;
    const serviceAnalysis = stats?.serviceAnalysis || [];
    const topTags = stats?.topTags || [];

    // Filter
    const filtered = feedbacks.filter(f => {
        const matchesSearch = f.customerName?.toLowerCase().includes(search.toLowerCase()) ||
            f.providerName?.toLowerCase().includes(search.toLowerCase()) ||
            f.serviceName?.toLowerCase().includes(search.toLowerCase()) ||
            f.bookingId?.toLowerCase().includes(search.toLowerCase()) ||
            f.comment?.toLowerCase().includes(search.toLowerCase());

        if (tab === "customer") return matchesSearch && f.type === "customer_to_provider";
        if (tab === "provider") return matchesSearch && f.type === "provider_to_customer";
        if (tab === "positive") return matchesSearch && f.rating >= 4;
        if (tab === "negative") return matchesSearch && f.rating <= 2;
        return matchesSearch;
    });

    const renderStars = (rating) => (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`w-3.5 h-3.5 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
            ))}
        </div>
    );

    if (loading) {
        return (
            <div className="p-8 text-sm font-semibold text-muted-foreground">
                Loading feedback data...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                        <MessageSquare className="h-7 w-7 text-primary" /> Feedback Management
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Review & analyze customer and provider feedback</p>
                </div>
                <Button onClick={load} variant="outline" className="gap-2 rounded-xl font-bold">
                    <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
            </motion.div>

            {/* Stats Cards */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: "Total Reviews", val: totalFeedback, color: "bg-blue-50 text-blue-600 border-blue-200", icon: MessageSquare },
                    { label: "Avg Rating", val: `${avgRating} ★`, color: "bg-amber-50 text-amber-600 border-amber-200", icon: Star },
                    { label: "Customer → SP", val: customerToSP, color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: User },
                    { label: "SP → Customer", val: spToCustomer, color: "bg-purple-50 text-purple-600 border-purple-200", icon: Users },
                    { label: "Positive (4+)", val: positiveCount, color: "bg-green-50 text-green-600 border-green-200", icon: ThumbsUp },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}
                        className={`rounded-xl p-3 border ${s.color}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <s.icon className="h-3 w-3 opacity-60" />
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{s.label}</p>
                        </div>
                        <p className="text-xl font-black">{s.val}</p>
                    </motion.div>
                ))}
            </motion.div>

            {/* Service-wise Analysis & Tags */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-border/50 shadow-none">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-black flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" /> Service-wise Rating Analysis
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {serviceAnalysis.length > 0 ? (
                            <div className="space-y-2">
                                {serviceAnalysis.map((svc) => (
                                    <div key={svc.name} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold truncate">{svc.name}</p>
                                            <p className="text-[10px] text-muted-foreground font-medium">{svc.count} review{svc.count > 1 ? "s" : ""}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(parseFloat(svc.avg) / 5) * 100}%` }} />
                                            </div>
                                            <span className="text-xs font-black text-amber-600 w-8 text-right">{svc.avg}★</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground text-center py-6">No feedback data for analysis yet</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-border/50 shadow-none">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-black flex items-center gap-2">
                            <Tag className="h-4 w-4 text-primary" /> Most Used Tags
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {topTags.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {topTags.map(({ tag, count }) => (
                                    <div key={tag} className="flex items-center gap-1.5 bg-primary/5 border border-primary/10 rounded-full px-3 py-1.5">
                                        <span className="text-xs font-bold text-primary">{tag}</span>
                                        <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground text-center py-6">No tags collected yet</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Feedback List */}
            <Tabs value={tab} onValueChange={setTab}>
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                    <TabsList className="bg-muted/30 rounded-xl p-1 flex-wrap h-auto">
                        <TabsTrigger value="all" className="rounded-lg text-xs font-bold">All</TabsTrigger>
                        <TabsTrigger value="customer" className="rounded-lg text-xs font-bold">Customer → SP</TabsTrigger>
                        <TabsTrigger value="provider" className="rounded-lg text-xs font-bold">SP → Customer</TabsTrigger>
                        <TabsTrigger value="positive" className="rounded-lg text-xs font-bold">Positive</TabsTrigger>
                        <TabsTrigger value="negative" className="rounded-lg text-xs font-bold">Negative</TabsTrigger>
                    </TabsList>
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search feedback..." value={search} onChange={e => setSearch(e.target.value)}
                            className="pl-9 rounded-xl h-10 bg-muted/30 border-border/50" />
                    </div>
                </div>

                <TabsContent value={tab} className="mt-0">
                    {filtered.length === 0 ? (
                        <Card className="border-border/50"><CardContent className="py-16 text-center">
                            <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-sm font-bold text-muted-foreground">No feedback found</p>
                            <p className="text-xs text-muted-foreground mt-1">Feedback will appear here after bookings are completed</p>
                        </CardContent></Card>
                    ) : (
                        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                            {filtered.map(f => (
                                <motion.div key={f._id} variants={item}>
                                    <Card className="border-border/50 shadow-none hover:border-primary/30 transition-all">
                                        <CardContent className="p-4">
                                            <div className="flex flex-col md:flex-row md:items-center gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                        <Badge variant="outline" className={`text-[8px] font-black px-1.5 py-0 h-4 border-0 ${f.type === "customer_to_provider" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"}`}>
                                                            {f.type === "customer_to_provider" ? "Customer → SP" : "SP → Customer"}
                                                        </Badge>
                                                        {renderStars(f.rating)}
                                                        <span className="text-[10px] font-black text-muted-foreground">#{f.bookingId}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm">
                                                        <span className="font-bold flex items-center gap-1">
                                                            <User className="h-3 w-3 text-muted-foreground" />
                                                            {f.type === "customer_to_provider" ? f.customerName : f.providerName}
                                                        </span>
                                                        <span className="text-muted-foreground text-xs">→</span>
                                                        <span className="font-bold flex items-center gap-1">
                                                            <Users className="h-3 w-3 text-muted-foreground" />
                                                            {f.type === "customer_to_provider" ? f.providerName : f.customerName}
                                                        </span>
                                                    </div>
                                                    {f.comment && (
                                                        <p className="text-xs text-muted-foreground mt-1.5 italic">"{f.comment}"</p>
                                                    )}
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {(f.tags || []).map((t, i) => (
                                                            <span key={i} className="text-[9px] font-bold bg-primary/5 text-primary px-2 py-0.5 rounded-full">{t}</span>
                                                        ))}
                                                        <span className="text-[9px] font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                                            {f.serviceName}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className={`text-2xl font-black ${f.rating >= 4 ? "text-green-500" : f.rating <= 2 ? "text-red-500" : "text-amber-500"}`}>
                                                        {f.rating}.0
                                                    </span>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(f._id)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                                                <span>{new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                <div className="flex items-center gap-1">
                                                    {f.rating >= 4 ? <ThumbsUp className="h-3 w-3 text-green-500" /> : f.rating <= 2 ? <ThumbsDown className="h-3 w-3 text-red-500" /> : null}
                                                    <span className={f.rating >= 4 ? "text-green-600 font-bold" : f.rating <= 2 ? "text-red-600 font-bold" : ""}>
                                                        {f.rating >= 4 ? "Positive" : f.rating <= 2 ? "Needs Improvement" : "Neutral"}
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
