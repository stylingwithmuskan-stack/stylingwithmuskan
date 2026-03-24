import React, { useState } from "react";
import { motion } from "framer-motion";
import { Gift, IndianRupee, Users, Shield, Save, ToggleLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { Switch } from "@/modules/user/components/ui/switch";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";

export default function ReferralSystem() {
    const { getReferralSettings, updateReferralSettings } = useAdminAuth();
    const [settings, setSettings] = useState(getReferralSettings());
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        updateReferralSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const update = (k, v) => setSettings(prev => ({ ...prev, [k]: v }));

    // Mock referral data
    const referralStats = [
        { label: "Total Referrals", value: 142, color: "bg-indigo-500/15 text-indigo-400" },
        { label: "Successful Conversions", value: 89, color: "bg-green-500/15 text-green-400" },
        { label: "Bonus Paid", value: "₹14,200", color: "bg-purple-500/15 text-purple-400" },
        { label: "Abuse Blocked", value: 3, color: "bg-red-500/15 text-red-400" },
    ];

    return (
        <div className="space-y-6 max-w-3xl">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2"><Gift className="h-7 w-7 text-primary" /> Referral System</h1>
                <p className="text-sm text-muted-foreground font-medium mt-1">Configure referral bonuses and track conversions</p>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {referralStats.map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}
                        className={`rounded-xl p-3 ${s.color} border border-current/10`}>
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{s.label}</p>
                        <p className="text-xl font-black mt-1">{s.value}</p>
                    </motion.div>
                ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="border-border/50 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-base font-bold">Referral Settings</CardTitle>
                        <CardDescription>Set bonus amounts and limits</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Referrer Bonus</Label>
                                <Input type="number" value={settings.referrerBonus} onChange={e => update("referrerBonus", parseInt(e.target.value) || 0)} className="rounded-xl h-10 bg-muted/30" />
                                <p className="text-[10px] text-muted-foreground">Amount given to the person who refers</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Referee Bonus</Label>
                                <Input type="number" value={settings.refereeBonus} onChange={e => update("refereeBonus", parseInt(e.target.value) || 0)} className="rounded-xl h-10 bg-muted/30" />
                                <p className="text-[10px] text-muted-foreground">Amount given to the new user</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold flex items-center gap-1"><Users className="h-3 w-3" /> Max Referrals per User</Label>
                                <Input type="number" value={settings.maxReferrals} onChange={e => update("maxReferrals", parseInt(e.target.value) || 0)} className="rounded-xl h-10 bg-muted/30" />
                                <p className="text-[10px] text-muted-foreground">Maximum referrals a single user can make</p>
                            </div>
                            <div className="flex items-center gap-3 pt-6">
                                <Switch checked={settings.isActive} onCheckedChange={v => update("isActive", v)} />
                                <div>
                                    <Label className="text-xs font-bold">Referral Program Active</Label>
                                    <p className="text-[10px] text-muted-foreground">{settings.isActive ? "Currently enabled" : "Currently disabled"}</p>
                                </div>
                            </div>
                        </div>

                        <Button onClick={handleSave} className="w-full h-11 rounded-xl font-bold gap-2 mt-4">
                            {saved ? <><motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>✓</motion.div> Saved!</> : <><Save className="h-4 w-4" /> Save Settings</>}
                        </Button>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
