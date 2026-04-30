import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, CheckCircle, XCircle, Ban, UserCheck, Phone, RefreshCw, Star, TrendingUp, Clock, AlertCircle, Award, FileText, Shield, Settings, Eye, Edit2, Save, X, CalendarRange, MapPin, Wallet, Plus, Camera } from "lucide-react";

import { Card, CardContent } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/user/components/ui/tabs";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/modules/user/components/ui/pagination";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { api } from "@/modules/user/lib/api";

import { toast } from "sonner";
import { cn } from "@/modules/user/lib/utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const statusColors = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    pending_vendor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    pending_admin: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    approved: "bg-green-500/15 text-green-400 border-green-500/30",
    rejected: "bg-red-500/15 text-red-400 border-red-500/30",
    blocked: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function SPOversight() {
    const { 
        getAllServiceProviders, 
        updateSPStatus, 
        approveProviderZones, 
        rejectProviderZones,
        getParents, 
        getCategories, 
        getServices, 
        updateProviderProfile,
        updateProviderProfilePhoto,
        getLeaves,
        approveLeave,
        rejectLeave,
        adjustProviderWallet,
        updateProviderGrade
    } = useAdminAuth();


    const [providers, setProviders] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("all");
    const [categoryRequests, setCategoryRequests] = useState([]);
    const [selectedSP, setSelectedSP] = useState(null);
    const [spSummary, setSpSummary] = useState(null);
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);
    const [isEditingGrade, setIsEditingGrade] = useState(false);
    const [tempGrade, setTempGrade] = useState("");

    useEffect(() => {
        if (selectedSP?.phone) {
            fetchSPSummary(selectedSP.phone);
        } else {
            setSpSummary(null);
            setIsEditingGrade(false);
        }
    }, [selectedSP]);

    const fetchSPSummary = async (phone) => {
        setIsLoadingSummary(true);
        try {
            const data = await api.provider.summary(phone);
            if (data && data.performance) {
                setSpSummary(data);
                setTempGrade(data.performance?.grade || "Standard");
            }
        } catch (error) {
            console.error("Failed to fetch SP summary:", error);
        } finally {
            setIsLoadingSummary(false);
        }
    };

    const handleUpdateGrade = async () => {
        if (!selectedSP?._id && !selectedSP?.id) return;
        const id = selectedSP._id || selectedSP.id;
        try {
            await updateProviderGrade(id, tempGrade);
            toast.success("Performance grade updated successfully");
            setIsEditingGrade(false);
            // Refresh summary to reflect changes
            fetchSPSummary(selectedSP.phone);
        } catch (error) {
            toast.error(error.message || "Failed to update grade");
        }
    };

    const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
    
    // Pagination state
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [total, setTotal] = useState(0);
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [loading, setLoading] = useState(false);
    
    // Profile Editing State
    const [isEditingCategories, setIsEditingCategories] = useState(false);
    const [tempCategories, setTempCategories] = useState([]);
    const [tempSpecializations, setTempSpecializations] = useState([]);
    const [tempServices, setTempServices] = useState([]);
    const [availableParents, setAvailableParents] = useState([]);
    const [availableCategories, setAvailableCategories] = useState([]);
    const [availableServices, setAvailableServices] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isContentLoading, setIsContentLoading] = useState(false);
    
    // Profile Photo Upload State
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const fileInputRef = useRef(null);
    const [brokenPhotoProviderIds, setBrokenPhotoProviderIds] = useState(() => new Set());
    const [isWalletAdjusting, setIsWalletAdjusting] = useState(false);
    const [walletAmount, setWalletAmount] = useState("");
    const [walletType, setWalletType] = useState("add");
    const [walletReason, setWalletReason] = useState("");

    const buildPortfolioPayload = () => {
        const selectedParents = availableParents.filter((p) => tempCategories.includes(p.label));
        const selectedCategories = availableCategories.filter((c) => tempSpecializations.includes(c.name));
        const selectedServices = availableServices.filter((s) => tempServices.includes(s.name));

        const mapParent = selectedParents.map((p) => ({ id: p.id, label: p.label }));
        const mapCategory = selectedCategories.map((c) => ({ id: c.id, name: c.name }));
        const mapService = selectedServices.map((s) => ({ id: s.id, name: s.name, category: s.category }));

        return {
            primaryCategory: [...tempCategories, ...mapParent],
            specializations: [...tempSpecializations, ...mapCategory],
            services: [...tempServices, ...mapService],
        };
    };


    const [feedback, setFeedback] = useState([]);
    
    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Reset page to 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [tab, debouncedSearch]);

    const load = async () => {
        // Only paginate provider tabs, not category-requests or leaves
        const shouldPaginate = ["all", "pending", "approved", "blocked"].includes(tab);
        
        if (shouldPaginate) {
            setLoading(true);
        }
        
        try {
            const response = shouldPaginate 
                ? await getAllServiceProviders({ page, limit })
                : await getAllServiceProviders({ limit: 1000 }); // Load all for non-paginated tabs
            
            // Handle both array (old format) and object with pagination (new format)
            const providerList = Array.isArray(response) 
                ? response 
                : (response?.providers || []);
            const totalCount = response?.total || providerList.length;
            
            const normalized = providerList.map((p) => ({ 
                ...p, 
                profilePhoto: p?.profilePhoto ?? "" 
            }));
            
            setProviders(normalized);
            if (shouldPaginate) {
                setTotal(totalCount);
            }
        } catch (err) {
            console.error("Failed to load providers:", err);
            setProviders([]);
        } finally {
            if (shouldPaginate) {
                setLoading(false);
            }
        }

        setFeedback(JSON.parse(localStorage.getItem("muskan-feedback") || "[]"));
        setCategoryRequests(JSON.parse(localStorage.getItem("muskan-category-requests") || "[]"));
        loadLeaves();
    };

    const ensureContent = async () => {
        // Only load if not already loaded or currently loading
        if (isContentLoading || (availableParents.length > 0 && availableCategories.length > 0)) return;

        setIsContentLoading(true);
        try {
            const [parentsRes, catsRes, svcsRes] = await Promise.allSettled([
                getParents(), 
                getCategories({ limit: 1000, minimal: true }), 
                getServices({ limit: 2000, minimal: true })
            ]);

            setAvailableParents(parentsRes.status === 'fulfilled' ? (parentsRes.value || []) : []);
            setAvailableCategories(catsRes.status === 'fulfilled' ? (catsRes.value || []) : []);
            setAvailableServices(svcsRes.status === 'fulfilled' ? (svcsRes.value || []) : []);
        } catch (err) {
            console.error("Critical content load failure:", err);
        } finally {
            setIsContentLoading(false);
        }
    };

    const loadLeaves = async () => {
        setIsLoadingLeaves(true);
        try {
            const data = await getLeaves();
            setLeaves(data || []);
        } catch (error) {
            console.error("Failed to load leaves:", error);
        } finally {
            setIsLoadingLeaves(false);
        }
    };

    useEffect(() => { load(); }, [page, tab, debouncedSearch]);

    const startEditing = () => {
        ensureContent(); // Trigger lazy load if needed
        setTempCategories(selectedSP.documents?.primaryCategory || []);
        setTempSpecializations(selectedSP.documents?.specializations || []);
        setTempServices(selectedSP.documents?.services || []);
        setIsEditingCategories(true);
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const payload = buildPortfolioPayload();
            await updateProviderProfile(selectedSP._id || selectedSP.id, payload);
            toast.success("Provider profile updated successfully");
            setIsEditingCategories(false);
            load();
            // Update selectedSP locally
            setSelectedSP(prev => ({
                ...prev,
                documents: {
                    ...prev.documents,
                    primaryCategory: tempCategories,
                    specializations: tempSpecializations,
                    services: tempServices
                }
            }));
        } catch (error) {
            toast.error(error?.message || "Failed to update profile");
        } finally {
            setIsSaving(false);
        }
    };

    // Profile Photo Upload Handlers
    const handlePhotoFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error("Please select a valid image file");
            return;
        }
        
        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image size must be less than 5MB");
            return;
        }
        
        // Proceed with upload
        handleProfilePhotoUpload(file);
    };

    const handleProfilePhotoUpload = async (file) => {
        if (!selectedSP) return;
        
        setUploadingPhoto(true);
        
        try {
            const targetId = String(selectedSP?._id || selectedSP?.id || "");
            if (!targetId) throw new Error("Provider ID is missing");

            const data = await updateProviderProfilePhoto(targetId, file);
            const nextPhoto = data?.profilePhoto || "";
            
            // Update local state - providers list
            setProviders(prev => prev.map(p => 
                (targetId !== "" && String(p?._id || p?.id || "") === targetId)
                    ? { ...p, profilePhoto: nextPhoto }
                    : p
            ));
            
            // Update selected provider in modal
            setSelectedSP(prev => {
                const prevId = String(prev?._id || prev?.id || "");
                if (!prev || prevId !== targetId) return prev;
                return {
                    ...prev,
                    profilePhoto: nextPhoto
                };
            });

            setBrokenPhotoProviderIds(prev => {
                const next = new Set(prev);
                next.delete(targetId);
                return next;
            });
            
            toast.success("Profile photo updated successfully");
            
        } catch (error) {
            console.error("Photo upload error:", error);
            toast.error(error.message || "Failed to update profile photo");
        } finally {
            setUploadingPhoto(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleWalletAdjust = async () => {
        if (!walletAmount || isNaN(walletAmount)) {
            toast.error("Please enter a valid amount");
            return;
        }
        setIsSaving(true);
        try {
            await adjustProviderWallet(selectedSP._id || selectedSP.id, {
                amount: Number(walletAmount),
                type: walletType,
                reason: walletReason
            });
            toast.success(`Wallet ${walletType === "add" ? "credited" : "debited"} successfully`);
            setIsWalletAdjusting(false);
            setWalletAmount("");
            setWalletReason("");
            
            // Refresh providers and update selectedSP
            const items = await getAllServiceProviders();
            setProviders(Array.isArray(items) ? items : []);
            const fresh = (Array.isArray(items) ? items : []).find(p => (p._id || p.id) === (selectedSP._id || selectedSP.id));
            if (fresh) setSelectedSP(fresh);
        } catch (error) {
            toast.error(error?.message || "Failed to adjust wallet");
        } finally {
            setIsSaving(false);
        }
    };

    const getSPRating = (nameOrId) => {
        const spFeedback = feedback.filter(f => (f.providerName === nameOrId || f.assignedProvider === nameOrId || f.providerId === nameOrId) && f.type === "customer_to_provider");
        if (spFeedback.length === 0) return "0.0";
        const sum = spFeedback.reduce((a, b) => a + Number(b.rating || 0), 0);
        return (sum / spFeedback.length).toFixed(1);
    };

    const getSPStats = (sp) => {
        const bookings = JSON.parse(localStorage.getItem("muskan-bookings") || "[]");
        const id = sp._id || sp.id;
        const name = sp.name;
        
        const spBookings = bookings.filter(b => b.assignedProvider === id || b.assignedProvider === name || b.providerName === name);
        const total = spBookings.length;
        
        if (total === 0) return { bookings: 0, cancelled: "0%", missed: 0, revenue: "0", acceptTime: "N/A" };
        
        const cancelled = spBookings.filter(b => b.status === "cancelled" || b.status === "rejected").length;
        const completed = spBookings.filter(b => b.status === "completed");
        const revenue = completed.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
        
        return {
            bookings: total,
            cancelled: `${Math.round((cancelled / total) * 100)}%`,
            missed: 0, // Missed not explicitly tracked in current status set
            revenue: revenue.toLocaleString(),
            acceptTime: "5 min" // Placeholder or default for active providers
        };
    };

    const filtered = providers.filter(sp => {
        const ms = sp.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) || sp.phone?.includes(debouncedSearch);
        if (tab === "all") return ms;
        if (tab === "pending") return ms && (sp.approvalStatus === "pending" || sp.approvalStatus === "pending_vendor" || sp.approvalStatus === "pending_admin");
        if (tab === "approved") return ms && sp.approvalStatus === "approved";
        if (tab === "blocked") return ms && (sp.approvalStatus === "blocked" || sp.approvalStatus === "rejected");
        return ms;
    });

    const handleAction = async (id, status) => {
        try {
            await updateSPStatus(id, status);
            toast.success(`Status updated to ${status}`);
            load();
            if (selectedSP?._id === id || selectedSP?.id === id) {
                setSelectedSP(prev => ({ ...prev, approvalStatus: status }));
            }
        } catch {
            toast.error("Status update failed");
        }
    };

    const handleZoneAction = async (id, action) => {
        try {
            if (action === "approve") await approveProviderZones(id);
            else await rejectProviderZones(id);
            toast.success(`Zones ${action}d successfully`);
            load();
            if (selectedSP?._id === id || selectedSP?.id === id) {
                const updated = await getAllServiceProviders();
                const found = updated.find(u => u._id === id || u.id === id);
                if (found) setSelectedSP(found);
            }
        } catch {
            toast.error(`Zone ${action} failed`);
        }
    };

    const handleCategoryAction = (id, status) => {
        const requests = JSON.parse(localStorage.getItem("muskan-category-requests") || "[]");
        const updated = requests.map(req => req.id === id ? { ...req, status } : req);
        localStorage.setItem("muskan-category-requests", JSON.stringify(updated));
        load();
    };

    const handleLeaveUpdate = async (id, action) => {
        try {
            if (action === "approve") await approveLeave(id);
            else await rejectLeave(id);
            toast.success(`Leave ${action}d successfully`);
            loadLeaves();
        } catch (err) {
            toast.error(`Failed to ${action} leave`);
        }
    };

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> Service Provider Oversight</h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Global view of all service providers</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={load} variant="outline" className="gap-2 rounded-xl font-bold"><RefreshCw className="h-4 w-4" /> Refresh</Button>
                    <Button onClick={() => setIsPerformanceModalOpen(true)} className="gap-2 rounded-xl font-bold bg-primary"><Settings className="h-4 w-4" /> Performance Criteria</Button>
                </div>
            </motion.div>

            <Tabs value={tab} onValueChange={setTab}>
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                    <TabsList className="bg-muted/30 rounded-xl p-1">
                        <TabsTrigger value="all" className="rounded-lg text-xs font-bold">All ({providers.length})</TabsTrigger>
                        <TabsTrigger value="pending" className="rounded-lg text-xs font-bold">Pending ({providers.filter(s => s.approvalStatus === "pending" || s.approvalStatus === "pending_vendor" || s.approvalStatus === "pending_admin").length})</TabsTrigger>
                        <TabsTrigger value="approved" className="rounded-lg text-xs font-bold">Active</TabsTrigger>
                        <TabsTrigger value="category-requests" className="rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600">Cat. Requests ({categoryRequests.filter(r => r.status === 'pending').length})</TabsTrigger>
                        <TabsTrigger value="blocked" className="rounded-lg text-xs font-bold">Blocked</TabsTrigger>
                        <TabsTrigger value="leaves" className="rounded-lg text-xs font-bold flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> Leave Requests
                            {leaves.filter(l => l.status === "pending").length > 0 && (
                                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            )}
                        </TabsTrigger>
                    </TabsList>
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl h-10 bg-muted/30 border-border/50" />
                    </div>
                </div>
                {["all", "pending", "approved", "blocked"].map(t => (
                    <TabsContent key={t} value={t} className="mt-0">
                    {loading ? (
                        <Card className="border-border/50">
                            <CardContent className="py-24 text-center">
                                <RefreshCw className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
                                <p className="text-sm font-bold text-muted-foreground animate-pulse">Fetching providers...</p>
                            </CardContent>
                        </Card>
                    ) : filtered.length === 0 ? (
                        <Card className="border-border/50"><CardContent className="py-16 text-center">
                            <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-sm font-bold text-muted-foreground">No service providers found</p>
                        </CardContent></Card>
                    ) : (
                        <>
                            <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                            {filtered.map(sp => (
                                <motion.div key={sp._id || sp.id || sp.phone} variants={item}>
                                    <Card className="border-border/50 shadow-none hover:border-primary/30 transition-all">
                                        <CardContent className="p-4 flex flex-col gap-4">
                                            <div className="flex items-center gap-4">
                                                {(() => {
                                                    const providerId = String(sp?._id || sp?.id || "");
                                                    const hasPhoto = !!sp?.profilePhoto && !brokenPhotoProviderIds.has(providerId);
                                                    return (
                                                        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                            {hasPhoto ? (
                                                                <img
                                                                    src={sp.profilePhoto}
                                                                    alt={sp.name || "Provider"}
                                                                    className="h-full w-full object-cover"
                                                                    onError={() => {
                                                                        if (!providerId) return;
                                                                        setBrokenPhotoProviderIds(prev => {
                                                                            const next = new Set(prev);
                                                                            next.add(providerId);
                                                                            return next;
                                                                        });
                                                                    }}
                                                                />
                                                            ) : (
                                                                <span className="text-sm font-black text-primary">{sp.name?.charAt(0) || "?"}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm font-bold truncate">{sp.name || "Unknown"}</h3>
                                                        {sp.approvalStatus === "approved" && (
                                                            <Badge variant="outline" className={`text-[8px] font-black px-1.5 py-0 h-4 border ${sp.name?.length > 10 ? 'bg-amber-100 text-amber-700 border-amber-300' : sp.name?.length > 6 ? 'bg-slate-200 text-slate-700 border-slate-400' : 'bg-orange-100/50 text-orange-700 border-orange-300'}`}>
                                                                <Award className="h-2.5 w-2.5 mr-0.5" />
                                                                {sp.name?.length > 10 ? 'Gold' : sp.name?.length > 6 ? 'Silver' : 'Bronze'}
                                                            </Badge>
                                                        )}
                                                        <Badge variant="outline" className={`text-[8px] font-black px-1.5 py-0 h-4 ${statusColors[sp.approvalStatus] || statusColors.pending}`}>
                                                            {sp.approvalStatus || "pending"}
                                                        </Badge>
                                                    </div>
                                                    <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{sp.phone}</span>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 flex-shrink-0" 
                                                    onClick={(e) => { e.stopPropagation(); setSelectedSP(sp); }}
                                                    title="View Details"
                                                >
                                                    <Eye className="h-4 w-4 text-primary" />
                                                </Button>
                                                <div className="flex gap-1.5">
                                                    {(sp.approvalStatus === "pending" || sp.approvalStatus === "pending_vendor") && (
                                                        <Badge variant="outline" className="text-[10px] font-bold bg-amber-50 text-amber-600 border-amber-200 h-7 flex items-center px-2">
                                                            Awaiting Vendor
                                                        </Badge>
                                                    )}
                                                    {sp.approvalStatus === "pending_admin" && (
                                                        <>
                                                            <Button size="sm" className="h-7 text-[10px] font-bold bg-green-600 hover:bg-green-700 rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleAction(sp._id || sp.id, "approved"); }}><CheckCircle className="h-3 w-3 mr-1" />Final Approve</Button>
                                                            <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold border-red-500/30 text-red-400 rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleAction(sp._id || sp.id, "rejected"); }}><XCircle className="h-3 w-3 mr-1" />Reject</Button>
                                                        </>
                                                    )}
                                                    {sp.approvalStatus === "approved" && (
                                                        <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold border-red-500/30 text-red-400 rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleAction(sp._id || sp.id, "blocked"); }}><Ban className="h-3 w-3 mr-1" />Block</Button>
                                                    )}
                                                    {(sp.approvalStatus === "blocked" || sp.approvalStatus === "rejected") && (
                                                        <Button size="sm" className="h-7 text-[10px] font-bold bg-primary rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleAction(sp._id || sp.id, "approved"); }}><UserCheck className="h-3 w-3 mr-1" />Unblock</Button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {(sp.zones || []).map(z => (
                                                        <Badge key={z} variant="secondary" className="text-[9px] font-bold bg-muted/50 text-muted-foreground border-none">
                                                            {z}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                {sp.pendingZones?.length > 0 && (
                                                    <div className="mt-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50 flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">New Zone Request</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {sp.pendingZones.map(z => (
                                                                    <Badge key={z} className="bg-white text-amber-600 border-amber-200 text-[9px] font-bold">
                                                                        + {z}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1 ml-4">
                                                            <Button size="sm" className="h-6 text-[9px] font-black bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleZoneAction(sp._id || sp.id, "approve"); }}>Approve</Button>
                                                            <Button size="sm" variant="ghost" className="h-6 text-[9px] font-black text-amber-700 hover:bg-amber-100 rounded-lg px-2" onClick={(e) => { e.stopPropagation(); handleZoneAction(sp._id || sp.id, "reject"); }}>Reject</Button>
                                                        </div>
                                                    </div>
                                                )}

                                            {/* Advanced Stats (For View) */}
                                            {sp.approvalStatus === "approved" && (() => {
                                                const stats = getSPStats(sp);
                                                return (
                                                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 pt-3 border-t border-border/50">
                                                        <div className="bg-muted/30 p-2 rounded-xl">
                                                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3" /> Rating</p>
                                                            <p className="text-sm font-black mt-0.5 text-amber-500">{getSPRating(sp.name || sp._id || sp.id)}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-2 rounded-xl">
                                                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Bookings</p>
                                                            <p className="text-sm font-black mt-0.5 text-blue-500">{stats.bookings}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-2 rounded-xl">
                                                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><XCircle className="h-3 w-3" /> Cancelled</p>
                                                            <p className="text-sm font-black mt-0.5 text-red-500">{stats.cancelled}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-2 rounded-xl">
                                                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Missed</p>
                                                            <p className="text-sm font-black mt-0.5 text-amber-500">{stats.missed}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-2 rounded-xl">
                                                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Accept. Time</p>
                                                            <p className="text-sm font-black mt-0.5">{stats.acceptTime}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-2 rounded-xl">
                                                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Revenue</p>
                                                            <p className="text-sm font-black mt-0.5 text-green-600">₹{stats.revenue}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </motion.div>
                        
                        {/* Pagination Controls */}
                        {!loading && Math.ceil(total / limit) > 1 && (
                            <div className="mt-8 pb-8">
                                <Pagination>
                                    <PaginationContent>
                                        <PaginationItem>
                                            <PaginationPrevious 
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                            />
                                        </PaginationItem>
                                        
                                        {Array.from({ length: Math.ceil(total / limit) }, (_, i) => i + 1).map(p => {
                                            if (p === 1 || p === Math.ceil(total / limit) || (p >= page - 1 && p <= page + 1)) {
                                                return (
                                                    <PaginationItem key={p}>
                                                        <PaginationLink 
                                                            isActive={page === p}
                                                            onClick={() => setPage(p)}
                                                            className="cursor-pointer"
                                                        >
                                                            {p}
                                                        </PaginationLink>
                                                    </PaginationItem>
                                                );
                                            } else if (p === page - 2 || p === page + 2) {
                                                return <PaginationItem key={p}><PaginationEllipsis /></PaginationItem>;
                                            }
                                            return null;
                                        })}

                                        <PaginationItem>
                                            <PaginationNext 
                                                onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
                                                className={page === Math.ceil(total / limit) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                            />
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                                <p className="text-[10px] text-center text-muted-foreground mt-4 font-bold uppercase tracking-widest">
                                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} providers
                                </p>
                            </div>
                        )}
                    </>
                    )}
                </TabsContent>
                ))}

                <TabsContent value="category-requests" className="mt-0">
                    {categoryRequests.length === 0 ? (
                        <Card className="border-border/50"><CardContent className="py-16 text-center">
                            <RefreshCw className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-sm font-bold text-muted-foreground">No category requests found</p>
                        </CardContent></Card>
                    ) : (
                        <div className="space-y-2">
                            {categoryRequests.map(req => (
                                <Card key={req.id} className="border-border/50 shadow-none hover:border-primary/30 transition-all">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                                <Award className="h-5 w-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-bold">{req.providerName}</h3>
                                                    <Badge className={req.status === 'pending' ? 'bg-amber-100 text-amber-700' : req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                                        {req.status.toUpperCase()}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">Current: <span className="font-bold text-foreground">{req.currentCategory}</span> • Requesting <span className="font-bold text-primary">New Category Access</span></p>
                                                <p className="text-[10px] text-muted-foreground font-medium mt-1">Ref ID: {req.id} • {new Date(req.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {req.status === 'pending' ? (
                                                <>
                                                    <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 font-bold" onClick={() => handleCategoryAction(req.id, 'approved')}>Approve</Button>
                                                    <Button size="sm" variant="outline" className="h-8 border-red-500/30 text-red-400 font-bold" onClick={() => handleCategoryAction(req.id, 'rejected')}>Reject</Button>
                                                </>
                                            ) : (
                                                <Button size="sm" variant="ghost" className="h-8 text-xs font-bold" disabled>Handled</Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="leaves" className="mt-0">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {isLoadingLeaves ? (
                            Array(3).fill(0).map((_, i) => (
                                <Card key={i} className="border-border/50 animate-pulse">
                                    <div className="h-40 bg-muted/20" />
                                </Card>
                            ))
                        ) : leaves.length > 0 ? (
                            leaves.map((leave, idx) => (
                                <motion.div key={leave._id || idx} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}>
                                    <Card className="border-border/50 overflow-hidden hover:border-primary/30 transition-all group">
                                        <CardContent className="p-0">
                                            <div className="p-4 bg-muted/20 border-b border-border/50 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-xs tracking-tighter">
                                                        {String(leave.providerName || "SP").slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black tracking-tight">{leave.providerName}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-[10px] text-muted-foreground font-medium">{leave.type === "half_day" ? "Half Day Leave" : "Full Day Leave"}</p>
                                                            <span className="text-[10px] text-muted-foreground/30">•</span>
                                                            <p className="text-[10px] text-primary/80 font-bold flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {leave.city || "N/A"}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Badge className={cn("text-[10px] font-black px-2 py-0.5", 
                                                    leave.status === "approved" ? "bg-green-500/15 text-green-400" : 
                                                    leave.status === "rejected" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400")}>
                                                    {String(leave.status).toUpperCase()}
                                                </Badge>
                                            </div>
                                            <div className="p-4 space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Start Date</p>
                                                        <p className="text-xs font-bold flex items-center gap-1.5"><CalendarRange className="h-3 w-3 text-primary" /> {new Date(leave.startAt).toLocaleDateString()} {leave.type === "half_day" && new Date(leave.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                    {leave.endDate && (
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">End Date</p>
                                                            <p className="text-xs font-bold flex items-center gap-1.5"><CalendarRange className="h-3 w-3 text-primary" /> {new Date(leave.endDate).toLocaleDateString()}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1 shadow-sm">Reason</p>
                                                    <p className="text-[11px] font-medium leading-relaxed italic text-muted-foreground">{leave.reason || "No reason provided"}</p>
                                                </div>
                                                
                                                {leave.status === "pending" && (
                                                    <div className="flex gap-2 pt-1">
                                                        <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-xs font-black shadow-lg shadow-green-500/20" onClick={() => handleLeaveUpdate(leave._id, "approve")}>Approve</Button>
                                                        <Button size="sm" variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 text-xs font-black" onClick={() => handleLeaveUpdate(leave._id, "reject")}>Reject</Button>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))
                        ) : (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                                <div className="h-16 w-16 rounded-3xl bg-muted/50 flex items-center justify-center mb-4"><Clock className="h-8 w-8 text-muted-foreground/30" /></div>
                                <h3 className="text-lg font-black tracking-tight">No Leave Requests</h3>
                                <p className="text-sm text-muted-foreground max-w-[250px] mt-1">Provider absence requests will appear here for your review.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* SP Detail Modal */}
            <AnimatePresence>
                {selectedSP && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedSP(null)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-40%" }}
                            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                            exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-40%" }}
                            className="fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] sm:w-[500px] z-50 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[85vh] overflow-y-auto"
                        >
                            <div className="p-6 space-y-5">
                                {/* Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {/* Profile Photo */}
                                        <img 
                                            src={selectedSP.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedSP.name || "P")}&background=random&color=fff`}
                                            alt={selectedSP.name}
                                            className="h-16 w-16 rounded-2xl object-cover border-2 border-border shadow-lg"
                                        />
                                        {/* Hidden file input */}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handlePhotoFileSelect}
                                        />
                                        <div>
                                            <h2 className="text-lg font-black">{selectedSP.name || "Unknown"}</h2>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className={`text-[9px] font-black ${statusColors[selectedSP.approvalStatus] || statusColors.pending}`}>
                                                    {selectedSP.approvalStatus || "pending"}
                                                </Badge>
                                                <span className="text-[10px] text-muted-foreground font-medium">ID: {selectedSP._id || selectedSP.id}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Edit Photo Button - Top Right Corner */}
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="h-9 px-3 rounded-xl border-primary/30 hover:bg-primary/10 hover:border-primary transition-all"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingPhoto}
                                    >
                                        {uploadingPhoto ? (
                                            <>
                                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                <span className="text-xs font-bold">Uploading...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Camera className="h-4 w-4 mr-2" />
                                                <span className="text-xs font-bold">Edit Photo</span>
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {/* Contact */}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Phone</p>
                                        <p className="text-sm font-bold mt-1">{selectedSP.phone}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Email</p>
                                        <p className="text-sm font-bold mt-1">{selectedSP.email || "N/A"}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Experience</p>
                                        <p className="text-sm font-bold mt-1">{selectedSP.experience || "N/A"}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Hub Location</p>
                                        <p className="text-sm font-bold mt-1">{selectedSP.city || "N/A"} {selectedSP.zone ? `(${selectedSP.zone})` : ""}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Joined</p>
                                        <p className="text-sm font-bold mt-1">{selectedSP.createdAt ? new Date(selectedSP.createdAt).toLocaleDateString() : "N/A"}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3 col-span-2">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Full Address</p>
                                        <p className="text-sm font-bold mt-1">
                                            {[selectedSP.address, selectedSP.city].filter(Boolean).join(", ") || "N/A"}
                                        </p>
                                    </div>
                                </div>

                                {/* Professional Details */}
                                <div>
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Professional Details</h3>
                                    <div className="space-y-4">
                                        <div className="bg-muted/30 rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Professional Services</p>
                                                {!isEditingCategories ? (
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full hover:bg-primary/10" onClick={startEditing}>
                                                        <Edit2 className="h-3 w-3 text-primary" />
                                                    </Button>
                                                ) : (
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full hover:bg-green-100" onClick={handleSaveProfile} disabled={isSaving}>
                                                            <Save className="h-3 w-3 text-green-600" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full hover:bg-red-100" onClick={() => setIsEditingCategories(false)} disabled={isSaving}>
                                                            <X className="h-3 w-3 text-red-600" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {isContentLoading && availableParents.length === 0 ? (
                                                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                                                    <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                                                    <p className="text-[10px] font-black text-muted-foreground animate-pulse uppercase tracking-widest">Fetching Categories & Services...</p>
                                                </div>
                                            ) : isEditingCategories ? (
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-[10px] font-black text-muted-foreground mb-2 uppercase tracking-tight">Step 1: Select Service Types (Parents)</p>
                                                        <div className="flex flex-wrap gap-1.5 p-3 bg-muted/20 rounded-xl border border-border/50">
                                                            {availableParents.map(parent => {
                                                                const isSelected = tempCategories.includes(parent.label);
                                                                const isOriginal = Array.isArray(selectedSP.documents?.primaryCategory) 
                                                                    ? selectedSP.documents.primaryCategory.includes(parent.label)
                                                                    : selectedSP.documents?.primaryCategory === parent.label;

                                                                return (
                                                                    <Badge 
                                                                        key={parent._id || parent.id} 
                                                                        variant={isSelected ? "default" : "outline"}
                                                                        className={`text-[10px] cursor-pointer transition-all py-1 px-2.5 ${isSelected ? (isOriginal ? 'bg-red-600 border-red-600 text-white shadow-sm ring-2 ring-red-100' : 'bg-primary border-primary shadow-sm ring-2 ring-primary/20') : 'hover:border-primary/50 text-muted-foreground'}`}
                                                                        onClick={() => {
                                                                            const pid = parent.id || parent._id;
                                                                            if (isSelected) {
                                                                                setTempCategories(prev => prev.filter(c => c !== parent.label));
                                                                                // Auto-remove specializations and services belonging to this parent
                                                                                const pLabel = parent.label.toLowerCase().split(' ')[0];
                                                                                const childCats = availableCategories.filter(c => 
                                                                                    c.serviceType === pid || 
                                                                                    c.serviceType === String(parent._id) || 
                                                                                    (c.serviceType && String(c.serviceType).toLowerCase() === pLabel)
                                                                                );
                                                                                const childCatNames = childCats.map(c => c.name);
                                                                                const childCatIds = childCats.map(c => c.id || c._id);
                                                                                const childCatNamesLower = childCats.map(c => c.name.toLowerCase());
                                                                                
                                                                                setTempSpecializations(prev => prev.filter(s => !childCatNames.includes(s)));
                                                                                setTempServices(prev => {
                                                                                    return prev.filter(svcName => {
                                                                                        const svcObj = availableServices.find(as => as.name === svcName);
                                                                                        if (!svcObj) return true;
                                                                                        return !childCatIds.includes(svcObj.category) && 
                                                                                               !childCatNamesLower.includes(String(svcObj.category).toLowerCase());
                                                                                    });
                                                                                });
                                                                            }
                                                                            else setTempCategories(prev => [...prev, parent.label]);
                                                                        }}
                                                                    >
                                                                        {parent.label}
                                                                    </Badge>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <p className="text-[10px] font-black text-muted-foreground mb-2 uppercase tracking-tight">Step 2: Select Specializations (Filtered)</p>
                                                        <div className="space-y-3">
                                                            {tempCategories.length === 0 ? (
                                                                <div className="p-4 text-center border border-dashed border-border rounded-xl">
                                                                    <p className="text-[10px] text-muted-foreground font-bold italic">Please select at least one Service Type above to see options</p>
                                                                </div>
                                                            ) : (
                                                                availableParents
                                                                    .filter(p => tempCategories.includes(p.label))
                                                                    .map(parent => {
                                                                        const pid = parent.id || parent._id;
                                                                        const pLabel = parent.label.toLowerCase().split(' ')[0];
                                                                        const children = availableCategories.filter(c => 
                                                                            c.serviceType === pid || 
                                                                            c.serviceType === String(parent._id) || 
                                                                            (c.serviceType && String(c.serviceType).toLowerCase() === pLabel)
                                                                        );
                                                                        if (children.length === 0) return null;

                                                                        return (
                                                                            <div key={pid} className="space-y-1.5">
                                                                                <p className="text-[9px] font-black text-primary uppercase tracking-widest px-1 flex items-center gap-1.5 opacity-70">
                                                                                    <span className="h-1 w-1 rounded-full bg-primary" /> {parent.label} Categories
                                                                                </p>
                                                                                <div className="flex flex-wrap gap-1.5 p-2 bg-background border border-border/50 rounded-xl">
                                                                                    {children.map(cat => {
                                                                                        const isSelected = tempSpecializations.includes(cat.name);
                                                                                        const isOriginal = (selectedSP.documents?.specializations || []).includes(cat.name);
                                                                                        return (
                                                                                            <Badge 
                                                                                                key={cat._id || cat.id} 
                                                                                                variant={isSelected ? "secondary" : "outline"}
                                                                                                className={`text-[10px] cursor-pointer transition-all ${isSelected ? (isOriginal ? 'bg-red-600 border-red-600 text-white font-bold' : 'bg-primary/15 text-primary border-primary/30 font-bold') : 'text-muted-foreground hover:border-primary/30'}`}
                                                                                                onClick={() => {
                                                                                                    if (isSelected) {
                                                                                                        setTempSpecializations(prev => prev.filter(s => s !== cat.name));
                                                                                                        // Auto-remove services belonging to this specialization
                                                                                                        const catId = cat.id || cat._id;
                                                                                                        setTempServices(prev => {
                                                                                                            return prev.filter(svcName => {
                                                                                                                const svcObj = availableServices.find(as => as.name === svcName);
                                                                                                                return !svcObj || (svcObj.category !== catId && String(svcObj.category).toLowerCase() !== cat.name.toLowerCase());
                                                                                                            });
                                                                                                        });
                                                                                                    }
                                                                                                    else setTempSpecializations(prev => [...prev, cat.name]);
                                                                                                }}
                                                                                            >
                                                                                                {cat.name}
                                                                                            </Badge>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <p className="text-[10px] font-black text-muted-foreground mb-2 uppercase tracking-tight">Step 3: Select Individual Services (Deep Cleanup)</p>
                                                        <div className="space-y-3">
                                                            {tempSpecializations.length === 0 ? (
                                                                <div className="p-4 text-center border border-dashed border-border rounded-xl">
                                                                    <p className="text-[10px] text-muted-foreground font-bold italic">Select Sub Categories to enable Service removal/addition</p>
                                                                </div>
                                                            ) : (
                                                                availableCategories
                                                                    .filter(c => tempSpecializations.includes(c.name))
                                                                    .map(cat => {
                                                                        const cid = cat.id || cat._id;
                                                                        const cName = cat.name.toLowerCase();
                                                                        const services = availableServices.filter(s => 
                                                                            s.category === cid || 
                                                                            s.category === String(cat._id) || 
                                                                            (s.category && String(s.category).toLowerCase() === cName)
                                                                        );
                                                                        if (services.length === 0) return null;

                                                                        return (
                                                                            <div key={cid} className="space-y-1.5">
                                                                                <p className="text-[9px] font-black text-green-600 uppercase tracking-widest px-1 flex items-center gap-1.5 opacity-70">
                                                                                    <span className="h-1 w-1 rounded-full bg-green-600" /> {cat.name} Services
                                                                                </p>
                                                                                <div className="flex flex-wrap gap-1.5 p-2 bg-green-50/20 border border-green-100 rounded-xl">
                                                                                    {services.map(svc => {
                                                                                        const isSelected = tempServices.includes(svc.name);
                                                                                        const isOriginal = (selectedSP.documents?.services || []).includes(svc.name);
                                                                                        return (
                                                                                            <Badge 
                                                                                                key={svc._id || svc.id} 
                                                                                                variant={isSelected ? "default" : "outline"}
                                                                                                className={`text-[10px] cursor-pointer transition-all ${isSelected ? (isOriginal ? 'bg-red-600 border-red-600 text-white shadow-sm' : 'bg-green-600 border-green-600 shadow-sm text-white') : 'text-muted-foreground hover:border-green-300'}`}
                                                                                                onClick={() => {
                                                                                                    if (isSelected) setTempServices(prev => prev.filter(s => s !== svc.name));
                                                                                                    else setTempServices(prev => [...prev, svc.name]);
                                                                                                }}
                                                                                            >
                                                                                                {svc.name}
                                                                                            </Badge>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Primary Category</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {selectedSP.documents?.primaryCategory?.length > 0 ? (
                                                                selectedSP.documents.primaryCategory.map(cat => (
                                                                    <Badge key={cat} variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary border-none">
                                                                        {cat}
                                                                    </Badge>
                                                                ))
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic">No primary categories</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Sub Category</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {selectedSP.documents?.specializations?.length > 0 ? (
                                                                selectedSP.documents.specializations.map(spec => (
                                                                    <Badge key={spec} variant="outline" className="text-[10px] font-bold border-primary/30 text-primary/70">
                                                                        {spec}
                                                                    </Badge>
                                                                ))
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic">No sub categories</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Services</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {selectedSP.documents?.services?.length > 0 ? (
                                                                selectedSP.documents.services.map(svc => (
                                                                    <Badge key={svc} variant="outline" className="text-[10px] font-bold bg-green-50 text-green-700 border-green-200">
                                                                        {svc}
                                                                    </Badge>
                                                                ))
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic">No services</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        
                                        {selectedSP.documents?.certifications?.length > 0 && (
                                            <div className="bg-muted/30 rounded-xl p-3">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Professional Certificates</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {selectedSP.documents.certifications.map((cert, idx) => (
                                                        <div key={idx} className="aspect-square rounded-lg bg-muted overflow-hidden border border-border/50 relative group">
                                                            <img src={cert} alt={`Cert ${idx}`} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Button size="sm" variant="secondary" className="h-7 text-[10px] font-bold" onClick={() => window.open(cert, '_blank')}>View Large</Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                 {/* Wallet Section */}
                                 <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                                     <div className="flex items-center justify-between mb-3">
                                         <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                             <Wallet className="h-3.5 w-3.5 text-primary" /> Wallet Balance
                                         </h3>
                                         <p className="text-xl font-black text-primary">₹{selectedSP.credits || 0}</p>
                                     </div>

                                     {!isWalletAdjusting ? (
                                         <Button 
                                             onClick={() => setIsWalletAdjusting(true)} 
                                             variant="outline" 
                                             className="w-full h-9 rounded-xl font-bold text-xs gap-2 border-primary/20 hover:bg-primary/5"
                                         >
                                             <Plus className="h-3.5 w-3.5" /> Adjust Balance
                                         </Button>
                                     ) : (
                                         <div className="space-y-3 mt-4 pt-4 border-t border-border/50 animate-in fade-in slide-in-from-top-2">
                                             <div className="flex gap-2 p-1 bg-muted rounded-lg">
                                                 <Button 
                                                     size="sm" 
                                                     className={cn("flex-1 h-8 rounded-md font-bold text-[10px]", walletType === "add" ? "bg-green-600 text-white" : "bg-transparent text-muted-foreground hover:bg-muted-foreground/10")}
                                                     onClick={() => setWalletType("add")}
                                                 >
                                                     Add Money
                                                 </Button>
                                                 <Button 
                                                     size="sm" 
                                                     className={cn("flex-1 h-8 rounded-md font-bold text-[10px]", walletType === "deduct" ? "bg-red-600 text-white" : "bg-transparent text-muted-foreground hover:bg-muted-foreground/10")}
                                                     onClick={() => setWalletType("deduct")}
                                                 >
                                                     Deduct Money
                                                 </Button>
                                             </div>
                                             
                                             <div className="grid grid-cols-3 gap-2">
                                                 <div className="col-span-1">
                                                     <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1 ml-1">Amount</p>
                                                     <Input 
                                                         type="number" 
                                                         placeholder="0" 
                                                         value={walletAmount}
                                                         onChange={e => setWalletAmount(e.target.value)}
                                                         className="h-9 rounded-xl text-xs font-bold"
                                                     />
                                                 </div>
                                                 <div className="col-span-2">
                                                     <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1 ml-1">Reason (Optional)</p>
                                                     <Input 
                                                         placeholder="Why this adjustment?" 
                                                         value={walletReason}
                                                         onChange={e => setWalletReason(e.target.value)}
                                                         className="h-9 rounded-xl text-xs"
                                                     />
                                                 </div>
                                             </div>

                                             <div className="flex gap-2">
                                                 <Button 
                                                     onClick={handleWalletAdjust} 
                                                     disabled={isSaving}
                                                     className={cn("flex-1 h-9 rounded-xl font-black text-xs", walletType === "add" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white")}
                                                 >
                                                     {isSaving ? "Saving..." : `Confirm ${walletType === "add" ? "Credit" : "Debit"}`}
                                                 </Button>
                                                 <Button 
                                                     onClick={() => {
                                                         setIsWalletAdjusting(false);
                                                         setWalletAmount("");
                                                         setWalletReason("");
                                                     }} 
                                                     variant="ghost" 
                                                     disabled={isSaving}
                                                     className="h-9 px-3 rounded-xl font-bold text-xs"
                                                 >
                                                     Cancel
                                                 </Button>
                                             </div>
                                         </div>
                                     )}
                                 </div>

                                 {/* Documents */}
                                <div>
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Documents Verification</h3>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        {[
                                            { label: "Aadhar Front", key: "aadharFront" },
                                            { label: "Aadhar Back", key: "aadharBack" },
                                            { label: "PAN Card", key: "panCard" },
                                            { label: "Profile Photo", key: "profilePhoto", isProfile: true },
                                        ].map(doc => (
                                            <div key={doc.key} className="space-y-1">
                                                <p className="text-[10px] font-bold text-muted-foreground">{doc.label}</p>
                                                <div className="aspect-video rounded-lg bg-muted overflow-hidden border border-border/50 relative group">
                                                    {doc.isProfile ? (
                                                        selectedSP.profilePhoto ? (
                                                            <img src={selectedSP.profilePhoto} alt={doc.label} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30"><Users className="h-6 w-6" /></div>
                                                        )
                                                    ) : (
                                                        selectedSP.documents?.[doc.key] ? (
                                                            <img src={selectedSP.documents[doc.key]} alt={doc.label} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30"><FileText className="h-6 w-6" /></div>
                                                        )
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Button size="sm" variant="secondary" className="h-7 text-[10px] font-bold" onClick={() => window.open(doc.isProfile ? selectedSP.profilePhoto : selectedSP.documents?.[doc.key], '_blank')}>View Large</Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        {[
                                            { label: "Bank Name", key: "bankName" },
                                            { label: "Account No", key: "accountNumber" },
                                            { label: "IFSC Code", key: "ifscCode" },
                                            { label: "UPI ID", key: "upiId" },
                                        ].map(doc => (
                                            <div key={doc.key} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                                <span className="text-[12px] font-semibold flex items-center gap-2">
                                                    <Shield className="h-3.5 w-3.5 text-muted-foreground" /> {doc.label}
                                                </span>
                                                <span className="text-[12px] font-bold">
                                                    {selectedSP.documents?.[doc.key] || "N/A"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Performance Analytics Section */}
                                <div className="space-y-3 py-4 border-t border-border/50">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                            <Award className="h-3 w-3" /> Performance Analytics
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {isEditingGrade ? (
                                                <div className="flex items-center gap-1">
                                                    <select 
                                                        value={tempGrade} 
                                                        onChange={(e) => setTempGrade(e.target.value)}
                                                        className="text-[10px] font-black h-7 bg-muted/50 border border-border/50 rounded-lg px-2 outline-none focus:border-primary/50"
                                                    >
                                                        <option value="A">Grade A</option>
                                                        <option value="B">Grade B</option>
                                                        <option value="C">Grade C</option>
                                                        <option value="D">Grade D</option>
                                                        <option value="Standard">Standard</option>
                                                    </select>
                                                    <Button size="sm" className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700" onClick={handleUpdateGrade}>
                                                        <Save className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setIsEditingGrade(false)}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-primary/10 text-primary font-black text-[10px]" onClick={() => setIsEditingGrade(true)}>
                                                    <Edit2 className="h-3 w-3 mr-1" /> SET GRADE
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {isLoadingSummary ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
                                            ))}
                                        </div>
                                    ) : spSummary ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-3 border border-primary/10">
                                                <p className="text-[9px] font-black text-primary/60 uppercase tracking-widest">Performance Grade</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Award className={cn("h-4 w-4", 
                                                        spSummary.performance?.grade === "A" ? "text-amber-400" : 
                                                        spSummary.performance?.grade === "B" ? "text-slate-400" : 
                                                        spSummary.performance?.grade === "C" ? "text-amber-700" : "text-slate-500")} />
                                                    <p className="text-sm font-black">{spSummary.performance?.grade || "Standard"}</p>
                                                </div>
                                            </div>
                                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Weekly Hours</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Clock className="h-4 w-4 text-primary/60" />
                                                    <p className="text-sm font-black">{spSummary.calendar?.availableHoursWeek || 0} hrs <span className="text-[10px] text-muted-foreground font-medium">(last 7d)</span></p>
                                                </div>
                                            </div>
                                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Response Rate</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <CheckCircle className="h-4 w-4 text-green-500/60" />
                                                    <p className="text-sm font-black text-green-600">{spSummary.performance?.responseRate || 0}%</p>
                                                </div>
                                            </div>
                                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Cancellations</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <XCircle className="h-4 w-4 text-red-500/60" />
                                                    <p className="text-sm font-black text-red-600">{spSummary.performance?.cancellations || 0}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-xl bg-muted/20 border border-dashed border-border flex flex-col items-center justify-center text-center">
                                            <AlertCircle className="h-5 w-5 text-muted-foreground/40 mb-2" />
                                            <p className="text-[10px] font-bold text-muted-foreground">Unable to load metrics</p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}

                                <div className="flex gap-2 pt-2">
                                    {selectedSP.approvalStatus === "pending_admin" && (
                                        <>
                                            <Button className="flex-1 h-11 bg-green-600 hover:bg-green-700 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedSP._id || selectedSP.id, "approved")}>
                                                <CheckCircle className="h-4 w-4" /> Final Approve
                                            </Button>
                                            <Button variant="outline" className="flex-1 h-11 border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedSP._id || selectedSP.id, "rejected")}>
                                                <XCircle className="h-4 w-4" /> Reject
                                            </Button>
                                        </>
                                    )}
                                    {selectedSP.approvalStatus === "approved" && (
                                        <Button variant="outline" className="flex-1 h-11 border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedSP._id || selectedSP.id, "blocked")}>
                                            <Ban className="h-4 w-4" /> Block SP
                                        </Button>
                                    )}
                                    {(selectedSP.approvalStatus === "blocked" || selectedSP.approvalStatus === "rejected") && (
                                        <Button className="flex-1 h-11 bg-primary hover:bg-primary/90 rounded-xl font-bold gap-2" onClick={() => handleAction(selectedSP._id || selectedSP.id, "approved")}>
                                            <UserCheck className="h-4 w-4" /> Unblock & Approve
                                        </Button>
                                    )}
                                    <Button variant="outline" className="h-11 rounded-xl font-bold" onClick={() => setSelectedSP(null)}>Close</Button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <PerformanceCriteriaModal isOpen={isPerformanceModalOpen} onClose={() => setIsPerformanceModalOpen(false)} />
        </div>
    );
}

const PerformanceCriteriaModal = ({ isOpen, onClose }) => {
    const { getPerformanceCriteria, updatePerformanceCriteria } = useAdminAuth();
    const [settings, setSettings] = useState({ minWeeklyHours: 20, minRatingThreshold: 4.5, maxCancellationsThreshold: 5 });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            getPerformanceCriteria()
                .then(data => setSettings(data))
                .catch(() => toast.error("Failed to load criteria"))
                .finally(() => setLoading(false));
        }
    }, [isOpen, getPerformanceCriteria]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await updatePerformanceCriteria(settings);
            toast.success("Performance criteria updated");
            onClose();
        } catch {
            toast.error("Failed to save criteria");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card rounded-2xl shadow-2xl border border-border w-[400px]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-border">
                    <h2 className="text-lg font-black flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Performance Criteria</h2>
                    <p className="text-sm text-muted-foreground mt-1">Set thresholds for provider performance.</p>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-sm font-bold">Minimum Weekly Hours</label>
                        <Input type="number" value={settings.minWeeklyHours} onChange={(e) => setSettings({ ...settings, minWeeklyHours: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                        <label className="text-sm font-bold">Minimum Rating Threshold</label>
                        <Input type="number" step="0.1" value={settings.minRatingThreshold} onChange={(e) => setSettings({ ...settings, minRatingThreshold: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                        <label className="text-sm font-bold">Maximum Cancellations Threshold</label>
                        <Input type="number" value={settings.maxCancellationsThreshold} onChange={(e) => setSettings({ ...settings, maxCancellationsThreshold: e.target.value })} className="mt-1" />
                    </div>
                </div>
                <div className="p-4 bg-muted/50 border-t border-border flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} className="bg-primary">Save Changes</Button>
                </div>
            </motion.div>
        </motion.div>
    );
};
