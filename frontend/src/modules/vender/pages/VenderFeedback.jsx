import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessageSquare, Star, TrendingUp, Users, Filter, Search,
    ChevronDown, ArrowUpRight, BarChart3, AlertCircle, Sparkles, FilterX
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/user/components/ui/tabs";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function VenderFeedback() {
    const { vendor } = useVenderAuth();
    const [feedback, setFeedback] = useState([]);
    const [search, setSearch] = useState("");
    const [ratingFilter, setRatingFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        const allFeedback = JSON.parse(localStorage.getItem('muskan-feedback') || '[]');
        const allBookings = JSON.parse(localStorage.getItem('muskan-bookings') || '[]');

        // Filter feedback belonging to this vendor's city
        const cityFeedback = allFeedback.filter(f => {
            const booking = allBookings.find(b => b.id === f.bookingId);
            return booking?.address?.city?.toLowerCase() === vendor?.city?.toLowerCase();
        });

        setFeedback(cityFeedback.reverse());
    }, [vendor]);

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
            f.providerName?.toLowerCase().includes(search.toLowerCase()) ||
            f.comment?.toLowerCase().includes(search.toLowerCase());

        const matchesRating = ratingFilter === "all" ||
            (ratingFilter === "positive" && f.rating >= 4) ||
            (ratingFilter === "neutral" && f.rating === 3) ||
            (ratingFilter === "negative" && f.rating <= 2);

        const matchesType = typeFilter === "all" || f.type === typeFilter;

        return matchesSearch && matchesRating && matchesType;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                        <MessageSquare className="h-7 w-7 text-primary" /> Feedback Management
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">
                        Monitor and analyze customer reviews in <span className="text-primary font-bold">{vendor?.city}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-3 py-1 bg-primary/5 border-primary/20 text-primary font-bold">
                        {filteredFeedback.length} RESULTS
                    </Badge>
                </div>
            </motion.div>

            {/* Stats Grid */}
            {stats && (
                <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <motion.div variants={item}>
                        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-purple-50/50 ring-1 ring-purple-100/50 translate-z-0">
                            <CardContent className="p-6">
                                <div className="flex flex-col gap-2">
                                    <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                        <TrendingUp className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <h3 className="text-2xl font-black">{stats.avgRating}</h3>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Avg Rating</p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                    <motion.div variants={item}>
                        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-emerald-50/50 ring-1 ring-emerald-100/50">
                            <CardContent className="p-6">
                                <div className="flex flex-col gap-2">
                                    <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                        <Users className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <h3 className="text-2xl font-black">{stats.customerReviews}</h3>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Reviews</p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                    <motion.div variants={item} className="col-span-2">
                        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-amber-50/50 ring-1 ring-amber-100/50">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-amber-500" />
                                            <h3 className="text-sm font-bold">Popular Compliments</h3>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {stats.topTags.map(([tag, count]) => (
                                                <Badge key={tag} className="bg-white border-amber-200 text-amber-700 text-[10px] font-bold">
                                                    {tag} ({count})
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </motion.div>
            )}

            {/* Filters */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search feedback content, provider or customer..."
                        className="pl-9 rounded-xl h-12 bg-white ring-1 ring-border focus-visible:ring-primary shadow-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        className="h-12 px-4 rounded-xl bg-white border border-border text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                        value={ratingFilter}
                        onChange={(e) => setRatingFilter(e.target.value)}
                    >
                        <option value="all">All Ratings</option>
                        <option value="positive">Positive (4-5★)</option>
                        <option value="neutral">Neutral (3★)</option>
                        <option value="negative">Negative (1-2★)</option>
                    </select>
                    <select
                        className="h-12 px-4 rounded-xl bg-white border border-border text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="all">Check All Types</option>
                        <option value="customer_to_provider">By Customer</option>
                        <option value="provider_to_customer">By Provider</option>
                    </select>
                </div>
            </motion.div>

            {/* List */}
            <Tabs defaultValue="list" className="w-full">
                <TabsContent value="list" className="mt-0">
                    <div className="grid gap-4">
                        {filteredFeedback.length > 0 ? (
                            filteredFeedback.map((fb, idx) => (
                                <motion.div
                                    key={fb.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <Card className="hover:shadow-md transition-all border-none bg-white ring-1 ring-border/50 overflow-hidden group">
                                        <div className={`h-1 w-full ${fb.rating >= 4 ? 'bg-emerald-500' : fb.rating === 3 ? 'bg-amber-500' : 'bg-red-500'}`} />
                                        <CardContent className="p-5 md:p-6">
                                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="flex items-center gap-0.5">
                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                <Star key={s} className={`h-4 w-4 ${s <= fb.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                                                            ))}
                                                        </div>
                                                        <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${fb.type === 'customer_to_provider' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                                            {fb.type?.replace('_', ' ')}
                                                        </Badge>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mb-3">
                                                        <p className="text-sm font-bold text-foreground">
                                                            {fb.type === 'customer_to_provider' ? (
                                                                <>
                                                                    <span className="text-primary">{fb.customerName}</span> reviewed <span className="text-primary">{fb.providerName}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="text-primary">{fb.providerName}</span> rated <span className="text-primary">{fb.customerName}</span>
                                                                </>
                                                            )}
                                                        </p>
                                                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                                            <BarChart3 className="h-3 w-3" /> {fb.serviceName}
                                                        </span>
                                                    </div>

                                                    <p className="text-sm text-foreground/80 leading-relaxed font-medium bg-muted/30 p-4 rounded-xl border border-border/40 mb-3">
                                                        {fb.comment || <span className="italic opacity-50">No comment provided</span>}
                                                    </p>

                                                    {fb.tags?.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {fb.tags.map(tag => (
                                                                <Badge key={tag} className="bg-primary/5 hover:bg-primary/10 text-primary border-none font-bold text-[10px] px-2.5 py-0.5">
                                                                    {tag}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col items-end gap-2 shrink-0">
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">BK ID: {fb.bookingId}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground">{new Date(fb.createdAt).toLocaleDateString()} {new Date(fb.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                    <Button variant="ghost" size="sm" className="h-8 rounded-lg text-primary hover:bg-primary/5 font-bold text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity mt-4">
                                                        View Booking <ArrowUpRight className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))
                        ) : (
                            <div className="py-20 text-center glass-strong rounded-[32px] border-2 border-dashed border-border/40">
                                <div className="h-20 w-20 bg-muted/60 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <FilterX className="h-10 w-10 text-muted-foreground/30" />
                                </div>
                                <h3 className="text-xl font-black text-foreground mb-2">No feedback found</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                    We couldn't find any feedback entries matching your current filters.
                                </p>
                                <Button
                                    variant="outline"
                                    className="mt-6 rounded-xl font-bold gap-2"
                                    onClick={() => { setSearch(""); setRatingFilter("all"); setTypeFilter("all"); }}
                                >
                                    Clear all filters
                                </Button>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
