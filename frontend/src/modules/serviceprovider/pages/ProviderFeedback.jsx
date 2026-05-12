import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessageSquare, Star, TrendingUp, Users, Search,
    ArrowLeft, BarChart3, FilterX, Sparkles
} from "lucide-react";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { useProviderAuth } from "@/modules/serviceprovider/contexts/ProviderAuthContext";
import { api } from "@/modules/user/lib/api";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function ProviderFeedback() {
    const navigate = useNavigate();
    const { provider } = useProviderAuth();
    const [feedback, setFeedback] = useState([]);
    const [search, setSearch] = useState("");
    const [ratingFilter, setRatingFilter] = useState("all");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFeedback = async () => {
            try {
                setLoading(true);
                const res = await api.provider.getFeedback();
                setFeedback(res.feedback || []);
            } catch (error) {
                console.error("Failed to fetch feedback:", error);
            } finally {
                setLoading(false);
            }
        };

        if (provider) fetchFeedback();
    }, [provider]);

    const stats = useMemo(() => {
        if (!feedback.length) return null;
        const customerFeedback = feedback.filter(f => f.type === "customer_to_provider");
        const avgRating = customerFeedback.reduce((acc, curr) => acc + curr.rating, 0) / (customerFeedback.length || 1);

        const tagCloud = {};
        customerFeedback.forEach(f => {
            f.tags?.forEach(tag => {
                tagCloud[tag] = (tagCloud[tag] || 0) + 1;
            });
        });

        return {
            total: feedback.length,
            customerReviews: customerFeedback.length,
            avgRating: avgRating.toFixed(1),
            highRated: customerFeedback.filter(f => f.rating >= 4).length,
            topTags: Object.entries(tagCloud).sort((a, b) => b[1] - a[1]).slice(0, 5)
        };
    }, [feedback]);

    const filteredFeedback = feedback.filter(f => {
        const matchesSearch =
            f.customerName?.toLowerCase().includes(search.toLowerCase()) ||
            f.comment?.toLowerCase().includes(search.toLowerCase()) ||
            f.serviceName?.toLowerCase().includes(search.toLowerCase());

        const matchesRating = ratingFilter === "all" ||
            (ratingFilter === "positive" && f.rating >= 4) ||
            (ratingFilter === "neutral" && f.rating === 3) ||
            (ratingFilter === "negative" && f.rating <= 2);

        return matchesSearch && matchesRating;
    });

    return (
        <div className="flex flex-1 w-full flex-col gap-6 pt-4 md:pt-0 pb-20">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-black tracking-tight">Customer Feedback</h1>
                    <p className="text-sm text-muted-foreground font-medium">Your reviews and ratings from customers</p>
                </div>
            </div>

            {/* Stats Grid */}
            {stats && (
                <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                    <motion.div variants={item}>
                        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-purple-50/50 ring-1 ring-purple-100/50">
                            <CardContent className="p-4">
                                <div className="flex flex-col gap-1">
                                    <div className="h-8 w-8 rounded-xl bg-purple-100 flex items-center justify-center">
                                        <TrendingUp className="h-4 w-4 text-purple-600" />
                                    </div>
                                    <h3 className="text-xl font-black mt-2">{stats.avgRating}</h3>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Avg Rating</p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                    <motion.div variants={item}>
                        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-emerald-50/50 ring-1 ring-emerald-100/50">
                            <CardContent className="p-4">
                                <div className="flex flex-col gap-1">
                                    <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                                        <Users className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <h3 className="text-xl font-black mt-2">{stats.customerReviews}</h3>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reviews</p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                    <motion.div variants={item} className="col-span-2">
                        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-amber-50/50 ring-1 ring-amber-100/50 h-full">
                            <CardContent className="p-4">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                        <h3 className="text-xs font-bold uppercase tracking-tight">Top Compliments</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {stats.topTags.map(([tag, count]) => (
                                            <Badge key={tag} className="bg-white border-amber-200 text-amber-700 text-[9px] font-bold px-1.5 py-0">
                                                {tag} ({count})
                                            </Badge>
                                        ))}
                                        {stats.topTags.length === 0 && <p className="text-[10px] italic text-muted-foreground">No tags yet</p>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </motion.div>
            )}

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search reviews..."
                        className="pl-9 rounded-xl h-11 bg-white border-slate-200"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="h-11 px-3 rounded-xl bg-white border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value)}
                >
                    <option value="all">All Ratings</option>
                    <option value="positive">Positive (4-5★)</option>
                    <option value="neutral">Neutral (3★)</option>
                    <option value="negative">Negative (1-2★)</option>
                </select>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {loading ? (
                    <div className="py-20 text-center">
                        <div className="w-10 h-10 border-4 border-purple-600/20 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Reviews...</p>
                    </div>
                ) : filteredFeedback.length > 0 ? (
                    filteredFeedback.map((fb, idx) => (
                        <motion.div
                            key={fb.id || idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <Card className="hover:shadow-md transition-all border-none bg-white ring-1 ring-slate-100 overflow-hidden group rounded-2xl">
                                <div className={`h-1.5 w-full ${fb.rating >= 4 ? 'bg-emerald-500' : fb.rating === 3 ? 'bg-amber-500' : 'bg-red-500'}`} />
                                <CardContent className="p-5">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="flex items-center gap-0.5">
                                                        {[1, 2, 3, 4, 5].map(s => (
                                                            <Star key={s} className={`h-3.5 w-3.5 ${s <= fb.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                                                        ))}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-muted-foreground">{new Date(fb.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <h4 className="text-sm font-bold text-slate-900">
                                                    {fb.customerName || "Anonymous Customer"}
                                                </h4>
                                                <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-muted-foreground uppercase">
                                                    <BarChart3 className="h-3 w-3" /> {fb.serviceName}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-tighter">ID: {fb.bookingId?.slice(-8)}</p>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                                {fb.comment || <span className="italic opacity-50">No comment provided</span>}
                                            </p>
                                        </div>

                                        {fb.tags?.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {fb.tags.map(tag => (
                                                    <Badge key={tag} className="bg-purple-50 text-purple-600 border-none font-bold text-[10px] px-2 py-0.5">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))
                ) : (
                    <div className="py-20 text-center bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                        <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <FilterX className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-black text-slate-900 mb-1">No reviews found</h3>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto">
                            You haven't received any reviews matching your current filters yet.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-6 rounded-xl font-bold"
                            onClick={() => { setSearch(""); setRatingFilter("all"); }}
                        >
                            Clear filters
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
