import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Percent, IndianRupee, Save, Calendar, MapPin, Search, CheckCircle, Clock, Ban, DollarSign, Filter, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { Slider } from "@/modules/user/components/ui/slider";
import { Badge } from "@/modules/user/components/ui/badge";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/modules/user/components/ui/dropdown-menu";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

// Mock robust payouts data for Admin
const initialPayouts = [
    { id: "PAY-1001", spName: "Priya K.", city: "Mumbai", amount: 3200, status: "completed", date: "2026-03-01", vendorId: "V001" },
    { id: "PAY-1002", spName: "Anita S.", city: "Delhi", amount: 1500, status: "pending", date: "2026-03-05", vendorId: "V002" },
    { id: "PAY-1003", spName: "Ritu M.", city: "Mumbai", amount: 4800, status: "on_hold", date: "2026-02-28", vendorId: "V001" },
    { id: "PAY-1004", spName: "Meena D.", city: "Pune", amount: 2100, status: "completed", date: "2026-03-02", vendorId: "V003" },
    { id: "PAY-1005", spName: "Rahul Sharma", city: "Delhi", amount: 5600, status: "pending", date: "2026-03-06", vendorId: "V002" },
    { id: "PAY-1006", spName: "Kavita R.", city: "Bangalore", amount: 2500, status: "pending", date: "2026-03-03", vendorId: "V004" },
    { id: "PAY-1007", spName: "Simran T.", city: "Pune", amount: 4100, status: "completed", date: "2026-02-25", vendorId: "V003" },
    { id: "PAY-1008", spName: "Akash V.", city: "Mumbai", amount: 1250, status: "completed", date: "2026-03-04", vendorId: "V001" },
];

