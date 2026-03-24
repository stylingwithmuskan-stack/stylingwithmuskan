import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Search, CheckCircle, XCircle, Ban, UserCheck, Phone, RefreshCw, CreditCard, AlertTriangle, Star } from "lucide-react";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/user/components/ui/tabs";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function CustomerOversight() {
    const { getUserBookings, getAllCustomers } = useAdminAuth();
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("all");

    const [feedback, setFeedback] = useState([]);
    const load = async () => {
        try {
            const [bookings, customerList] = await Promise.all([
                getUserBookings()?.catch(() => []),
                getAllCustomers()?.catch(() => []),
            ]);
            
            setFeedback(JSON.parse(localStorage.getItem('muskan-feedback') || '[]'));
            
            const customerMap = new Map();
            
            // First, populate with real users from DB
            (Array.isArray(customerList) ? customerList : []).forEach(u => {
                customerMap.set(u._id || u.phone, {
                    id: u._id || u.phone,
                    name: u.name || "Unknown Customer",
                    phone: u.phone,
                    status: u.status || "active",
                    totalBookings: 0,
                    cancelledBookings: 0,
                    paymentFailures: 0,
                    createdAt: u.createdAt,
                });
            });

            // Then, overlay booking stats
            (Array.isArray(bookings) ? bookings : []).forEach(b => {
                const phone = b.customerId || b.customerPhone || b.id;
                if (customerMap.has(phone)) {
                    const c = customerMap.get(phone);
                    c.totalBookings += 1;
                    if (b.status === "cancelled" || b.status === "rejected" || b.status === "missed") {
                        c.cancelledBookings += 1;
                    }
                }
            });

            setCustomers(Array.from(customerMap.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        } catch (e) {
            console.error("Failed to load customers", e);
        }
    };

    const getCustomerRating = (idOrPhone) => {
        const cFeedback = feedback.filter(f => (f.customerName === idOrPhone || f.customerId === idOrPhone) && f.type === 'provider_to_customer');
        if (cFeedback.length === 0) return null;
        const sum = cFeedback.reduce((a, b) => a + b.rating, 0);
        return (sum / cFeedback.length).toFixed(1);
    };

    useEffect(() => { load(); }, []);

    const filtered = customers.filter(c => {
        const ms = c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search);
        if (tab === "all") return ms;
        if (tab === "active") return ms && c.status === "active";
        if (tab === "blocked") return ms && c.status === "blocked";
        return ms;
    });

    const handleAction = (id, newStatus) => {
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    };

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> Customer Oversight</h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Track user performance, cancellations, and blacklists</p>
                </div>
                <Button onClick={load} variant="outline" className="gap-2 rounded-xl font-bold"><RefreshCw className="h-4 w-4" /> Refresh</Button>
            </motion.div>

            <Tabs value={tab} onValueChange={setTab}>
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                    <TabsList className="bg-muted/30 rounded-xl p-1">
                        <TabsTrigger value="all" className="rounded-lg text-xs font-bold">All ({customers.length})</TabsTrigger>
                        <TabsTrigger value="active" className="rounded-lg text-xs font-bold">Active</TabsTrigger>
                        <TabsTrigger value="blocked" className="rounded-lg text-xs font-bold">Blacklisted</TabsTrigger>
                    </TabsList>
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search user..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl h-10 bg-muted/30 border-border/50" />
                    </div>
                </div>
                <TabsContent value={tab} className="mt-0">
                    {filtered.length === 0 ? (
                        <Card className="border-border/50"><CardContent className="py-16 text-center">
                            <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-sm font-bold text-muted-foreground">No customers found</p>
                        </CardContent></Card>
                    ) : (
                        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                            {filtered.map(c => (
                                <motion.div key={c.id} variants={item}>
                                    <Card className={`border-border/50 shadow-none hover:border-primary/30 transition-all ${c.status === 'blocked' ? 'opacity-75 bg-red-50/30' : ''}`}>
                                        <CardContent className="p-4 flex flex-col gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.status === 'blocked' ? 'bg-red-100 text-red-600' : 'bg-primary/15 text-primary'}`}>
                                                    <span className="text-sm font-black">{c.name?.charAt(0) || "?"}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm font-bold truncate">{c.name || "Unknown"}</h3>
                                                        {c.status === 'blocked' && (
                                                            <Badge variant="outline" className="text-[8px] font-black px-1.5 py-0 h-4 bg-red-100 text-red-600 border-red-200">
                                                                BLACKLISTED
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{c.phone}</span>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    {c.status === "active" ? (
                                                        <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold border-red-500/30 text-red-600 rounded-lg px-2 bg-red-50 hover:bg-red-100" onClick={() => handleAction(c.id, "blocked")}><Ban className="h-3 w-3 mr-1" />Blacklist</Button>
                                                    ) : (
                                                        <Button size="sm" className="h-7 text-[10px] font-bold bg-green-600 hover:bg-green-700 rounded-lg px-2" onClick={() => handleAction(c.id, "active")}><UserCheck className="h-3 w-3 mr-1" />Unblock</Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Advanced Stats */}
                                            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
                                                <div className="bg-muted/30 p-2 rounded-xl">
                                                    <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Total Bookings</p>
                                                    <p className="text-sm font-black mt-0.5">{c.totalBookings}</p>
                                                </div>
                                                <div className="bg-muted/30 p-2 rounded-xl">
                                                    <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><XCircle className="h-3 w-3" /> Cancellations</p>
                                                    <p className={`text-sm font-black mt-0.5 ${c.cancelledBookings > 2 ? 'text-red-500' : ''}`}>{c.cancelledBookings}</p>
                                                </div>
                                                <div className="bg-muted/30 p-2 rounded-xl">
                                                    <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3" /> User Rating</p>
                                                    <p className={`text-sm font-black mt-0.5 ${getCustomerRating(c.name) ? 'text-amber-500' : 'text-slate-400'}`}>
                                                        {getCustomerRating(c.name) ? `${getCustomerRating(c.name)} ★` : 'No Data'}
                                                    </p>
                                                </div>
                                            </div>

                                            {c.cancelledBookings > 2 && c.status !== 'blocked' && (
                                                <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-2 rounded-lg flex items-center gap-2 mt-1 font-medium">
                                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                                    High cancellation frequency detected. Consider blacklisting if pattern continues.
                                                </div>
                                            )}
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
