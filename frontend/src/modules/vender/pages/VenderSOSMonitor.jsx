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

    const AddressDisplay = ({ location }) => {
        const [address, setAddress] = useState("Resolving address...");
        const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

        useEffect(() => {
            if (!location?.lat || !location?.lng) {
                setAddress("No location data");
                return;
            }

            const resolve = async () => {
                try {
                    const response = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat},${location.lng}&key=${key}`
                    );
                    const data = await response.json();
                    if (data.status === "OK" && data.results?.[0]) {
                        setAddress(data.results[0].formatted_address);
                    } else {
                        setAddress(`${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
                    }
                } catch (error) {
                    setAddress("Address error");
                }
            };

            resolve();
        }, [location?.lat, location?.lng, key]);

        return (
            <div className="flex items-start gap-2 text-[11px] font-bold text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" /> 
                <span className="line-clamp-2">{address}</span>
            </div>
        );
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return "Just now";
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    };

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

    const handleResolve = async (id) => {
        if (!id) {
            console.error('Cannot resolve: Alert ID is undefined');
            return;
        }
        try {
            await resolveSOSAlert(id);
            await load();
        } catch (error) {
            console.error('Failed to resolve alert:', error);
        }
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
                    {activeAlerts.map((alert, index) => (
                        <motion.div key={alert.id || alert._id || `alert-${index}`} variants={item}>
                            <Card className="shadow-sm border-red-200 bg-red-50/30">
                                <CardContent className="p-4 md:p-5">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0 shadow-sm border border-red-200/50">
                                                <AlertTriangle className="h-6 w-6 text-red-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                    <Badge className="bg-red-600 text-white border-none text-[8px] font-black uppercase tracking-wider px-2 h-5">
                                                        {alert.type === "provider" ? "SERVICE PROVIDER" : "CUSTOMER"}
                                                    </Badge>
                                                    <Badge variant="outline" className="bg-white text-orange-600 border-orange-200 text-[8px] font-black uppercase tracking-wider h-5 px-2">
                                                        {alert.alarmType || "Emergency"}
                                                    </Badge>
                                                </div>
                                                <h3 className="text-base font-black text-slate-900 truncate">{alert.userName || "Unknown User"}</h3>
                                                <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-0.5 animate-pulse">
                                                    <Bell className="h-3 w-3" /> Notified: Admin, Family & Vendor
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{alert.time || formatTime(alert.createdAt)}</p>
                                                <p className="text-[9px] text-muted-foreground font-medium opacity-50 mt-1">#{alert.id?.toString().slice(-6)}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-3 border-y border-red-200/30">
                                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                                                <Phone className="h-3.5 w-3.5 text-slate-400" /> {alert.phone || "N/A"}
                                            </div>
                                            <AddressDisplay location={alert.location} />
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            <Button 
                                                className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold gap-2 text-xs shadow-lg shadow-indigo-100"
                                                onClick={() => {
                                                    if (alert.location?.lat && alert.location?.lng) {
                                                        window.open(`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`, "_blank");
                                                    } else {
                                                        alert("Location not available for tracking.");
                                                    }
                                                }}
                                            >
                                                <Map className="h-4 w-4" /> Track
                                            </Button>
                                            <Button 
                                                className="h-11 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold gap-2 text-xs shadow-lg shadow-red-100"
                                                onClick={() => {
                                                    if (alert.phone || alert.userPhone) {
                                                        window.location.href = `tel:${alert.phone || alert.userPhone}`;
                                                    } else {
                                                        alert("Phone number not available.");
                                                    }
                                                }}
                                            >
                                                <Phone className="h-4 w-4" /> Call
                                            </Button>
                                            <Button variant="outline" className="h-11 col-span-2 sm:col-span-1 rounded-2xl font-bold gap-2 text-xs bg-white border-slate-200 text-slate-700 hover:bg-green-50 hover:text-green-600 hover:border-green-200" onClick={() => handleResolve(alert._id || alert.id)} disabled={!alert._id && !alert.id}>
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
                                {resolvedAlerts.map((alert, index) => (
                                    <div key={alert.id || alert._id || `resolved-${index}`} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
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
