import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Percent, IndianRupee, Save, Calendar as CalendarIcon, MapPin, Search, CheckCircle, Clock, Ban, DollarSign, Filter, ChevronDown, Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { Slider } from "@/modules/user/components/ui/slider";
import { Badge } from "@/modules/user/components/ui/badge";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/user/components/ui/popover";
import { Calendar } from "@/modules/user/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/modules/user/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/modules/user/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/modules/user/components/ui/dialog";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function FinanceManagement() {
    const { getCommissionSettings, updateCommissionSettings, getMetricsCities, getPayouts, getRecharges, updatePayoutStatus, getSubscriptionSettings, getReferralSettings } = useAdminAuth();
    const [settings, setSettings] = useState({ rate: 15, minPayout: 500, dateFormat: "PPP" });
    const [subSettings, setSubSettings] = useState(null);
    const [refSettings, setRefSettings] = useState(null);
    const [saved, setSaved] = useState(false);
    const [payouts, setPayouts] = useState([]);
    const [recharges, setRecharges] = useState([]);
    const [typeTab, setTypeTab] = useState("payouts");
    const [loading, setLoading] = useState(false);
    const [cities, setCities] = useState(["All Cities"]);

    // Upload Proof State
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [selectedPayoutId, setSelectedPayoutId] = useState(null);
    const [proofFile, setProofFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Filters
    const [searchCity, setSearchCity] = useState("All Cities");
    const [statusFilter, setStatusFilter] = useState("All");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const fetchPayouts = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (searchCity !== "All Cities") params.city = searchCity;
            if (statusFilter !== "All") params.status = statusFilter;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (searchQuery) params.query = searchQuery;

            const [data, rechData] = await Promise.all([
                getPayouts(params),
                getRecharges(params)
            ]);
            setPayouts(Array.isArray(data) ? data : []);
            setRecharges(Array.isArray(rechData) ? rechData : []);
        } catch (e) {
            console.error("Failed to fetch payouts", e);
        } finally {
            setLoading(false);
        }
    }, [getPayouts, searchCity, statusFilter, startDate, endDate, searchQuery]);

    React.useEffect(() => {
        (async () => {
            try {
                const s = await getCommissionSettings();
                if (s) setSettings(s);
                
                const subs = await getSubscriptionSettings();
                if (subs) setSubSettings(subs);

                const refs = await getReferralSettings();
                if (refs) setRefSettings(refs);

                const list = await getMetricsCities?.();
                if (Array.isArray(list) && list.length) {
                    setCities(list);
                }
            } catch (e) {
                console.error("Failed to fetch settings", e);
            }
        })();
    }, [getCommissionSettings, getSubscriptionSettings, getReferralSettings, getMetricsCities]);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            fetchPayouts();
        }, 500); // Debounce search
        return () => clearTimeout(timer);
    }, [fetchPayouts]);

    const handleSave = () => {
        updateCommissionSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleExecutePayoutClick = (id) => {
        setSelectedPayoutId(id);
        setProofFile(null);
        setUploadModalOpen(true);
    };

    const submitPayoutExecute = async () => {
        if (!selectedPayoutId || !proofFile) return;
        setUploading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(proofFile);
            reader.onload = async () => {
                const base64Str = reader.result;
                await updatePayoutStatus(selectedPayoutId, { status: "completed", payoutProof: base64Str });
                setUploadModalOpen(false);
                fetchPayouts();
                setUploading(false);
            };
            reader.onerror = (error) => {
                console.error("FileReader error: ", error);
                setUploading(false);
            };
        } catch (e) {
            console.error("Failed to execute payout", e);
            setUploading(false);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            await updatePayoutStatus(id, { status: newStatus });
            fetchPayouts(); // Refresh list
        } catch (e) {
            console.error("Failed to update payout status", e);
        }
    };

    const statuses = ["All", "pending", "completed"];

    const statusConfig = {
        completed: { label: "Paid", icon: CheckCircle, color: "bg-green-100 text-green-700 border-green-200" },
        pending: { label: "Pending", icon: Clock, color: "bg-amber-100 text-amber-700 border-amber-200" },
        on_hold: { label: "On Hold", icon: Ban, color: "bg-red-100 text-red-700 border-red-200" },
    };

    const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = payouts.filter(p => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);

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
                                    <Input 
                                        type="number" 
                                        min="0"
                                        value={settings.minPayout === 0 ? "" : settings.minPayout} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            setSettings(prev => ({ ...prev, minPayout: val === "" ? 0 : Math.max(0, parseInt(val) || 0) }));
                                        }} 
                                        className="pl-9 h-11 rounded-xl bg-muted/30 border-border/50" 
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground">Minimum amount required for SP withdrawal</p>
                            </div>

                            <Button onClick={handleSave} className="w-full h-11 rounded-xl font-bold gap-2">
                                {saved ? <><motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>✓</motion.div> Saved!</> : <><Save className="h-4 w-4" /> Save Settings</>}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Subscription & Multi-Tier Commissions */}
                    <Card className="border-border/50 shadow-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Clock className="h-4 w-4 text-purple-500" /> Subscription & Tiers
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-3 rounded-xl bg-purple-100/10 border border-purple-200/20">
                                <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">PROVIDER (SWM PRO)</p>
                                <div className="flex justify-between items-end">
                                    <span className="text-xs font-bold text-white/70">Pro Commission</span>
                                    <span className="text-lg font-black text-purple-400">{subSettings?.providerDefaultCommissionRate === 15 ? 5 : subSettings?.providerDefaultCommissionRate || 5}%</span>
                                </div>
                                <p className="text-[9px] text-white/50 mt-1 font-medium italic">Applied to SWM Pro Partner members</p>
                            </div>

                            <div className="p-3 rounded-xl bg-blue-100/10 border border-blue-200/20">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">CUSTOMER (SWM PLUS)</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-white/70">Quarterly Discount</span>
                                        <span className="text-sm font-black text-blue-400">{subSettings?.userQuarterlyDiscountDefault || 10}%</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-white/70">Annual Discount</span>
                                        <span className="text-sm font-black text-blue-400">{subSettings?.userAnnualDiscountDefault || 15}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-emerald-100/10 border border-emerald-200/20">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">VENDOR COMMISSION</p>
                                <div className="flex justify-between items-end">
                                    <span className="text-xs font-bold text-white/70">Performance Rate</span>
                                    <span className="text-lg font-black text-emerald-400">{subSettings?.vendorPerformanceCommissionValue || 2}%</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Referral Summary */}
                    <Card className="border-border/50 shadow-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Gift className="h-4 w-4 text-orange-500" /> Referral Bonuses
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center text-xs font-medium">
                                <span className="text-muted-foreground">Referrer Bonus</span>
                                <span className="font-black">₹{refSettings?.referrerBonus || 100}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-medium">
                                <span className="text-muted-foreground">Referee Bonus</span>
                                <span className="font-black">₹{refSettings?.refereeBonus || 50}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground pt-1 border-t italic">Manage detailed referral logic in Referral System page</p>
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
                                    <p className="text-3xl font-black mt-1">₹{totalAmount.toLocaleString()}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{payouts.length} Transactions</p>
                                </div>
                                <div className="pt-3 border-t border-primary/10">
                                    <p className="text-xs text-amber-600 font-bold">Total Pending Payouts</p>
                                    <p className="text-xl font-black text-amber-600 mt-1">₹{pendingAmount.toLocaleString()}</p>
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
                                    <CardTitle className="text-lg font-bold flex gap-4 border-b border-border/50 pb-2">
                                        <button className={`pb-1 border-b-2 ${typeTab === 'payouts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => setTypeTab('payouts')}>Payout Requests</button>
                                        <button className={`pb-1 border-b-2 ${typeTab === 'recharges' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => setTypeTab('recharges')}>Wallet Recharges</button>
                                    </CardTitle>
                                    <CardDescription className="mt-2">Filter, analyze, and manage platform financial transactions</CardDescription>
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
                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                    
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "h-8 text-[11px] w-[130px] justify-start text-left font-bold rounded-lg border-border/40 bg-muted/20",
                                                    !startDate && "text-muted-foreground"
                                                )}
                                            >
                                                {startDate ? format(new Date(startDate), settings.dateFormat || "PPP") : "Pick Start Date"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={startDate ? new Date(startDate) : undefined}
                                                onSelect={(date) => setStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>

                                    <span className="text-[10px] text-muted-foreground font-black uppercase">to</span>

                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "h-8 text-[11px] w-[130px] justify-start text-left font-bold rounded-lg border-border/40 bg-muted/20",
                                                    !endDate && "text-muted-foreground"
                                                )}
                                            >
                                                {endDate ? format(new Date(endDate), settings.dateFormat || "PPP") : "Pick End Date"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={endDate ? new Date(endDate) : undefined}
                                                onSelect={(date) => setEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
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
                                    {loading ? (
                                        <div className="py-20 text-center">
                                            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                                            <p className="mt-2 text-sm text-muted-foreground font-bold">Loading payouts...</p>
                                        </div>
                                    ) : typeTab === "recharges" ? (
                                        recharges.length > 0 ? (
                                            recharges.map((recharge) => (
                                                <motion.div
                                                    key={recharge.id}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border border-border/60 bg-card hover:shadow-md transition-all gap-4"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 shrink-0 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200">
                                                            <span className="text-sm font-black text-blue-600">{recharge.spName.charAt(0)}</span>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-bold">{recharge.spName}</p>
                                                                <Badge variant="outline" className={`text-[9px] font-black bg-blue-100 text-blue-700 border-blue-200 h-4 px-1.5`}>
                                                                    Recharge
                                                                </Badge>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
                                                                <span className="font-medium flex items-center gap-1"><MapPin className="h-3 w-3" />{recharge.city}</span>
                                                                <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{recharge.date ? format(new Date(recharge.date), settings.dateFormat || "PPP") : "N/A"}</span>
                                                                <span>ID: {recharge.id}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-border/50">
                                                        <div className="text-left sm:text-right">
                                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Amount</p>
                                                            <span className="text-lg font-black text-green-600">+₹{recharge.amount.toLocaleString()}</span>
                                                        </div>
                                                        <div className="text-left sm:text-right">
                                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Balance After</p>
                                                            <span className="text-lg font-black text-foreground">₹{recharge.balanceAfter.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))
                                        ) : (
                                            <div className="py-12 text-center flex flex-col items-center justify-center opacity-60">
                                                <Wallet className="h-10 w-10 text-muted-foreground mb-3" />
                                                <p className="text-sm font-bold text-muted-foreground">No recharges found matching filters</p>
                                            </div>
                                        )
                                    ) : payouts.length > 0 ? (
                                        payouts.map((payout) => {
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
                                                                <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{payout.date ? format(new Date(payout.date), settings.dateFormat || "PPP") : "N/A"}</span>
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
                                                                onClick={() => handleExecutePayoutClick(payout.id)}
                                                                className="h-9 px-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 glow-primary transition-all active:scale-95 whitespace-nowrap"
                                                            >
                                                                Execute Payout
                                                            </Button>
                                                        )}
                                                        {payout.status === "completed" && (
                                                            <div className="flex gap-2 items-center">
                                                                {payout.payoutProof && (
                                                                    <a href={payout.payoutProof} target="_blank" rel="noreferrer" className="h-9 px-4 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-xs font-bold border border-blue-200 hover:bg-blue-100">
                                                                        View Proof
                                                                    </a>
                                                                )}
                                                                <div className="h-9 px-4 flex items-center justify-center rounded-xl bg-green-50 text-green-600 text-xs font-bold border border-green-200">
                                                                    Processed
                                                                </div>
                                                            </div>
                                                        )}
                                                        {payout.status === "on_hold" && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleStatusChange(payout.id, "pending")}
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
            <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Execute Payout</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Upload Payment Proof (Screenshot/Receipt)</Label>
                            <Input type="file" accept="image/*" onChange={e => setProofFile(e.target.files?.[0])} />
                        </div>
                        <Button 
                            className="w-full" 
                            disabled={!proofFile || uploading} 
                            onClick={submitPayoutExecute}
                        >
                            {uploading ? "Uploading & Saving..." : "Submit Payout"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
