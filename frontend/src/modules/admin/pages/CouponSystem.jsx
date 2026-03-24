import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ticket, Plus, Trash2, Save, Percent, IndianRupee, Users, Calendar, MapPin, Tag, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/user/components/ui/select";
import { Switch } from "@/modules/user/components/ui/switch";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const CATEGORIES = ["Hair", "Makeup", "Skin Care", "Nails", "Bridal", "All"];

export default function CouponSystem() {
    const { getCoupons, addCoupon, deleteCoupon } = useAdminAuth();
    const [coupons, setCoupons] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [copied, setCopied] = useState(null);
    const [form, setForm] = useState({
        code: "", discountType: "percentage", discountValue: 10, minOrder: 0,
        maxDiscount: 500, perUserLimit: 1, totalLimit: 100, category: "All",
        zone: "", firstTimeOnly: false, expiryDate: "", isActive: true,
    });

    const load = async () => {
        try {
            const items = await getCoupons();
            setCoupons(Array.isArray(items) ? items : []);
        } catch {
            setCoupons([]);
        }
    };
    useEffect(() => { load(); }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        await addCoupon(form);
        setForm({ code: "", discountType: "percentage", discountValue: 10, minOrder: 0, maxDiscount: 500, perUserLimit: 1, totalLimit: 100, category: "All", zone: "", firstTimeOnly: false, expiryDate: "", isActive: true });
        setShowForm(false);
        load();
    };

    const handleCopy = (code) => {
        navigator.clipboard.writeText(code);
        setCopied(code);
        setTimeout(() => setCopied(null), 1500);
    };

    const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2"><Ticket className="h-7 w-7 text-primary" /> Coupon System</h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Create and manage discount coupons</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)} className="gap-2 rounded-xl font-bold"><Plus className="h-4 w-4" /> Create Coupon</Button>
            </motion.div>

            <AnimatePresence>
                {showForm && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                        <Card className="border-border/50 shadow-none">
                            <CardHeader><CardTitle className="text-base font-bold">New Coupon</CardTitle></CardHeader>
                            <CardContent>
                                <form onSubmit={handleAdd} className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Coupon Code</Label>
                                        <Input placeholder="SUMMER50" value={form.code} onChange={e => update("code", e.target.value.toUpperCase())} className="rounded-xl h-10 bg-muted/30 font-mono font-bold uppercase" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Discount Type</Label>
                                        <Select value={form.discountType} onValueChange={v => update("discountType", v)}>
                                            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="percentage">Percentage (%)</SelectItem>
                                                <SelectItem value="flat">Flat (₹)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Discount Value</Label>
                                        <Input type="number" value={form.discountValue} onChange={e => update("discountValue", parseInt(e.target.value))} className="rounded-xl h-10 bg-muted/30" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Min Order (₹)</Label>
                                        <Input type="number" value={form.minOrder} onChange={e => update("minOrder", parseInt(e.target.value))} className="rounded-xl h-10 bg-muted/30" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Max Discount (₹)</Label>
                                        <Input type="number" value={form.maxDiscount} onChange={e => update("maxDiscount", parseInt(e.target.value))} className="rounded-xl h-10 bg-muted/30" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Per User Limit</Label>
                                        <Input type="number" value={form.perUserLimit} onChange={e => update("perUserLimit", parseInt(e.target.value))} className="rounded-xl h-10 bg-muted/30" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Total Usage Limit</Label>
                                        <Input type="number" value={form.totalLimit} onChange={e => update("totalLimit", parseInt(e.target.value))} className="rounded-xl h-10 bg-muted/30" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Category</Label>
                                        <Select value={form.category} onValueChange={v => update("category", v)}>
                                            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Expiry Date</Label>
                                        <Input type="date" value={form.expiryDate} onChange={e => update("expiryDate", e.target.value)} className="rounded-xl h-10 bg-muted/30" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Zone (Optional)</Label>
                                        <Input placeholder="Delhi NCR" value={form.zone} onChange={e => update("zone", e.target.value)} className="rounded-xl h-10 bg-muted/30" />
                                    </div>
                                    <div className="flex items-center gap-3 pt-6">
                                        <Switch checked={form.firstTimeOnly} onCheckedChange={v => update("firstTimeOnly", v)} />
                                        <Label className="text-xs font-bold">First-time booking only</Label>
                                    </div>
                                    <div className="md:col-span-3 flex gap-2 mt-2">
                                        <Button type="submit" className="rounded-xl font-bold gap-2"><Save className="h-4 w-4" />Save Coupon</Button>
                                        <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setShowForm(false)}>Cancel</Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {coupons.length === 0 ? (
                <Card className="border-border/50"><CardContent className="py-16 text-center">
                    <Ticket className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm font-bold text-muted-foreground">No coupons created</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Create your first coupon to offer discounts to users</p>
                </CardContent></Card>
            ) : (
                <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {coupons.map(c => (
                        <motion.div key={c.id} variants={item}>
                            <Card className="border-border/50 shadow-none hover:border-primary/30 transition-all">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleCopy(c.code)} className="text-base font-black font-mono bg-primary/15 text-primary px-2.5 py-1 rounded-lg hover:bg-primary/25 transition-colors flex items-center gap-1">
                                                {c.code}
                                                {copied === c.code ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3 opacity-40" />}
                                            </button>
                                        </div>
                                        <Button size="sm" variant="outline" className="h-7 text-[10px] border-red-500/30 text-red-400 rounded-lg px-2" onClick={() => { deleteCoupon(c.id); load(); }}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="text-xl font-black text-foreground mb-2">
                                        {c.discountType === "percentage" ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {c.minOrder > 0 && <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 bg-muted/50">Min ₹{c.minOrder}</Badge>}
                                        {c.maxDiscount > 0 && <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 bg-muted/50">Max ₹{c.maxDiscount}</Badge>}
                                        <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 bg-muted/50"><Users className="h-2 w-2 mr-0.5" />{c.perUserLimit}/user</Badge>
                                        <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 bg-muted/50"><Tag className="h-2 w-2 mr-0.5" />{c.category}</Badge>
                                        {c.zone && <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 bg-muted/50"><MapPin className="h-2 w-2 mr-0.5" />{c.zone}</Badge>}
                                        {c.firstTimeOnly && <Badge className="text-[8px] font-black h-4 px-1.5 bg-amber-500/15 text-amber-400 border-amber-500/30">1st Booking</Badge>}
                                        {c.expiryDate && <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 bg-muted/50"><Calendar className="h-2 w-2 mr-0.5" />{c.expiryDate}</Badge>}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
}
