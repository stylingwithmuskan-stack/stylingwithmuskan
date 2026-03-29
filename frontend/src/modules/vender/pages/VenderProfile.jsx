import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Mail, Phone, MapPin, Building2, Calendar, Shield, LogOut, Bell, Plus, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { useNotifications } from "@/modules/user/contexts/NotificationContext";
import { useNavigate } from "react-router-dom";
import { api } from "@/modules/user/lib/api";
import { toast } from "sonner";

export default function VenderProfile() {
    const { vendor, logout, requestZones, setVendor } = useVenderAuth();
    const { unreadCount } = useNotifications();
    const navigate = useNavigate();
    
    const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
    const [availableZones, setAvailableZones] = useState([]);
    const [selectedZones, setSelectedZones] = useState([]);
    const [customZone, setCustomZone] = useState("");
    const [loadingZones, setLoadingZones] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isZoneModalOpen && vendor?.city) {
            setLoadingZones(true);
            api.content.zones({ cityName: vendor.city })
                .then(res => {
                    // Filter out already active zones
                    const currentZones = vendor.zones || [];
                    const filtered = (res.zones || []).filter(z => !currentZones.includes(z.name));
                    setAvailableZones(filtered);
                })
                .catch(() => toast.error("Failed to load zones"))
                .finally(() => setLoadingZones(false));
        }
    }, [isZoneModalOpen, vendor?.city, vendor?.zones]);

    const handleLogout = () => {
        logout();
        navigate("/vender/login");
    };

    const toggleZone = (name) => {
        setSelectedZones(prev => 
            prev.includes(name) ? prev.filter(z => z !== name) : [...prev, name]
        );
    };

    const handleRequestZones = async () => {
        const zonesToRequest = [...selectedZones];
        if (customZone.trim()) zonesToRequest.push(customZone.trim());

        if (zonesToRequest.length === 0) {
            toast.error("Please select at least one zone");
            return;
        }

        setSubmitting(true);
        try {
            const res = await requestZones(zonesToRequest);
            if (res.success) {
                toast.success("Zone request sent to admin!");
                setIsZoneModalOpen(false);
                setSelectedZones([]);
                setCustomZone("");
                // Update local vendor state if needed, though usually admin approval is required
                if (res.vendor) setVendor(res.vendor);
            }
        } catch (err) {
            toast.error(err.message || "Failed to send request");
        } finally {
            setSubmitting(false);
        }
    };

    const fields = [
        { label: "Full Name", value: vendor?.name || "—", icon: User },
        { label: "Email", value: vendor?.email || "—", icon: Mail },
        { label: "Phone", value: vendor?.phone || "—", icon: Phone },
        { label: "City", value: vendor?.city || "—", icon: MapPin },
        { label: "Business Name", value: vendor?.businessName || "—", icon: Building2 },
        { label: "Member Since", value: vendor?.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : "—", icon: Calendar },
    ];

    return (
        <div className="space-y-6 max-w-2xl mx-auto pb-20">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">Profile</h1>
                <p className="text-sm text-muted-foreground font-medium mt-1">Your vendor account details</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="shadow-sm overflow-hidden border-none bg-white">
                    <div className="h-24 bg-gradient-to-r from-emerald-500 to-teal-400 relative">
                        <div className="absolute -bottom-10 left-6">
                            <div className="h-20 w-20 rounded-2xl bg-card border-4 border-white shadow-lg flex items-center justify-center bg-white">
                                <span className="text-3xl font-black text-emerald-600">{vendor?.name?.charAt(0) || "V"}</span>
                            </div>
                        </div>
                    </div>
                    <div className="pt-14 px-6 pb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-xl font-black">{vendor?.name || "Vendor"}</h2>
                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] font-black px-2">
                                        <Shield className="h-2.5 w-2.5 mr-1" /> Verified
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground font-medium">ID: {vendor?._id?.toString().slice(-8).toUpperCase()}</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* Zones Section */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="shadow-sm border-none bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between bg-emerald-50/30">
                        <div>
                            <CardTitle className="text-lg font-bold">Managed Zones</CardTitle>
                            <CardDescription className="text-xs">Areas where you operate</CardDescription>
                        </div>
                        <Button size="sm" variant="outline" className="h-8 rounded-lg font-bold text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setIsZoneModalOpen(true)}>
                            <Plus className="h-3.5 w-3.5" /> Request Zone
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap gap-2">
                            {(vendor?.zones || []).map(z => (
                                <Badge key={z} className="bg-white border-emerald-100 text-emerald-700 text-xs font-bold py-1.5 px-3 rounded-xl flex items-center gap-2">
                                    <MapPin className="h-3 w-3 text-emerald-400" /> {z}
                                </Badge>
                            ))}
                            {(vendor?.zones || []).length === 0 && (
                                <p className="text-sm text-muted-foreground font-medium italic">No zones assigned</p>
                            )}
                        </div>

                        {vendor?.pendingZones?.length > 0 && (
                            <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-3">Pending Approval</p>
                                <div className="flex flex-wrap gap-2">
                                    {vendor.pendingZones.map(z => (
                                        <Badge key={z} variant="outline" className="bg-white/50 border-amber-200 text-amber-700 text-[11px] font-bold py-1 px-2.5 rounded-lg italic">
                                            {z}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="shadow-sm border-none bg-white">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Account Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-0">
                        {fields.map((field, i) => {
                            const Icon = field.icon;
                            return (
                                <motion.div
                                    key={field.label}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 + i * 0.05 }}
                                    className="flex items-center gap-4 py-3.5 border-b border-border/30 last:border-0"
                                >
                                    <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover:bg-white transition-colors">
                                        <Icon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{field.label}</p>
                                        <p className="text-sm font-bold mt-0.5">{field.value}</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="space-y-3">
                <Button 
                    variant="outline" 
                    className="w-full h-14 rounded-2xl font-bold text-emerald-700 border-emerald-100 hover:bg-emerald-50 gap-3 shadow-sm"
                    onClick={() => navigate("/vender/notifications")}
                >
                    <Bell className="h-5 w-5" />
                    Notifications
                    {unreadCount > 0 && (
                        <Badge className="ml-auto bg-emerald-600 text-white text-[10px] h-6 min-w-[24px] flex items-center justify-center rounded-full border-none">
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
                
                <Button variant="outline" className="w-full h-14 rounded-2xl font-bold text-red-600 border-red-100 hover:bg-red-50 gap-3 shadow-sm" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" /> Logout
                </Button>
            </motion.div>

            {/* Zone Request Modal */}
            <AnimatePresence>
                {isZoneModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative max-h-[80vh] overflow-y-auto">
                            <button onClick={() => setIsZoneModalOpen(false)} className="absolute right-6 top-6 p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                            
                            <div className="mb-6">
                                <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                                    <MapPin className="h-6 w-6 text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900">Add Service Zones</h3>
                                <p className="text-sm text-gray-500 mt-1 font-medium">Select areas in {vendor?.city} to expand your reach.</p>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <Label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Available Areas</Label>
                                    {loadingZones ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                                        </div>
                                    ) : availableZones.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {availableZones.map(z => (
                                                <div key={z._id} onClick={() => toggleZone(z.name)} 
                                                    className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedZones.includes(z.name) ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-white border-gray-100 text-gray-600 hover:border-emerald-200'}`}>
                                                    <div className={`h-4 w-4 rounded flex items-center justify-center ${selectedZones.includes(z.name) ? 'bg-white text-emerald-600' : 'bg-gray-100'}`}>
                                                        {selectedZones.includes(z.name) && <Check className="h-3 w-3" />}
                                                    </div>
                                                    <span className="text-xs font-black truncate">{z.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-center text-muted-foreground py-4 italic">No new zones available for this city.</p>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <Label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Other Area (Manual Entry)</Label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input 
                                            placeholder="Enter area name" 
                                            value={customZone} 
                                            onChange={e => setCustomZone(e.target.value)} 
                                            className="pl-10 h-12 rounded-xl border-gray-100 focus:border-emerald-500 font-bold text-sm" 
                                        />
                                    </div>
                                </div>

                                <Button 
                                    onClick={handleRequestZones} 
                                    disabled={submitting || (selectedZones.length === 0 && !customZone)}
                                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-black text-white shadow-xl shadow-emerald-200 gap-2 transition-all active:scale-[0.98]"
                                >
                                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                                    {submitting ? "Sending Request..." : "Request Access"}
                                </Button>
                                
                                <p className="text-[10px] text-center text-muted-foreground font-medium italic">
                                    * Admin will review and approve your request within 24 hours.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
