import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Image, Plus, Trash2, Calendar, Link as LinkIcon, ArrowUpDown, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function MarketingControl() {
    const { getBanners, addBanner, deleteBanner } = useAdminAuth();
    const [banners, setBanners] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ title: "", imageUrl: "", linkTo: "", startDate: "", endDate: "", priority: 1 });

    const load = async () => {
        try {
            const items = await getBanners();
            setBanners(Array.isArray(items) ? items : []);
        } catch {
            setBanners([]);
        }
    };
    useEffect(() => { load(); }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        await addBanner(form);
        setForm({ title: "", imageUrl: "", linkTo: "", startDate: "", endDate: "", priority: 1 });
        setShowForm(false);
        load();
    };

    const handleDelete = async (id) => { await deleteBanner(id); load(); };
    const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2"><Image className="h-7 w-7 text-primary" /> Marketing Banners</h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Manage promotional banners displayed to users</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)} className="gap-2 rounded-xl font-bold">
                    <Plus className="h-4 w-4" /> Add Banner
                </Button>
            </motion.div>

            {showForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <Card className="border-border/50 shadow-none">
                        <CardHeader><CardTitle className="text-base font-bold">New Banner</CardTitle></CardHeader>
                        <CardContent>
                            <form onSubmit={handleAdd} className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Title</Label>
                                    <Input placeholder="Summer Sale" value={form.title} onChange={e => update("title", e.target.value)} className="rounded-xl h-10 bg-muted/30" required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Image URL</Label>
                                    <Input placeholder="https://..." value={form.imageUrl} onChange={e => update("imageUrl", e.target.value)} className="rounded-xl h-10 bg-muted/30" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Link to Service</Label>
                                    <Input placeholder="/explore/hair" value={form.linkTo} onChange={e => update("linkTo", e.target.value)} className="rounded-xl h-10 bg-muted/30" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Priority (1-10)</Label>
                                    <Input type="number" min={1} max={10} value={form.priority} onChange={e => update("priority", parseInt(e.target.value))} className="rounded-xl h-10 bg-muted/30" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Start Date</Label>
                                    <Input type="date" value={form.startDate} onChange={e => update("startDate", e.target.value)} className="rounded-xl h-10 bg-muted/30" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">End Date</Label>
                                    <Input type="date" value={form.endDate} onChange={e => update("endDate", e.target.value)} className="rounded-xl h-10 bg-muted/30" />
                                </div>
                                <div className="md:col-span-2 flex gap-2">
                                    <Button type="submit" className="rounded-xl font-bold gap-2"><Save className="h-4 w-4" /> Save Banner</Button>
                                    <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setShowForm(false)}>Cancel</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {banners.length === 0 ? (
                <Card className="border-border/50"><CardContent className="py-16 text-center">
                    <Image className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm font-bold text-muted-foreground">No banners yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Click "Add Banner" to create your first promotional banner</p>
                </CardContent></Card>
            ) : (
                <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2">
                    {banners.sort((a, b) => (b.priority || 0) - (a.priority || 0)).map(b => (
                        <motion.div key={b.id} variants={item}>
                            <Card className="border-border/50 shadow-none hover:border-primary/30 transition-all overflow-hidden">
                                {b.imageUrl && <div className="h-32 bg-muted bg-cover bg-center" style={{ backgroundImage: `url(${b.imageUrl})` }} />}
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h3 className="text-sm font-bold">{b.title}</h3>
                                            <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-muted-foreground font-medium">
                                                {b.startDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{b.startDate} → {b.endDate || "∞"}</span>}
                                                {b.linkTo && <span className="flex items-center gap-1"><LinkIcon className="h-3 w-3" />{b.linkTo}</span>}
                                                <Badge variant="outline" className="text-[8px] font-black px-1.5 h-4 bg-primary/15 text-primary border-primary/30">
                                                    <ArrowUpDown className="h-2.5 w-2.5 mr-0.5" />P{b.priority}
                                                </Badge>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold border-red-500/30 text-red-400 rounded-lg px-2" onClick={() => handleDelete(b.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
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
