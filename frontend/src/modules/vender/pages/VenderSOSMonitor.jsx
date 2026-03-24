import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, MapPin, Phone, Clock, CheckCircle, AlertTriangle, User, RefreshCw, Bell, Map } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function VenderSOSMonitor() {
    const { getSOSAlerts, resolveSOSAlert, hydrated, isLoggedIn } = useVenderAuth();
    const [alerts, setAlerts] = useState([]);

    const load = async () => {
        try {
            if (!hydrated || !isLoggedIn) return;
            const items = await getSOSAlerts();
            setAlerts(Array.isArray(items) ? items : []);
        } catch {}
    };
    useEffect(() => { load(); }, [hydrated, isLoggedIn]);

    const activeAlerts = alerts.filter(a => a.status !== "resolved");
    const resolvedAlerts = alerts.filter(a => a.status === "resolved");

    const handleResolve = (id) => {
        resolveSOSAlert(id);
        load();
    };

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                        <ShieldAlert className="h-7 w-7 text-red-500" /> SOS Monitor
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Emergency alerts from service providers and users</p>
                </div>
                <Button onClick={load} variant="outline" className="gap-2 rounded-xl font-bold">
                    <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
            </motion.div>

            {/* Active Alerts */}
            {activeAlerts.length > 0 ? (
                <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                    <h2 className="text-sm font-black text-red-600 uppercase tracking-widest flex items-center gap-2">
                        <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" /> Active Alerts ({activeAlerts.length})
                    </h2>
                    {activeAlerts.map((alert) => (
                        <motion.div key={alert.id} variants={item}>
                            <Card className="shadow-sm border-red-200 bg-red-50/30">
                                <CardContent className="p-4 md:p-5">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                                            <AlertTriangle className="h-6 w-6 text-red-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge className="bg-red-100 text-red-700 border-red-200 text-[8px] font-black uppercase">{alert.type === "provider" ? "SERVICE PROVIDER" : "CUSTOMER"}</Badge>
                                                <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[8px] font-black uppercase">{alert.alarmType || "Security Threat"}</Badge>
                                                <span className="text-[10px] text-muted-foreground font-medium">#{alert.id}</span>
                                            </div>
                                            <h3 className="text-sm font-bold">{alert.userName || "Unknown User"}</h3>
                                            <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-muted-foreground font-medium">
                                                <span className="flex items-center gap-1 text-red-500 font-bold"><Bell className="h-3 w-3" /> Notified: Admin, Family & Vendor</span>
                                                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {alert.phone || "N/A"}</span>
                                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {alert.location || "Location shared"}</span>
                                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {alert.time || "Just now"}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                                            <Button className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold gap-2">
                                                <Map className="h-4 w-4" /> Live Tracking
                                            </Button>
                                            <Button className="h-10 bg-red-600 hover:bg-red-700 rounded-xl font-bold gap-2">
                                                <Phone className="h-4 w-4" /> Call Now
                                            </Button>
                                            <Button variant="outline" className="h-10 rounded-xl font-bold gap-2 bg-white hover:bg-green-50 hover:text-green-600 hover:border-green-200" onClick={() => handleResolve(alert.id)}>
                                                <CheckCircle className="h-4 w-4" /> Resolve
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            ) : (
                <Card className="shadow-sm">
                    <CardContent className="py-16 text-center">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="h-10 w-10 text-green-600" />
                        </motion.div>
                        <h3 className="text-lg font-black text-foreground">All Clear</h3>
                        <p className="text-sm text-muted-foreground font-medium mt-1">No active SOS alerts. Everything is safe.</p>
                    </CardContent>
                </Card>
            )}

            {/* Resolved History */}
            {resolvedAlerts.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold">Resolved History</CardTitle>
                            <CardDescription>Previously resolved SOS alerts</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {resolvedAlerts.map((alert) => (
                                    <div key={alert.id} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="text-[12px] font-semibold">{alert.userName || "Unknown"}</p>
                                                <p className="text-[10px] text-muted-foreground">{alert.time || "N/A"}</p>
                                            </div>
                                        </div>
                                        <Badge className="bg-green-100 text-green-700 border-green-200 text-[8px] font-black">Resolved</Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </div>
    );
}
