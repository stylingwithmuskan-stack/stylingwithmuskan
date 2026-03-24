import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Phone, MapPin, Clock, CheckCircle, AlertTriangle, RefreshCw, Bell, Map } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function SOSMonitor() {
    const { isLoggedIn, getSOSAlerts, resolveSOSAlert } = useAdminAuth();
    const [alerts, setAlerts] = useState([]);

    const load = async () => {
        if (!isLoggedIn) return;
        try {
            const items = await getSOSAlerts();
            setAlerts(Array.isArray(items) ? items : []);
        } catch {
            setAlerts([]);
        }
    };
    useEffect(() => { load(); }, [isLoggedIn]);

    const active = alerts.filter(a => a.status !== "resolved");
    const resolved = alerts.filter(a => a.status === "resolved");

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2"><ShieldAlert className="h-7 w-7 text-red-500" /> Global SOS Monitor</h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Emergency alerts from all cities</p>
                </div>
                <Button onClick={load} variant="outline" className="gap-2 rounded-xl font-bold"><RefreshCw className="h-4 w-4" /> Refresh</Button>
            </motion.div>

            {active.length > 0 ? (
                <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                    <h2 className="text-sm font-black text-red-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" /> Active ({active.length})
                    </h2>
                    {active.map(a => (
                        <motion.div key={a.id} variants={item}>
                            <Card className="border-red-500/30 bg-red-500/5">
                                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                                        <AlertTriangle className="h-6 w-6 text-red-500" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge className="bg-red-500/15 text-red-500 border-red-500/30 text-[8px] font-black uppercase">{a.type === "provider" ? "SP" : "CUSTOMER"}</Badge>
                                            <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30 text-[8px] font-black uppercase">{a.alarmType || "Security Threat"}</Badge>
                                            <span className="text-[10px] text-muted-foreground">#{a.id}</span>
                                        </div>
                                        <p className="text-sm font-bold">{a.userName || "Unknown"}</p>
                                        <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-muted-foreground font-medium">
                                            <span className="flex items-center gap-1 text-red-500 font-bold"><Bell className="h-3 w-3" /> Notified: Admin, Family & Vendor</span>
                                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{a.phone || "N/A"}</span>
                                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location || "Shared"}</span>
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{a.time || "Now"}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                                        <Button className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold gap-1"><Map className="h-3.5 w-3.5" /> Track</Button>
                                        <Button className="h-9 bg-red-600 hover:bg-red-700 rounded-xl font-bold gap-1"><Phone className="h-3.5 w-3.5" /> Call</Button>
                                        <Button variant="outline" className="h-9 rounded-xl font-bold gap-1 hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/30" onClick={() => { resolveSOSAlert(a.id); load(); }}><CheckCircle className="h-3.5 w-3.5" /> Resolve</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            ) : (
                <Card className="border-border/50"><CardContent className="py-16 text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-20 w-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="h-10 w-10 text-green-400" />
                    </motion.div>
                    <h3 className="text-lg font-black">All Clear</h3>
                    <p className="text-sm text-muted-foreground mt-1">No active SOS alerts across all cities</p>
                </CardContent></Card>
            )}

            {resolved.length > 0 && (
                <Card className="border-border/50 shadow-none">
                    <CardHeader><CardTitle className="text-base font-bold">Resolved History</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {resolved.map(a => (
                            <div key={a.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                <div className="flex items-center gap-3">
                                    <div className="h-7 w-7 rounded-lg bg-green-500/15 flex items-center justify-center"><CheckCircle className="h-3.5 w-3.5 text-green-400" /></div>
                                    <div>
                                        <p className="text-[12px] font-semibold">{a.userName || "Unknown"}</p>
                                        <p className="text-[10px] text-muted-foreground">{a.time || "N/A"}</p>
                                    </div>
                                </div>
                                <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[8px] font-black">Resolved</Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
