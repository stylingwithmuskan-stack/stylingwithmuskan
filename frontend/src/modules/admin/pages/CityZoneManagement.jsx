import React, { useState, useEffect } from "react";
import { 
    Plus, MapPin, ChevronRight, Store, Users, 
    Repeat, IndianRupee, Loader2, BarChart3, ChevronDown,
    Edit2, Trash2, AlertTriangle, Star
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/modules/user/components/ui/dialog";
import { toast } from "sonner";
import { api } from "@/modules/user/lib/api";
import { useNavigate } from "react-router-dom";
import ZoneDrawingModal from "@/modules/admin/components/ZoneDrawingModal";

const CityZoneManagement = () => {
    const navigate = useNavigate();
    const [cities, setCities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedCityId, setExpandedCityId] = useState(null);
    const [zones, setZones] = useState({}); // { cityId: [zones] }
    const [zonesLoading, setZonesLoading] = useState({}); // { cityId: boolean }
    const [selectedZone, setSelectedZone] = useState(null);
    const [zoneStats, setZoneStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    
    // Add City/Zone States
    const [isAddCityOpen, setIsAddCityOpen] = useState(false);
    const [isAddZoneOpen, setIsAddZoneOpen] = useState(false);
    const [selectedCityForZone, setSelectedCityForZone] = useState(null);
    const [newName, setNewName] = useState("");
    const [cityMapCenterLat, setCityMapCenterLat] = useState("");
    const [cityMapCenterLng, setCityMapCenterLng] = useState("");
    const [cityMapZoom, setCityMapZoom] = useState("12");
    const [submitting, setSubmitting] = useState(false);

    // Zone Drawing Modal States
    const [isZoneDrawingOpen, setIsZoneDrawingOpen] = useState(false);
    const [cityForDrawing, setCityForDrawing] = useState(null);

    // Edit/Delete States
    const [editingCity, setEditingCity] = useState(null);
    const [deletingCity, setDeletingCity] = useState(null);
    const [editingZone, setEditingZone] = useState(null);
    const [deletingZone, setDeletingZone] = useState(null);

    useEffect(() => {
        fetchCities();
    }, []);

    const redirectToAdminLogin = () => {
        toast.error("Admin session expired. Please login again.");
        navigate("/admin/login", { replace: true });
    };

    const hasAdminToken = () => {
        try {
            return !!localStorage.getItem("swm_admin_token");
        } catch {
            return false;
        }
    };

    const fetchCities = async () => {
        if (!hasAdminToken()) {
            redirectToAdminLogin();
            return;
        }
        try {
            setLoading(true);
            const res = await api.admin.listCities();
            setCities(res.cities || []);
        } catch (err) {
            if (err?.status === 401) {
                redirectToAdminLogin();
                return;
            }
            toast.error("Failed to fetch cities");
        } finally {
            setLoading(false);
        }
    };

    const fetchZones = async (cityId) => {
        if (!hasAdminToken()) {
            redirectToAdminLogin();
            return;
        }
        try {
            setZonesLoading(prev => ({ ...prev, [cityId]: true }));
            const res = await api.admin.listZones(cityId);
            setZones(prev => ({ ...prev, [cityId]: res.zones || [] }));
        } catch (err) {
            if (err?.status === 401) {
                redirectToAdminLogin();
                return;
            }
            toast.error("Failed to fetch zones");
        } finally {
            setZonesLoading(prev => ({ ...prev, [cityId]: false }));
        }
    };

    const fetchZoneStats = async (zoneId) => {
        if (!hasAdminToken()) {
            redirectToAdminLogin();
            return;
        }
        try {
            setStatsLoading(true);
            const res = await api.admin.getZoneStats(zoneId);
            setZoneStats(res);
        } catch (err) {
            if (err?.status === 401) {
                redirectToAdminLogin();
                return;
            }
            toast.error("Failed to fetch zone stats");
        } finally {
            setStatsLoading(false);
        }
    };

    const toggleCity = (city) => {
        if (expandedCityId === city._id) {
            setExpandedCityId(null);
        } else {
            setExpandedCityId(city._id);
            if (!zones[city._id]) {
                fetchZones(city._id);
            }
        }
    };

    const handleZoneClick = (zone) => {
        setSelectedZone(zone);
        fetchZoneStats(zone._id);
    };

    const handleAddCity = async () => {
        if (!newName.trim()) return;
        if (!hasAdminToken()) {
            redirectToAdminLogin();
            return;
        }
        try {
            setSubmitting(true);
            await api.admin.createCity({
                name: newName,
                mapCenterLat: cityMapCenterLat,
                mapCenterLng: cityMapCenterLng,
                mapZoom: cityMapZoom,
            });
            toast.success("City added successfully");
            setNewName("");
            setCityMapCenterLat("");
            setCityMapCenterLng("");
            setCityMapZoom("12");
            setIsAddCityOpen(false);
            fetchCities();
        } catch (err) {
            if (err?.status === 401) {
                redirectToAdminLogin();
                return;
            }
            toast.error(err.message || "Failed to add city");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddZone = async () => {
        if (!newName.trim() || !selectedCityForZone) return;
        if (!hasAdminToken()) {
            redirectToAdminLogin();
            return;
        }
        try {
            setSubmitting(true);
            await api.admin.createZone(selectedCityForZone._id, { name: newName });
            toast.success("Zone added successfully");
            setNewName("");
            setIsAddZoneOpen(false);
            fetchZones(selectedCityForZone._id);
        } catch (err) {
            if (err?.status === 401) {
                redirectToAdminLogin();
                return;
            }
            toast.error(err.message || "Failed to add zone");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveZoneWithCoordinates = async (zoneData) => {
        if (!hasAdminToken()) {
            redirectToAdminLogin();
            return;
        }
        try {
            if (editingZone) {
                await api.admin.updateZone(editingZone._id, {
                    name: zoneData.name,
                    coordinates: zoneData.coordinates
                });
                toast.success("Zone updated successfully");
            } else {
                await api.admin.createZone(zoneData.cityId, {
                    name: zoneData.name,
                    coordinates: zoneData.coordinates
                });
                toast.success("Zone created successfully");
            }
            setIsZoneDrawingOpen(false);
            setCityForDrawing(null);
            setEditingZone(null);
            fetchZones(zoneData.cityId);
        } catch (err) {
            if (err?.status === 401) {
                redirectToAdminLogin();
                return;
            }
            throw err; // Re-throw to let modal handle the error
        }
    };

    const handleUpdateCity = async () => {
        if (!newName.trim() || !editingCity) return;
        try {
            setSubmitting(true);
            await api.admin.updateCity(editingCity._id, {
                name: newName,
                mapCenterLat: cityMapCenterLat,
                mapCenterLng: cityMapCenterLng,
                mapZoom: cityMapZoom,
            });
            toast.success("City updated successfully");
            setNewName("");
            setCityMapCenterLat("");
            setCityMapCenterLng("");
            setCityMapZoom("12");
            setEditingCity(null);
            fetchCities();
        } catch (err) {
            toast.error(err.message || "Failed to update city");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteCity = async () => {
        if (!deletingCity) return;
        try {
            setSubmitting(true);
            await api.admin.deleteCity(deletingCity._id);
            toast.success("City deleted successfully");
            setDeletingCity(null);
            fetchCities();
        } catch (err) {
            toast.error(err.message || "Failed to delete city");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateZone = async () => {
        if (!newName.trim() || !editingZone) return;
        try {
            setSubmitting(true);
            await api.admin.updateZone(editingZone._id, { name: newName });
            toast.success("Zone updated successfully");
            setNewName("");
            setEditingZone(null);
            // Extract cityId properly - handle both ObjectId string and populated object
            const cityId = typeof editingZone.city === 'object' ? editingZone.city._id : editingZone.city;
            fetchZones(cityId);
        } catch (err) {
            toast.error(err.message || "Failed to update zone");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteZone = async () => {
        if (!deletingZone) return;
        try {
            setSubmitting(true);
            await api.admin.deleteZone(deletingZone._id);
            toast.success("Zone deleted successfully");
            // Extract cityId properly - handle both ObjectId string and populated object
            const cityId = typeof deletingZone.city === 'object' ? deletingZone.city._id : deletingZone.city;
            setDeletingZone(null);
            fetchZones(cityId);
        } catch (err) {
            toast.error(err.message || "Failed to delete zone");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2"><MapPin className="h-7 w-7 text-primary" /> Cities & Zones</h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Manage service areas and track performance</p>
                </div>
                <div className="flex items-center gap-3">
                    <Card className="hidden md:flex items-center gap-4 px-4 py-2 border-border/50 shadow-none bg-muted/30 rounded-2xl">
                        <div className="text-center border-r border-border/50 pr-4">
                            <p className="text-xl font-black text-primary">{cities.length}</p>
                            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Cities</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-black text-primary">{Object.values(zones).flat().length || "0"}</p>
                            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Zones</p>
                        </div>
                    </Card>
                    <Button 
                        onClick={() => {
                            setNewName("");
                            setCityMapCenterLat("");
                            setCityMapCenterLng("");
                            setCityMapZoom("12");
                            setIsAddCityOpen(true);
                        }}
                        className="bg-primary hover:bg-primary/90 text-white rounded-xl px-6 h-11 font-bold shadow-none"
                    >
                        <Plus className="h-5 w-5 mr-2" /> Add New City
                    </Button>
                </div>
            </motion.div>

            {/* Global Coverage Summary for Mobile */}
            <div className="md:hidden grid grid-cols-2 gap-4">
                <Card className="p-4 border-none shadow-none bg-primary/10 text-primary rounded-2xl">
                    <p className="text-3xl font-black">{cities.length}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Active Cities</p>
                </Card>
                <Card className="p-4 border-none shadow-none bg-muted/30 text-foreground rounded-2xl">
                    <p className="text-3xl font-black">{Object.values(zones).flat().length || "0"}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Hubs</p>
                </Card>
            </div>

            {/* Accordion List */}
            <div className="space-y-2">
                {loading ? (
                    <div className="py-20 flex justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                ) : cities.length === 0 ? (
                    <Card className="border-border/50 shadow-none"><CardContent className="py-16 text-center">
                        <MapPin className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                        <p className="text-sm font-bold text-muted-foreground">No cities added yet</p>
                    </CardContent></Card>
                ) : (
                    cities.map((city) => (
                        <div key={city._id} className="group">
                            <Card 
                                className={`rounded-2xl border-border/50 shadow-none overflow-hidden transition-all duration-300 ${
                                    expandedCityId === city._id ? "ring-1 ring-primary/30" : "hover:border-primary/30"
                                }`}
                            >
                                <div className="w-full flex items-center justify-between p-4 bg-card">
                                    <div 
                                        onClick={() => toggleCity(city)}
                                        className="flex items-center gap-4 flex-1 cursor-pointer"
                                    >
                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
                                            expandedCityId === city._id ? "bg-primary text-white" : "bg-primary/15 text-primary"
                                        }`}>
                                            <MapPin className="h-5 w-5" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-sm font-bold truncate">{city.name}</h3>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                                {zones[city._id]?.length || 0} Active Zones
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 sm:gap-2 mr-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingCity(city);
                                                    setNewName(city.name);
                                                    setCityMapCenterLat(city.mapCenterLat ?? "");
                                                    setCityMapCenterLng(city.mapCenterLng ?? "");
                                                    setCityMapZoom(String(city.mapZoom ?? 12));
                                                }}
                                                className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeletingCity(city);
                                                }}
                                                className="h-8 w-8 text-muted-foreground hover:text-red-500 rounded-lg"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCityForDrawing(city);
                                                setEditingZone(null);
                                                setIsZoneDrawingOpen(true);
                                            }}
                                            className="h-8 px-3 rounded-lg text-primary hover:bg-primary/5 font-bold hidden sm:flex text-xs"
                                        >
                                            <Plus className="h-4 w-4 mr-1.5" /> Add Zone
                                        </Button>
                                        <div 
                                            onClick={() => toggleCity(city)}
                                            className={`p-1 rounded-full transition-transform duration-300 cursor-pointer ${expandedCityId === city._id ? "rotate-180 text-primary" : "text-muted-foreground/40"}`}
                                        >
                                            <ChevronDown className="h-5 w-5" />
                                        </div>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {expandedCityId === city._id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <div className="px-4 pb-4 pt-1 bg-muted/30 border-t border-border/50">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {zonesLoading[city._id] ? (
                                                        <div className="col-span-full py-8 flex justify-center">
                                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                        </div>
                                                    ) : !zones[city._id] || zones[city._id].length === 0 ? (
                                                        <div className="col-span-full py-6 text-center text-muted-foreground font-bold text-xs italic">
                                                            No zones added in {city.name} yet.
                                                        </div>
                                                    ) : (
                                                        zones[city._id].map((zone) => (
                                                            <button
                                                                key={zone._id}
                                                                onClick={() => handleZoneClick(zone)}
                                                                className="flex items-center justify-between p-3 bg-card rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-sm transition-all group/zone"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover/zone:bg-primary group-hover/zone:text-white transition-colors">
                                                                        <BarChart3 className="h-4 w-4" />
                                                                    </div>
                                                                    <span className="text-sm font-bold text-foreground">{zone.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 sm:gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingZone(zone);
                                                                            setCityForDrawing(city);
                                                                            setIsZoneDrawingOpen(true);
                                                                        }}
                                                                        className="h-7 w-7 text-muted-foreground hover:text-primary rounded-lg"
                                                                    >
                                                                        <Edit2 className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setDeletingZone(zone);
                                                                        }}
                                                                        className="h-7 w-7 text-muted-foreground hover:text-red-500 rounded-lg"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover/zone:text-primary transition-colors ml-1" />
                                                                </div>
                                                            </button>
                                                        ))
                                                    )}
                                                    
                                                    {/* Mobile Add Zone Button */}
                                                    <button 
                                                        onClick={() => {
                                                            setCityForDrawing(city);
                                                            setIsZoneDrawingOpen(true);
                                                        }}
                                                        className="sm:hidden flex items-center justify-center gap-2 p-3 border border-dashed border-border/50 rounded-xl text-muted-foreground font-bold hover:bg-card hover:border-primary/30 hover:text-primary transition-all text-xs"
                                                    >
                                                        <Plus className="h-4 w-4" /> Add New Zone
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </Card>
                        </div>
                    ))
                )}
            </div>

            {/* Zone Stats Modal */}
            <Dialog open={!!selectedZone && !!zoneStats} onOpenChange={() => { setSelectedZone(null); setZoneStats(null); }}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-2xl border border-border shadow-2xl">
                    {statsLoading ? (
                        <div className="p-20 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="font-bold text-muted-foreground animate-pulse">Fetching zone insights...</p>
                        </div>
                    ) : zoneStats && (
                        <div className="flex flex-col">
                            {/* Modal Header - Matched with SPOversight modal header */}
                            <div className="p-6 space-y-5">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-green-500 flex items-center justify-center text-white text-2xl font-black">
                                        {zoneStats.zone?.name?.charAt(0) || "?"}
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black">{zoneStats.zone?.name} Insights</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[9px] font-black bg-primary/10 text-primary border-none">
                                                {zoneStats.zone?.city?.name || "Global Hub"}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground font-medium">Zone ID: {zoneStats.zone?._id}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Grid - Using SPOversight style */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Store className="h-3 w-3" /> Vendors</p>
                                        <p className="text-lg font-black mt-1 text-blue-500">{zoneStats.vendors?.length || 0}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Users className="h-3 w-3" /> Service Pros</p>
                                        <p className="text-lg font-black mt-1 text-purple-500">{zoneStats.providers?.length || 0}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Revenue</p>
                                        <p className="text-lg font-black mt-1 text-green-600">₹{(zoneStats.metrics?.totalRevenue || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Repeat className="h-3 w-3" /> Repeats</p>
                                        <p className="text-lg font-black mt-1 text-amber-500">{zoneStats.metrics?.repeatCustomers || 0}</p>
                                    </div>
                                </div>

                                {/* Detailed Lists */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Zone Vendors</h3>
                                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                            {zoneStats.vendors?.map(v => (
                                                <div key={v._id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                                                    <span className="text-xs font-bold text-foreground">{v.businessName || v.name}</span>
                                                    <Badge variant="outline" className="text-[8px] font-black bg-blue-500/10 text-blue-500 border-none">
                                                        {v.status || "active"}
                                                    </Badge>
                                                </div>
                                            ))}
                                            {(!zoneStats.vendors || zoneStats.vendors.length === 0) && (
                                                <p className="text-center py-8 text-muted-foreground text-[10px] font-bold italic">No vendors in this zone</p>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Service Providers</h3>
                                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                            {zoneStats.providers?.map(p => (
                                                <div key={p._id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                                                    <span className="text-xs font-bold text-foreground">{p.name}</span>
                                                    <div className="flex items-center gap-1 text-amber-500">
                                                        <Star className="h-3 w-3" />
                                                        <span className="text-[10px] font-black">{p.rating || "4.0"}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!zoneStats.providers || zoneStats.providers.length === 0) && (
                                                <p className="text-center py-8 text-muted-foreground text-[10px] font-bold italic">No SPs in this zone</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button onClick={() => { setSelectedZone(null); setZoneStats(null); }} className="flex-1 h-11 bg-primary hover:bg-primary/90 rounded-xl font-bold">
                                        Close Insights
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Add City Dialog */}
            <Dialog open={isAddCityOpen} onOpenChange={setIsAddCityOpen}>
                <DialogContent className="sm:max-w-[400px] rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Add New City</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">City Name</p>
                            <Input 
                                placeholder="e.g. Mumbai, Delhi" 
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="h-11 rounded-xl border-border/50 focus:ring-primary font-bold text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <Input
                                placeholder="Lat"
                                value={cityMapCenterLat}
                                onChange={(e) => setCityMapCenterLat(e.target.value)}
                                className="h-11 rounded-xl border-border/50 focus:ring-primary font-bold text-sm"
                            />
                            <Input
                                placeholder="Lng"
                                value={cityMapCenterLng}
                                onChange={(e) => setCityMapCenterLng(e.target.value)}
                                className="h-11 rounded-xl border-border/50 focus:ring-primary font-bold text-sm"
                            />
                            <Input
                                placeholder="Zoom"
                                value={cityMapZoom}
                                onChange={(e) => setCityMapZoom(e.target.value)}
                                className="h-11 rounded-xl border-border/50 focus:ring-primary font-bold text-sm"
                            />
                        </div>
                        <Button 
                            onClick={handleAddCity}
                            disabled={submitting || !newName.trim()}
                            className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold"
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add City"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Zone Dialog */}
            <Dialog open={isAddZoneOpen} onOpenChange={setIsAddZoneOpen}>
                <DialogContent className="sm:max-w-[400px] rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Add Zone to {selectedCityForZone?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Zone Name</p>
                            <Input 
                                placeholder="e.g. Andheri, Connaught Place" 
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="h-11 rounded-xl border-border/50 focus:ring-primary font-bold text-sm"
                            />
                        </div>
                        <Button 
                            onClick={handleAddZone}
                            disabled={submitting || !newName.trim()}
                            className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold"
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Zone"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit City Dialog */}
            <Dialog open={!!editingCity} onOpenChange={(open) => !open && setEditingCity(null)}>
                <DialogContent className="sm:max-w-[400px] rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black flex items-center gap-2"><Edit2 className="h-5 w-5 text-primary" /> Edit City</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">City Name</p>
                            <Input 
                                placeholder="e.g. Mumbai" 
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="h-11 rounded-xl border-border/50 focus:ring-primary font-bold text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <Input
                                placeholder="Lat"
                                value={cityMapCenterLat}
                                onChange={(e) => setCityMapCenterLat(e.target.value)}
                                className="h-11 rounded-xl border-border/50 focus:ring-primary font-bold text-sm"
                            />
                            <Input
                                placeholder="Lng"
                                value={cityMapCenterLng}
                                onChange={(e) => setCityMapCenterLng(e.target.value)}
                                className="h-11 rounded-xl border-border/50 focus:ring-primary font-bold text-sm"
                            />
                            <Input
                                placeholder="Zoom"
                                value={cityMapZoom}
                                onChange={(e) => setCityMapZoom(e.target.value)}
                                className="h-11 rounded-xl border-border/50 focus:ring-primary font-bold text-sm"
                            />
                        </div>
                        <Button 
                            onClick={handleUpdateCity}
                            disabled={submitting || !newName.trim()}
                            className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold"
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update City"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete City Confirmation */}
            <Dialog open={!!deletingCity} onOpenChange={(open) => !open && setDeletingCity(null)}>
                <DialogContent className="sm:max-w-[400px] rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black flex items-center gap-2 text-red-500"><AlertTriangle className="h-5 w-5" /> Delete City?</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <p className="text-sm text-muted-foreground font-medium">
                            Are you sure you want to delete <span className="font-bold text-foreground">{deletingCity?.name}</span>? 
                            This will also delete all associated zones. This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setDeletingCity(null)}>Cancel</Button>
                            <Button 
                                onClick={handleDeleteCity}
                                disabled={submitting}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Zone Dialog removed in favor of ZoneDrawingModal */}

            {/* Delete Zone Confirmation */}
            <Dialog open={!!deletingZone} onOpenChange={(open) => !open && setDeletingZone(null)}>
                <DialogContent className="sm:max-w-[400px] rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black flex items-center gap-2 text-red-500"><AlertTriangle className="h-5 w-5" /> Delete Zone?</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <p className="text-sm text-muted-foreground font-medium">
                            Are you sure you want to delete zone <span className="font-bold text-foreground">{deletingZone?.name}</span>? 
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setDeletingZone(null)}>Cancel</Button>
                            <Button 
                                onClick={handleDeleteZone}
                                disabled={submitting}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Zone Drawing Modal */}
            <ZoneDrawingModal
                isOpen={isZoneDrawingOpen}
                onClose={() => {
                    setIsZoneDrawingOpen(false);
                    setCityForDrawing(null);
                }}
                city={cityForDrawing}
                existingZones={cityForDrawing?._id ? (zones[cityForDrawing._id] || []) : []}
                zoneToEdit={editingZone}
                onSave={handleSaveZoneWithCoordinates}
            />
        </div>
    );
};

export default CityZoneManagement;