export default function FinanceManagement() {
    const { getCommissionSettings, updateCommissionSettings } = useAdminAuth();
    const [settings, setSettings] = useState(getCommissionSettings());
    const [saved, setSaved] = useState(false);
    const [payouts, setPayouts] = useState(initialPayouts);

    // Filters
    const [searchCity, setSearchCity] = useState("All Cities");
    const [statusFilter, setStatusFilter] = useState("All");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const handleSave = () => {
        updateCommissionSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleExecutePayout = (id) => {
        setPayouts(prev => prev.map(p => p.id === id ? { ...p, status: "completed" } : p));
    };

    const cities = ["All Cities", ...new Set(payouts.map(p => p.city))];
    const statuses = ["All", "pending", "completed", "on_hold"];

    const statusConfig = {
        completed: { label: "Paid", icon: CheckCircle, color: "bg-green-100 text-green-700 border-green-200" },
        pending: { label: "Pending", icon: Clock, color: "bg-amber-100 text-amber-700 border-amber-200" },
        on_hold: { label: "On Hold", icon: Ban, color: "bg-red-100 text-red-700 border-red-200" },
    };

    const filteredPayouts = useMemo(() => {
        return payouts.filter(p => {
            const matchCity = searchCity === "All Cities" || p.city === searchCity;
            const matchStatus = statusFilter === "All" || p.status === statusFilter;
            const matchSearch = p.spName.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase());

            let matchDate = true;
            if (startDate) {
                matchDate = matchDate && p.date >= startDate;
            }
            if (endDate) {
                matchDate = matchDate && p.date <= endDate;
            }

            return matchCity && matchStatus && matchSearch && matchDate;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [payouts, searchCity, statusFilter, searchQuery, startDate, endDate]);

    const totalFilteredAmount = filteredPayouts.reduce((sum, p) => sum + p.amount, 0);
    const pendingFilteredAmount = filteredPayouts.filter(p => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);

    return (
        <div className="space-y-6 max-w-7xl">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                    <Wallet className="h-7 w-7 text-primary" /> Finance & Payouts
                </h1>
                <p className="text-sm text-muted-foreground font-medium mt-1">Manage platform commission and global provider payouts</p>
            </motion.div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Column: Commission Settings */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-1 space-y-6">
                    <Card className="border-border/50 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-2"><Percent className="h-5 w-5 text-primary" /> Commission Rate</CardTitle>
                            <CardDescription>Percentage charged on each completed booking</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-bold">Platform Commission</Label>
                                    <span className="text-2xl font-black text-primary">{settings.rate}%</span>
                                </div>
                                <Slider value={[settings.rate]} onValueChange={([v]) => setSettings(prev => ({ ...prev, rate: v }))} min={5} max={30} step={1} className="w-full" />
                                <div className="flex justify-between text-[10px] text-muted-foreground font-bold">
                                    <span>5%</span><span>30%</span>
                                </div>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-border/50">
                                <Label className="text-sm font-bold">Minimum Payout Amount</Label>
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input type="number" value={settings.minPayout} onChange={e => setSettings(prev => ({ ...prev, minPayout: parseInt(e.target.value) || 0 }))} className="pl-9 h-11 rounded-xl bg-muted/30 border-border/50" />
                                </div>
                                <p className="text-[10px] text-muted-foreground">Minimum amount required for SP withdrawal</p>
                            </div>

                            <Button onClick={handleSave} className="w-full h-11 rounded-xl font-bold gap-2">
                                {saved ? <><motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>✓</motion.div> Saved!</> : <><Save className="h-4 w-4" /> Save Settings</>}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Quick Stats for filtered view */}
                    <Card className="border-border/50 shadow-none bg-primary/5 border-primary/20">
                        <CardContent className="p-5">
                            <h3 className="text-sm font-black uppercase tracking-wider text-primary mb-4 flex items-center gap-2">
                                <DollarSign className="h-4 w-4" /> Filtered Overview
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold">Total Processed/Pending</p>
                                    <p className="text-3xl font-black mt-1">₹{totalFilteredAmount.toLocaleString()}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{filteredPayouts.length} Transactions</p>
                                </div>
                                <div className="pt-3 border-t border-primary/10">
                                    <p className="text-xs text-amber-600 font-bold">Total Pending Payouts</p>
                                    <p className="text-xl font-black text-amber-600 mt-1">₹{pendingFilteredAmount.toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Right Column: Payment Management */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
                    <Card className="border-border/50 shadow-none h-full border-t-[4px] border-t-primary">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div>
                                    <CardTitle className="text-lg font-bold">Global Payment Management</CardTitle>
                                    <CardDescription>Filter, analyze, and execute pending payouts</CardDescription>
                                </div>
                                {/* Filters Row 1: Search & City */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative w-full md:w-48">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search SP or ID..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="pl-9 h-9 rounded-lg bg-muted/50 border-none text-xs"
                                        />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-dashed rounded-lg">
                                                <MapPin className="h-3.5 w-3.5 text-primary" />
                                                {searchCity}
                                                <ChevronDown className="h-3 w-3 opacity-50" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[180px]">
                                            {cities.map(c => (
                                                <DropdownMenuItem key={c} onClick={() => setSearchCity(c)} className="text-xs font-medium">
                                                    {c}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            {/* Filters Row 2: Date & Status */}
                            <div className="flex flex-wrap items-center gap-3 pt-3 mt-3 border-t border-border/50">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="h-8 text-xs w-[130px] rounded-md border-border/50"
                                    />
                                    <span className="text-xs text-muted-foreground font-medium">to</span>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="h-8 text-xs w-[130px] rounded-md border-border/50"
                                    />
                                </div>

                                <div className="h-5 w-px bg-border/50 mx-1 hidden md:block"></div>

                                <div className="flex gap-1 overflow-x-auto hide-scrollbar pb-1 md:pb-0">
                                    {statuses.map(s => (
                                        <Badge
                                            key={s}
                                            variant={statusFilter === s ? "default" : "outline"}
                                            className="cursor-pointer capitalize text-[10px] px-2.5 py-1 whitespace-nowrap"
                                            onClick={() => setStatusFilter(s)}
                                        >
                                            {s === "All" ? "All Status" : s.replace("_", " ")}
                                        </Badge>
                                    ))}
                                </div>
                                {(startDate || endDate || searchCity !== "All Cities" || statusFilter !== "All" || searchQuery) && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 ml-auto"
                                        onClick={() => {
                                            setStartDate(""); setEndDate(""); setSearchCity("All Cities"); setStatusFilter("All"); setSearchQuery("");
                                        }}
                                    >
                                        Clear Filters
                                    </Button>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            <div className="max-h-[500px] overflow-y-auto p-4 pt-0 space-y-3 custom-scrollbar">
                                <AnimatePresence mode="popLayout">
                                    {filteredPayouts.length > 0 ? (
                                        filteredPayouts.map((payout) => {
                                            const sc = statusConfig[payout.status];
                                            const SIcon = sc.icon;
                                            return (
                                                <motion.div
                                                    key={payout.id}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border border-border/60 bg-card hover:shadow-md transition-all gap-4"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                                            <span className="text-sm font-black text-primary">{payout.spName.charAt(0)}</span>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-bold">{payout.spName}</p>
                                                                <Badge variant="outline" className={`text-[9px] font-black ${sc.color} h-4 px-1.5`}>
                                                                    {sc.label}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
                                                                <span className="font-medium flex items-center gap-1"><MapPin className="h-3 w-3" />{payout.city}</span>
                                                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{payout.date}</span>
                                                                <span>ID: {payout.id}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-border/50">
                                                        <div className="text-left sm:text-right">
                                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Amount</p>
                                                            <span className="text-lg font-black text-foreground">₹{payout.amount.toLocaleString()}</span>
                                                        </div>
                                                        {payout.status === "pending" && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleExecutePayout(payout.id)}
                                                                className="h-9 px-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 glow-primary transition-all active:scale-95 whitespace-nowrap"
                                                            >
                                                                Execute Payout
                                                            </Button>
                                                        )}
                                                        {payout.status === "completed" && (
                                                            <div className="h-9 px-4 flex items-center justify-center rounded-xl bg-green-50 text-green-600 text-xs font-bold border border-green-200">
                                                                Processed
                                                            </div>
                                                        )}
                                                        {payout.status === "on_hold" && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleExecutePayout(payout.id)}
                                                                className="h-9 px-4 rounded-xl font-bold border-primary text-primary hover:bg-primary/10 whitespace-nowrap"
                                                            >
                                                                Release Hold
                                                            </Button>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-12 text-center flex flex-col items-center justify-center opacity-60">
                                            <Filter className="h-10 w-10 text-muted-foreground mb-3" />
                                            <p className="text-sm font-bold text-muted-foreground">No payouts found matching filters</p>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
