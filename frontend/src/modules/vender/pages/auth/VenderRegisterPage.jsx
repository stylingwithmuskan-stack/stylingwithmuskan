import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Store, User, Mail, Phone, MapPin, Building2, ArrowRight, X, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/user/components/ui/select";
import { Checkbox } from "@/modules/user/components/ui/checkbox";
import { Badge } from "@/modules/user/components/ui/badge";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/modules/user/lib/api";

export default function VenderRegisterPage() {
    const { registerRequest, verifyRegistrationOtp, isLoggedIn } = useVenderAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", cityId: "", zones: [], zoneIds: [], customZone: "", lat: null, lng: null });
    const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [otpDeliveryMode, setOtpDeliveryMode] = useState("sms");
    
    const [cities, setCities] = useState([]);
    const [zones, setZones] = useState([]);
    const [zonesLoading, setZonesLoading] = useState(false);

    const syncSelectedZoneIds = (selectedZoneNames, nextZones = zones) => {
        const nextZoneIds = nextZones
            .filter((zone) => selectedZoneNames.includes(zone.name))
            .map((zone) => zone._id);
        setForm((prev) => ({ ...prev, zones: selectedZoneNames, zoneIds: nextZoneIds }));
    };

    useEffect(() => {
        document.documentElement.classList.remove("theme-women", "theme-men", "theme-beautician", "theme-admin");
        document.documentElement.classList.add("theme-vendor");
        
        // Fetch cities on mount
        api.content.cities().then(res => {
            setCities(res.cities || []);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (form.city) {
            setZonesLoading(true);
            api.content.zones({ cityName: form.city }).then(res => {
                const nextZones = res.zones || [];
                setZones(nextZones);
                setForm(prev => {
                    const nextSelectedZones = prev.zones.filter((zoneName) => nextZones.some((zone) => zone.name === zoneName));
                    const nextSelectedZoneIds = nextZones
                        .filter((zone) => nextSelectedZones.includes(zone.name))
                        .map((zone) => zone._id);
                    return { ...prev, zones: nextSelectedZones, zoneIds: nextSelectedZoneIds };
                });
            }).catch(() => {
                setZones([]);
            }).finally(() => {
                setZonesLoading(false);
            });
        } else {
            setZones([]);
        }
    }, [form.city]);

    useEffect(() => {
        if (isLoggedIn) navigate("/vender/dashboard", { replace: true });
    }, [isLoggedIn]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic validation
        if (!form.name.trim()) {
            toast.error("Please enter your name");
            return;
        }
        if (!/^\S+@\S+\.\S+$/.test(form.email)) {
            toast.error("Please enter a valid email address");
            return;
        }
        if (!/^[6-9]\d{9}$/.test(form.phone)) {
            toast.error("Please enter a valid 10-digit phone number");
            return;
        }
        if (!form.city) {
            toast.error("Please select a city");
            return;
        }
        if (form.zones.length === 0 && !form.customZone.trim()) {
            toast.error("Please select at least one zone");
            return;
        }

        setLoading(true);
        try {
            const res = await registerRequest(form.phone);
            if (res?.success) {
                setOtpDeliveryMode(res?.deliveryMode || "sms");
                setIsOtpModalOpen(true);
                toast.success(res?.message || "OTP sent to your mobile number");
            }
        } catch (err) {
            toast.error(err.message || "Failed to send OTP");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length !== 6) {
            toast.error("Please enter a valid 6-digit OTP");
            return;
        }
        setLoading(true);
        try {
            const finalZones = [...form.zones];
            if (form.customZone.trim()) finalZones.push(form.customZone.trim());
            
            const res = await verifyRegistrationOtp({ ...form, zones: finalZones, otp });
            if (res?.success) {
                toast.success("Registration request submitted! Please wait for admin approval.");
                navigate("/vender/status");
            }
        } catch (err) {
            toast.error(err.message || "OTP verification failed");
        } finally {
            setLoading(false);
        }
    };

    const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const toggleZone = (zoneName) => {
        const current = [...form.zones];
        const idx = current.indexOf(zoneName);
        if (idx > -1) current.splice(idx, 1);
        else current.push(zoneName);
        syncSelectedZoneIds(current);
    };

    const selectAllZones = () => {
        if (form.zones.length === zones.length) {
            setForm(prev => ({ ...prev, zones: [], zoneIds: [] }));
        } else {
            syncSelectedZoneIds(zones.map(z => z.name));
        }
    };

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const res = await api.content.resolveLocation({ lat: String(lat), lng: String(lng) });
                    const location = res?.location || {};
                    if (location.insideServiceArea && location.cityName && location.zoneName) {
                        const matchedCity = cities.find((city) => city._id === location.cityId || city.name === location.cityName);
                        const nextCity = matchedCity?.name || location.cityName;
                        const nextCityId = matchedCity?._id || location.cityId || "";
                        let nextZones = [];
                        try {
                            const zonesRes = await api.content.zones({ cityName: nextCity });
                            nextZones = zonesRes?.zones || [];
                            setZones(nextZones);
                        } catch {
                            nextZones = [];
                            setZones([]);
                        }
                        const resolvedZone = nextZones.find((zone) => zone._id === location.zoneId || zone.name === location.zoneName);
                        setForm((prev) => ({
                            ...prev,
                            city: nextCity,
                            cityId: nextCityId,
                            zones: resolvedZone ? [resolvedZone.name] : (location.zoneName ? [location.zoneName] : prev.zones),
                            zoneIds: resolvedZone ? [resolvedZone._id] : (location.zoneId ? [location.zoneId] : prev.zoneIds),
                            lat,
                            lng,
                        }));
                        toast.success(`Detected zone: ${location.zoneName}`);
                    } else {
                        setForm((prev) => ({ ...prev, lat, lng, zones: [], zoneIds: [] }));
                        toast.error("Your current location is out of zone, apply for the custom zone.");
                    }
                } catch (err) {
                    toast.error(err?.message || "Unable to resolve your current location");
                } finally {
                    setLoading(false);
                }
            },
            () => {
                setLoading(false);
                toast.error("Unable to retrieve your location");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50/30 to-white p-4">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[520px]">
                <div className="text-center mb-8">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
                        className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
                        <Store className="h-8 w-8 text-white" />
                    </motion.div>
                    <h1 className="text-2xl font-black tracking-tight text-gray-900">Register as Vendor</h1>
                    <p className="text-sm text-gray-500 font-medium mt-1 uppercase tracking-widest">Join stylingwithmuskan network</p>
                </div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-emerald-100/30 p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <Label className="text-xs font-bold text-gray-600">Full Name</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input placeholder="John Doe" value={form.name} onChange={e => update("name", e.target.value)} className="pl-10 h-11 rounded-xl" required />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-600">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input type="email" placeholder="vendor@swm.com" value={form.email} onChange={e => update("email", e.target.value)} className="pl-10 h-11 rounded-xl" required />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-600">Phone</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input type="tel" placeholder="9876543210" value={form.phone} onChange={e => update("phone", e.target.value)} className="pl-10 h-11 rounded-xl" required />
                                </div>
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label className="text-xs font-bold text-gray-600">City</Label>
                                <Select value={form.city} onValueChange={val => {
                                    const selectedCity = cities.find((c) => c.name === val);
                                    setForm((prev) => ({
                                        ...prev,
                                        city: val,
                                        cityId: selectedCity?._id || "",
                                        zones: [],
                                        zoneIds: [],
                                    }));
                                }}>
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder="Select city" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {cities.map(c => <SelectItem key={c._id} value={c.name}>{c.name}</SelectItem>)}
                                        {cities.length === 0 && <SelectItem value="indore" disabled>Loading cities...</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="col-span-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleUseCurrentLocation}
                                    disabled={loading}
                                    className="w-full h-11 rounded-xl font-bold"
                                >
                                    <MapPin className="h-4 w-4 mr-2" />
                                    {form.lat && form.lng ? "Location Captured" : "Use Current Location"}
                                </Button>
                            </div>
                            
                            {form.city && (
                                <div className="space-y-3 col-span-2 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <Label className="text-xs font-black text-emerald-800 uppercase tracking-wider">Service Zones (Multiple)</Label>
                                        <Button type="button" variant="ghost" size="sm" onClick={selectAllZones} className="h-7 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100">
                                            {form.zones.length === zones.length ? "Deselect All" : "Select All Zones"}
                                        </Button>
                                    </div>
                                    
                                    {zonesLoading ? (
                                        <p className="text-xs text-emerald-600 animate-pulse">Fetching zones...</p>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            {zones.map(z => (
                                                <div key={z._id} onClick={() => toggleZone(z.name)} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${form.zones.includes(z.name) ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white border-gray-100 text-gray-600 hover:border-emerald-200'}`}>
                                                    <div className={`h-4 w-4 rounded flex items-center justify-center ${form.zones.includes(z.name) ? 'bg-white text-emerald-600' : 'bg-gray-100'}`}>
                                                        {form.zones.includes(z.name) && <Check className="h-3 w-3" />}
                                                    </div>
                                                    <span className="text-xs font-bold truncate">{z.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-2 mt-2 border-t border-emerald-100">
                                        <Label className="text-[10px] font-bold text-emerald-700 uppercase mb-2 block">Custom Zone (If not in list)</Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400" />
                                            <Input placeholder="Enter custom area name" value={form.customZone} onChange={e => update("customZone", e.target.value)} className="pl-9 h-9 rounded-lg text-xs border-emerald-100 bg-white" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <Button type="submit" disabled={loading || !form.city || (form.zones.length === 0 && !form.customZone)} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold text-white gap-2 shadow-lg shadow-emerald-200 mt-2">
                            {loading ? "Sending OTP..." : "Register"} <ArrowRight className="h-4 w-4" />
                        </Button>
                    </form>
                    <div className="space-y-4 pt-4 mt-4 border-t border-gray-100">
                        <p className="text-center text-xs text-gray-500 font-medium">
                            Already registered? <Link to="/vender/login" className="text-emerald-600 font-bold hover:underline">Login here</Link>
                        </p>
                        <div className="flex items-center justify-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-wider pt-2">
                            <Link to="/vendor/contact-us" className="hover:text-emerald-600 transition-colors">Contact Support</Link>
                            <span className="h-1 w-1 rounded-full bg-gray-300"></span>
                            <Link to="/vender/about-us" className="hover:text-emerald-600 transition-colors">About Us</Link>
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            <AnimatePresence>
                {isOtpModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
                            <button onClick={() => setIsOtpModalOpen(false)} className="absolute right-4 top-4 p-1 hover:bg-gray-100 rounded-full">
                                <X className="h-4 w-4 text-gray-400" />
                            </button>
                            <div className="text-center mb-6">
                                <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                                    <Phone className="h-6 w-6 text-emerald-600" />
                                </div>
                                <h3 className="text-lg font-black text-gray-900">Verify Mobile</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    {otpDeliveryMode === "allowlist"
                                        ? `Enter the 6-digit OTP for ${form.phone}`
                                        : `Enter the 6-digit OTP sent to ${form.phone}`}
                                </p>
                            </div>
                            <div className="space-y-4">
                                <Input type="text" maxLength={6} placeholder="Enter 6-digit OTP" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                                    className="text-center text-2xl font-black tracking-[0.5em] h-14 rounded-xl border-2 focus:border-emerald-500" />
                                <Button onClick={handleVerifyOtp} disabled={loading || otp.length !== 6}
                                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold text-white shadow-lg shadow-emerald-200">
                                    {loading ? "Verifying..." : "Verify & Submit"}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
