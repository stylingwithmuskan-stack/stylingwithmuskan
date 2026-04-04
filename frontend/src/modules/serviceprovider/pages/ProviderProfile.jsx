import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProviderAuth } from "../contexts/ProviderAuthContext";
import {
    Calendar,
    Map,
    Wallet,
    Shield,
    GraduationCap,
    UserPlus,
    ShoppingBag,
    ChevronRight,
    Star,
    LogOut,
    LifeBuoy,
    AlertTriangle,
    RefreshCw,
    MessageSquare,
    Trophy,
    User,
    Mail,
    Phone,
    MapPin,
    Crown,
    Briefcase,
    Bell,
    Plus,
    Check,
    X,
    Loader2,
    Trash2,
    History,
    Info,
    FileText,
    ShieldCheck
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/modules/user/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/modules/user/components/ui/dialog";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";

import NotificationDropdown from "@/modules/user/components/salon/NotificationDropdown";
import { useNotifications } from "@/modules/user/contexts/NotificationContext";
import { api } from "@/modules/user/lib/api";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

const menuItems = [
    { icon: Trophy, label: "Weekly performance", path: "/provider/performance" },
    { icon: Bell, label: "Notifications", path: "/provider/notifications", isNotificationTab: true },
    { icon: History, label: "Activity", path: "/provider/activity" },
    { icon: Crown, label: "SWM Pro Partner", path: "/provider/subscription", color: "text-amber-500 font-bold" },
    { icon: Calendar, label: "Calendar", path: "/provider/availability" },
    { icon: Map, label: "My Hub", path: "/provider/hub" },
    { icon: Wallet, label: "Credits", path: "/provider/credits" },
    { icon: Shield, label: "Insurance", path: "/provider/admin" },
    { icon: GraduationCap, label: "Training", path: "/provider/training" },
    { icon: UserPlus, label: "Invite a friend with stylingwithmuskan", path: "/provider/profile" },
    { icon: ShoppingBag, label: "stylingwithmuskan shop", path: "/provider/shop" },
    { icon: LifeBuoy, label: "stylingwithmuskan support", path: "/provider/support" },
    { icon: Info, label: "About Us", path: "/provider/about-us" },
    { icon: Phone, label: "Contact Us", path: "/provider/contact-us" },
    { icon: ShieldCheck, label: "Privacy Policy", path: "/provider/privacy-policy" },
    { icon: FileText, label: "Terms & Conditions", path: "/provider/terms-conditions" },
    { icon: AlertTriangle, label: "SOS", path: "/provider/sos", color: "text-red-500 font-bold" },
    { icon: RefreshCw, label: "Check for updates", path: "#", version: "v2.1.0" },
];

export default function ProviderProfile() {
    const { provider, logout, requestZones, setProvider } = useProviderAuth();
    const { unreadCount } = useNotifications();
    const navigate = useNavigate();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
    const [availableZones, setAvailableZones] = useState([]);
    const [selectedZones, setSelectedZones] = useState([]);
    const [customZone, setCustomZone] = useState("");
    const [loadingZones, setLoadingZones] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        let cancelled = false;
        if (provider?.phone) {
            api.provider.summary(provider.phone).then((s) => {
                if (!cancelled) setSummary(s);
            }).catch(() => {});
        }
        return () => { cancelled = true; };
    }, [provider?.phone]);

    useEffect(() => {
        if (isZoneModalOpen && provider?.city) {
            setLoadingZones(true);
            api.content.zones({ cityName: provider.city })
                .then(res => {
                    const currentZones = provider.zones || [];
                    const filtered = (res.zones || []).filter(z => !currentZones.includes(z.name));
                    setAvailableZones(filtered);
                })
                .catch(() => toast.error("Failed to load zones"))
                .finally(() => setLoadingZones(false));
        }
    }, [isZoneModalOpen, provider?.city, provider?.zones]);

    const [categoryRequested, setCategoryRequested] = useState(false);

    // Provide default fallbacks if provider context is missing somehow
    const safeProvider = provider || {};
    const name = (summary?.provider?.name || safeProvider.name || "").trim() || "Provider";
    const profileImage = summary?.provider?.profilePhoto || safeProvider.profilePhoto || "";

    const providerDetails = {
        email: safeProvider.email || "",
        phone: safeProvider.phone || "",
        city: summary?.provider?.city || "",
        category: safeProvider.documents?.primaryCategory?.[0] || "",
        joiningDate: safeProvider.createdAt ? new Date(safeProvider.createdAt).toLocaleDateString() : "",
        experience: safeProvider.experience || ""
    };

    const handleLogout = () => {
        logout();
        navigate("/provider/login");
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
            const response = await fetch(`${apiBaseUrl}/provider/me/account`, {
                method: 'DELETE',
                credentials: 'include',
            });
            
            if (!response.ok) {
                const data = await response.json().catch(() => ({ error: 'Failed to delete account' }));
                toast.error(data.error || 'Failed to delete account');
                setIsDeleting(false);
                setShowDeleteConfirm(false);
                return;
            }
            
            toast.success('Account deleted successfully');
            logout();
            navigate('/provider/login');
        } catch (error) {
            console.error('Error deleting account:', error);
            toast.error('Failed to delete account. Please try again.');
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
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
                toast.success("Zone request sent to admin and city vendor!");
                setIsZoneModalOpen(false);
                setSelectedZones([]);
                setCustomZone("");
                if (res.provider) setProvider(res.provider);
            }
        } catch (err) {
            toast.error(err.message || "Failed to send request");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCategoryRequest = () => {
        if (!provider) return;
        const requests = JSON.parse(localStorage.getItem("muskan-category-requests") || "[]");
        const newRequest = {
            id: `REQ${Date.now()}`,
            providerId: provider.id,
            providerName: provider.name,
            providerPhone: provider.phone,
            currentCategory: providerDetails.category,
            status: "pending",
            createdAt: new Date().toISOString()
        };
        requests.unshift(newRequest);
        localStorage.setItem("muskan-category-requests", JSON.stringify(requests));
        setCategoryRequested(true);
    };

    return (
        <div className="flex flex-1 w-full flex-col bg-white -m-4 md:m-0 min-h-screen">
            {/* Top Header Section */}
            <div className="p-6 pt-10 flex justify-between items-start border-b border-gray-100">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{name}</h1>
                        <div className="flex items-center gap-1 text-sm font-bold text-gray-600">
                            <Star className="h-4 w-4 fill-gray-600" />
                            <span>{(summary?.provider?.rating ?? safeProvider.rating ?? 0).toFixed ? (summary?.provider?.rating ?? safeProvider.rating ?? 0).toFixed(2) : summary?.provider?.rating ?? safeProvider.rating ?? 0}</span>
                        </div>
                    </div>

                    <div className="flex gap-6 pt-2">
                        {/* Profile Details Dialog */}
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <button className="text-sm font-bold border-b-2 border-black pb-0.5">Profile Details</button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden rounded-2xl border-none">
                                <DialogHeader className="p-6 bg-slate-900 text-white">
                                    <DialogTitle className="text-xl font-bold">Registration Details</DialogTitle>
                                </DialogHeader>
                                <div className="p-6 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                                <User className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Full Name</p>
                                                <p className="text-[17px] font-semibold text-slate-900">{name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                                <Mail className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Email Address</p>
                                                <p className="text-[17px] font-semibold text-slate-900">{providerDetails.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                                <Phone className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Phone Number</p>
                                                <p className="text-[17px] font-semibold text-slate-900">{providerDetails.phone}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                                <MapPin className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">City</p>
                                                <p className="text-[17px] font-semibold text-slate-900">{providerDetails.city}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                                <Briefcase className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Category</p>
                                                    <p className="text-[17px] font-semibold text-slate-900">{providerDetails.category}</p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className={`h-7 px-2 text-[10px] uppercase font-black tracking-widest ${categoryRequested ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50'}`}
                                                    onClick={handleCategoryRequest}
                                                    disabled={categoryRequested}
                                                >
                                                    {categoryRequested ? "Requested" : "+ Request New"}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Joined On</p>
                                                <p className="text-sm font-bold text-slate-700">{providerDetails.joiningDate}</p>
                                            </div>
                                            <div className="h-px w-8 bg-slate-200" />
                                            <div className="text-right">
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Experience</p>
                                                <p className="text-sm font-bold text-slate-700">{providerDetails.experience}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 flex justify-center">
                                    <Button onClick={() => setIsDialogOpen(false)} className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 font-bold">
                                        Close Details
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="relative group">
                    <Avatar className="h-28 w-24 rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden relative">
                        <AvatarImage
                            src={profileImage || "https://via.placeholder.com/200x240"}
                            className="object-cover"
                            onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/200x240"; }}
                        />
                        <AvatarFallback className="rounded-2xl">{name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                </div>
            </div>

            {/* Hub Zones Management */}
            <div className="px-6 py-6 border-b border-gray-100 bg-violet-50/30">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-violet-600" />
                        <h2 className="text-lg font-black text-gray-900 tracking-tight">Managed Hubs</h2>
                    </div>
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 text-[11px] font-black uppercase tracking-widest text-violet-600 hover:bg-violet-100 rounded-lg"
                        onClick={() => setIsZoneModalOpen(true)}
                    >
                        + Request New
                    </Button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    {(provider?.zones || []).map(z => (
                        <Badge key={z} className="bg-white border-violet-100 text-violet-700 text-xs font-bold py-1.5 px-3 rounded-xl flex items-center gap-2 shadow-sm">
                            <Check className="h-3 w-3 text-green-500" /> {z}
                        </Badge>
                    ))}
                    {(provider?.zones || []).length === 0 && (
                        <p className="text-xs text-gray-400 font-bold italic">No hubs assigned yet</p>
                    )}
                </div>

                {provider?.pendingZones?.length > 0 && (
                    <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Awaiting Approval</p>
                        </div>
                        <p className="text-[11px] font-bold text-amber-800 mb-3 bg-white/50 p-2 rounded-lg">
                            Please wait for admin or city vendor to approve your new hub requests. Bookings from these areas will start appearing once approved.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {provider.pendingZones.map(z => (
                                <Badge key={z} variant="outline" className="bg-white/50 border-amber-200 text-amber-700 text-[11px] font-bold py-1 px-2.5 rounded-lg italic">
                                    {z}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Menu Options List */}
            <div className="flex-1 bg-white">
                {menuItems.map((item, index) => {
                    const Icon = item.icon;
                    if (item.isNotificationTab) {
                        return (
                            <Link
                                key={index}
                                to={item.path}
                                className="w-full flex items-center justify-between p-5 border-b border-gray-50 active:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <Icon className="h-6 w-6 text-gray-700 stroke-[1.5px]" />
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-primary text-[8px] font-bold text-white flex items-center justify-center rounded-full border border-white">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <span className="text-[17px] font-semibold tracking-tight text-gray-800">{item.label}</span>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-gray-400" />
                            </Link>
                        );
                    }
                    return (
                        <Link
                            key={index}
                            to={item.path}
                            className="flex items-center justify-between p-5 border-b border-gray-50 active:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <Icon className={`h-6 w-6 ${item.color?.includes('text-red') ? 'text-red-500' : 'text-gray-700'} stroke-[1.5px]`} />
                                <div className="flex flex-col">
                                    <span className={`text-[17px] font-semibold tracking-tight ${item.color || "text-gray-800"}`}>{item.label}</span>
                                    {item.version && <span className="text-[11px] font-bold text-gray-400 -mt-1">{item.version}</span>}
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                        </Link>
                    );
                })}

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-between p-5 border-b border-gray-50 active:bg-red-50 transition-colors group"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-red-50 p-2 rounded-lg group-active:bg-red-100 transition-colors">
                            <LogOut className="h-5 w-5 text-red-600 stroke-[2px]" />
                        </div>
                        <span className="text-[17px] font-bold text-red-600 tracking-tight">Logout</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-red-400" />
                </button>

                {/* Delete Account Button */}
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-between p-5 border-b border-gray-50 active:bg-red-50 transition-colors group"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-red-50 p-2 rounded-lg group-active:bg-red-100 transition-colors">
                            <Trash2 className="h-5 w-5 text-red-600 stroke-[2px]" />
                        </div>
                        <span className="text-[17px] font-bold text-red-600 tracking-tight">Delete Account</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-red-400" />
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                    <Trash2 className="w-6 h-6 text-red-600" />
                                </div>
                                <h3 className="text-lg font-bold">Delete Account?</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                This action cannot be undone. All your provider data including bookings history, zones, availability, and account information will be permanently deleted.
                            </p>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={isDeleting}
                                    className="flex-1 h-12 rounded-xl font-bold"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleDeleteAccount}
                                    disabled={isDeleting}
                                    className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Hub Request Modal */}
            <AnimatePresence>
                {isZoneModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl relative max-h-[85vh] overflow-y-auto">
                            <button onClick={() => setIsZoneModalOpen(false)} className="absolute right-6 top-6 p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                            
                            <div className="mb-8">
                                <div className="h-14 w-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-5 shadow-inner">
                                    <MapPin className="h-7 w-7 text-violet-600" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Add Service Hubs</h3>
                                <p className="text-sm text-gray-500 mt-2 font-medium leading-relaxed">Expand your presence by selecting more areas in {provider?.city}.</p>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Select New Areas</Label>
                                    {loadingZones ? (
                                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                                            <Loader2 className="h-8 w-8 text-violet-600 animate-spin" />
                                            <span className="text-xs font-bold text-gray-400">Loading city hubs...</span>
                                        </div>
                                    ) : availableZones.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-2.5">
                                            {availableZones.map(z => (
                                                <div key={z._id} onClick={() => toggleZone(z.name)} 
                                                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedZones.includes(z.name) ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-100' : 'bg-white border-gray-100 text-gray-600 hover:border-violet-200'}`}>
                                                    <div className={`h-5 w-5 rounded-lg flex items-center justify-center ${selectedZones.includes(z.name) ? 'bg-white text-violet-600' : 'bg-gray-100'}`}>
                                                        {selectedZones.includes(z.name) && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                                                    </div>
                                                    <span className="text-sm font-black truncate tracking-tight">{z.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 rounded-2xl p-8 text-center border border-dashed border-gray-200">
                                            <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-xs text-gray-400 font-bold italic">No new hubs available in your city yet.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t border-gray-100">
                                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Other Hub (Manual Entry)</Label>
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                                        <Input 
                                            placeholder="Enter hub name" 
                                            value={customZone} 
                                            onChange={e => setCustomZone(e.target.value)} 
                                            className="pl-11 h-14 rounded-2xl border-gray-100 focus:border-violet-500 font-bold text-sm bg-gray-50/50 shadow-inner" 
                                        />
                                    </div>
                                </div>

                                <Button 
                                    onClick={handleRequestZones} 
                                    disabled={submitting || (selectedZones.length === 0 && !customZone)}
                                    className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black text-base shadow-xl shadow-violet-100 gap-2 transition-all active:scale-[0.98] mt-2"
                                >
                                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5 stroke-[3px]" />}
                                    {submitting ? "Sending Request..." : "Request Access"}
                                </Button>
                                
                                <p className="text-[10px] text-center text-gray-400 font-bold leading-relaxed px-4">
                                    * Your request will be reviewed by SWM Admin and the city vendor for approval.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Footer Branding Area */}
            <div className="p-8 pb-12 flex justify-center opacity-20 grayscale pointer-events-none">
                <img src="/logo1.png" alt="Styling with Muskan" className="h-16 w-16 rounded-full object-cover shadow-lg border-2 border-primary/20" onError={(e) => e.target.style.display = 'none'} />
            </div>
        </div>
    );
}
