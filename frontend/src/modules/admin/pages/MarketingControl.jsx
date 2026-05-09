import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    Image,
    Plus,
    Trash2,
    Calendar,
    Link as LinkIcon,
    ArrowUpDown,
    Save,
    BellRing,
    Send,
    Package,
    Upload,
    X,
    Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { Textarea } from "@/modules/user/components/ui/textarea";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function MarketingControl() {
    const {
        getBanners,
        addBanner,
        updateBanner,
        deleteBanner,
        pushBroadcast,
        getPushBroadcastHistory,
        sendPushTest,
        getSubscriptionPlans,
        getSystemSettings,
    } = useAdminAuth();

    const { services, categories } = useUserModuleData();

    const [banners, setBanners] = useState([]);
    const [roleOptions, setRoleOptions] = useState(["user", "provider", "vendor"]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ title: "", imageUrl: "", serviceName: "", linkTo: "", startDate: "", endDate: "", priority: 1 });
    const [editingBanner, setEditingBanner] = useState(null);
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const [broadcastForm, setBroadcastForm] = useState({
        roles: ["user"],
        city: "",
        subscriptionPlanId: "",
        subscriptionStatus: "",
        title: "",
        message: "",
        link: "",
        icon: "",
    });
    const [broadcastHistory, setBroadcastHistory] = useState([]);
    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [broadcasting, setBroadcasting] = useState(false);

    const takenPriorities = useMemo(() => 
        banners.filter(b => b.id !== editingBanner?.id).map(b => Number(b.priority)),
        [banners, editingBanner]
    );

    // Safety check for services and categories
    const safeServices = services || [];
    const safeCategories = categories || [];

    const sortedBanners = useMemo(
        () => [...banners].sort((a, b) => (b.priority || 0) - (a.priority || 0)),
        [banners]
    );

    const loadBanners = async () => {
        try {
            const items = await getBanners();
            setBanners(Array.isArray(items) ? items : []);
        } catch {
            setBanners([]);
        }
    };

    const loadPushMeta = async () => {
        try {
            const [history, plans, sys] = await Promise.all([
                getPushBroadcastHistory(),
                getSubscriptionPlans().catch(() => []),
                getSystemSettings().catch(() => null)
            ]);
            setBroadcastHistory(Array.isArray(history) ? history : []);
            setSubscriptionPlans(Array.isArray(plans) ? plans : []);
            if (sys?.availableRoles) setRoleOptions(sys.availableRoles);
        } catch {
            setBroadcastHistory([]);
            setSubscriptionPlans([]);
        }
    };

    useEffect(() => {
        loadBanners();
        loadPushMeta();
    }, []);

    const getFirstAvailablePriority = () => {
        const taken = banners.map(b => Number(b.priority));
        for (let i = 1; i <= 10; i++) {
            if (!taken.includes(i)) return i;
        }
        return 1;
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        
        // If image file is selected, use the preview (base64) as imageUrl
        if (selectedImageFile && imagePreview) {
            form.imageUrl = imagePreview; 
        }

        if (editingBanner) {
            await updateBanner(editingBanner.id, editingBanner.gender || "women", form);
        } else {
            await addBanner(form);
        }

        setForm({ title: "", imageUrl: "", serviceName: "", linkTo: "", startDate: "", endDate: "", priority: getFirstAvailablePriority() });
        setSelectedImageFile(null);
        setImagePreview(null);
        setEditingBanner(null);
        setShowForm(false);
        loadBanners();
    };

    const handleEdit = (banner) => {
        setEditingBanner(banner);
        setForm({
            title: banner.title || "",
            imageUrl: banner.imageUrl || "",
            serviceName: banner.serviceName || "",
            linkTo: banner.linkTo || "",
            startDate: banner.startDate || "",
            endDate: banner.endDate || "",
            priority: banner.priority || 1,
        });
        setImagePreview(banner.imageUrl || null);
        setShowForm(true);
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB');
            return;
        }

        // Store file for later upload
        setSelectedImageFile(file);

        // Create preview URL
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        setSelectedImageFile(null);
        setImagePreview(null);
        updateBannerForm('imageUrl', '');
        // Reset file input
        const fileInput = document.getElementById('banner-image-upload');
        if (fileInput) fileInput.value = '';
    };

    // Get category of selected service
    const getSelectedServiceCategory = () => {
        if (!form.serviceName) return '';
        const service = services.find(s => s.name === form.serviceName);
        if (!service) return '';
        const category = categories.find(c => c.id === service.category);
        return category ? `/explore/${category.id}` : '';
    };

    // Auto-populate linkTo when service is selected
    const handleServiceChange = (serviceName) => {
        updateBannerForm('serviceName', serviceName);
        if (serviceName) {
            const service = safeServices.find(s => s.name === serviceName);
            if (service) {
                const category = safeCategories.find(c => c.id === service.category);
                if (category) {
                    updateBannerForm('linkTo', `/explore/${category.id}`);
                }
            }
        } else {
            updateBannerForm('linkTo', '');
        }
    };

    const handleDelete = async (id) => {
        await deleteBanner(id);
        loadBanners();
    };

    const updateBannerForm = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
    const updateBroadcastForm = (k, v) => setBroadcastForm((prev) => ({ ...prev, [k]: v }));

    const toggleRole = (role) => {
        setBroadcastForm((prev) => {
            const has = prev.roles.includes(role);
            const roles = has ? prev.roles.filter((item) => item !== role) : [...prev.roles, role];
            return { ...prev, roles: roles.length ? roles : [role] };
        });
    };

    const handleBroadcast = async (e) => {
        e.preventDefault();
        setBroadcasting(true);
        try {
            await pushBroadcast({
                ...broadcastForm,
                roles: broadcastForm.roles,
                city: broadcastForm.city || undefined,
                subscriptionPlanId: broadcastForm.subscriptionPlanId || undefined,
                subscriptionStatus: broadcastForm.subscriptionStatus || undefined,
                link: broadcastForm.link || undefined,
                icon: broadcastForm.icon || undefined,
            });
            setBroadcastForm({
                roles: ["user"],
                city: "",
                subscriptionPlanId: "",
                subscriptionStatus: "",
                title: "",
                message: "",
                link: "",
                icon: "",
            });
            await loadPushMeta();
        } finally {
            setBroadcasting(false);
        }
    };



    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                        <Image className="h-7 w-7 text-primary" /> Marketing Control
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Manage banners and send admin push broadcasts without changing existing panel flows.</p>
                </div>
                <Button onClick={() => {
                    if (showForm && editingBanner) {
                        setEditingBanner(null);
                        setForm({ title: "", imageUrl: "", serviceName: "", linkTo: "", startDate: "", endDate: "", priority: getFirstAvailablePriority() });
                        setImagePreview(null);
                        setSelectedImageFile(null);
                    } else {
                        if (!showForm) {
                            setForm(prev => ({ ...prev, priority: getFirstAvailablePriority() }));
                        }
                        setShowForm(!showForm);
                    }
                }} className="gap-2 rounded-xl font-bold">
                    {showForm && editingBanner ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {showForm && editingBanner ? "Cancel Edit" : "Add Banner"}
                </Button>
            </motion.div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                    {showForm && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                            <Card className="border-border/50 shadow-none">
                                <CardHeader><CardTitle className="text-base font-bold">{editingBanner ? "Edit Banner" : "New Banner"}</CardTitle></CardHeader>
                                <CardContent>
                                    <form onSubmit={handleAdd} className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">Title</Label>
                                            <Input placeholder="Summer Sale" value={form.title} onChange={(e) => updateBannerForm("title", e.target.value)} className="rounded-xl h-10 bg-muted/30" required />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold flex items-center gap-1.5">
                                                <Image className="h-3.5 w-3.5 text-primary" />
                                                Banner Image
                                            </Label>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleImageSelect}
                                                        className="hidden"
                                                        id="banner-image-upload"
                                                    />
                                                    <label
                                                        htmlFor="banner-image-upload"
                                                        className="flex items-center justify-center gap-2 w-full h-10 px-4 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-sm cursor-pointer transition-all border border-primary/20"
                                                    >
                                                        <Upload className="h-4 w-4" />
                                                        {selectedImageFile ? 'Change Image' : 'Select Image'}
                                                    </label>
                                                </div>
                                                {(imagePreview || form.imageUrl) && (
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveImage}
                                                        className="h-10 w-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-all"
                                                        title="Remove image"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                            {(imagePreview || form.imageUrl) && (
                                                <div className="mt-2 relative rounded-lg overflow-hidden border border-border/50">
                                                    <img 
                                                        src={imagePreview || form.imageUrl} 
                                                        alt="Preview" 
                                                        className="w-full h-24 object-cover"
                                                    />
                                                    <div className="absolute top-2 right-2 bg-green-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                        ✓ Ready
                                                    </div>
                                                </div>
                                            )}
                                            <p className="text-[10px] text-muted-foreground">
                                                {selectedImageFile 
                                                    ? `Selected: ${selectedImageFile.name} (${(selectedImageFile.size / 1024).toFixed(0)}KB)`
                                                    : 'Max 5MB, JPG/PNG/WebP'}
                                            </p>
                                        </div>

                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="text-xs font-bold flex items-center gap-1.5">
                                                <Package className="h-3.5 w-3.5 text-primary" />
                                                Featured Service (Optional)
                                            </Label>
                                            <select
                                                value={form.serviceName}
                                                onChange={(e) => handleServiceChange(e.target.value)}
                                                className="w-full rounded-xl h-10 bg-white border border-slate-200 px-3 text-sm font-bold text-slate-700 shadow-sm focus:border-primary outline-none transition-all cursor-pointer"
                                            >
                                                <option value="">-- Select Service --</option>
                                                {safeServices.map((s) => (
                                                    <option key={s.id} value={s.name}>
                                                        {s.name} (₹{s.price}) - {s.gender}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                💡 Banner "Book Now" button will navigate to this service detail page
                                            </p>
                                        </div>

                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="text-xs font-bold flex items-center gap-1.5">
                                                <LinkIcon className="h-3.5 w-3.5 text-primary" />
                                                Category Link (Auto-populated)
                                            </Label>
                                            <select
                                                value={form.linkTo}
                                                onChange={(e) => updateBannerForm('linkTo', e.target.value)}
                                                className="w-full rounded-xl h-10 bg-white border border-slate-200 px-3 text-sm font-bold text-slate-700 shadow-sm focus:border-primary outline-none transition-all cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                                                disabled={!form.serviceName}
                                            >
                                                <option value="">-- Select Category --</option>
                                                {safeCategories.map((c) => (
                                                    <option key={c.id} value={`/explore/${c.id}`}>
                                                        {c.name} ({c.gender})
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-muted-foreground">
                                                {form.serviceName 
                                                    ? '✓ Auto-populated from selected service category' 
                                                    : 'Select a service first to auto-populate category'}
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">Priority (Position)</Label>
                                            <select
                                                value={form.priority}
                                                onChange={(e) => updateBannerForm("priority", parseInt(e.target.value, 10))}
                                                className="w-full rounded-xl h-10 bg-white border border-slate-200 px-3 text-sm font-bold text-slate-700 shadow-sm focus:border-primary outline-none transition-all cursor-pointer"
                                            >
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => {
                                                    const isTaken = takenPriorities.includes(p);
                                                    return (
                                                        <option key={p} value={p} disabled={isTaken} className={isTaken ? "text-muted-foreground bg-muted/20" : ""}>
                                                            Priority {p} {isTaken ? "(Already Taken)" : ""}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">Start Date</Label>
                                            <Input type="date" min={new Date().toISOString().split('T')[0]} max="2999-12-31" value={form.startDate} onChange={(e) => updateBannerForm("startDate", e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="rounded-xl h-10 bg-muted/30 [&::-webkit-calendar-picker-indicator]:hidden" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">End Date</Label>
                                            <Input type="date" min={form.startDate || new Date().toISOString().split('T')[0]} max="2999-12-31" value={form.endDate} onChange={(e) => updateBannerForm("endDate", e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="rounded-xl h-10 bg-muted/30 [&::-webkit-calendar-picker-indicator]:hidden" />
                                        </div>
                                        <div className="md:col-span-2 flex gap-2">
                                            <Button type="submit" disabled={!selectedImageFile && !form.imageUrl} className="rounded-xl font-bold gap-2">
                                                <Save className="h-4 w-4" /> Save Banner
                                            </Button>
                                            <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => {
                                                setShowForm(false);
                                                setEditingBanner(null);
                                                setForm({ title: "", imageUrl: "", serviceName: "", linkTo: "", startDate: "", endDate: "", priority: 1 });
                                                setSelectedImageFile(null);
                                                setImagePreview(null);
                                            }}>Cancel</Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {sortedBanners.length === 0 ? (
                        <Card className="border-border/50">
                            <CardContent className="py-16 text-center">
                                <Image className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                <p className="text-sm font-bold text-muted-foreground">No banners yet</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Click "Add Banner" to create your first promotional banner</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2">
                            {sortedBanners.map((b) => (
                                <motion.div key={b.id} variants={item}>
                                    <Card className="border-border/50 shadow-none hover:border-primary/30 transition-all overflow-hidden">
                                        {b.imageUrl && <div className="h-32 bg-muted bg-cover bg-center" style={{ backgroundImage: `url(${b.imageUrl})` }} />}
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-sm font-bold">{b.title}</h3>
                                                    {b.serviceName && (
                                                        <div className="mt-1.5 flex items-center gap-1.5">
                                                            <Badge variant="secondary" className="text-[9px] font-bold bg-primary/10 text-primary border-none">
                                                                <Package className="h-2.5 w-2.5 mr-0.5" />
                                                                {b.serviceName}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-muted-foreground font-medium">
                                                        {b.startDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{b.startDate} to {b.endDate || "Open"}</span>}
                                                        {b.linkTo && <span className="flex items-center gap-1"><LinkIcon className="h-3 w-3" />{b.linkTo}</span>}
                                                        <Badge 
                                                            variant="outline" 
                                                            className="text-[8px] font-black px-1.5 h-4 bg-primary/15 text-primary border-primary/30 cursor-pointer hover:bg-primary/25 transition-colors"
                                                            onClick={() => handleEdit(b)}
                                                            title="Click to edit priority"
                                                        >
                                                            <ArrowUpDown className="h-2.5 w-2.5 mr-0.5" />P{b.priority}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 flex-shrink-0">
                                                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg border-indigo-500/30 text-indigo-500 hover:bg-indigo-50" onClick={() => handleEdit(b)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg border-red-500/30 text-red-500 hover:bg-red-50" onClick={() => handleDelete(b.id)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>

                <div className="space-y-6">
                    <Card className="border-border/50 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <BellRing className="h-4 w-4 text-primary" /> Push Broadcast
                            </CardTitle>
                            <CardDescription>Send in-app + FCM push to users, providers, or vendors from the existing admin panel.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleBroadcast} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Target Roles</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {roleOptions.map((role) => {
                                            const active = broadcastForm.roles.includes(role);
                                            return (
                                                <Button
                                                    key={role}
                                                    type="button"
                                                    variant={active ? "default" : "outline"}
                                                    className="rounded-full text-[11px] font-bold capitalize"
                                                    onClick={() => toggleRole(role)}
                                                >
                                                    {role}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">City Filter</Label>
                                        <Input value={broadcastForm.city} onChange={(e) => updateBroadcastForm("city", e.target.value)} placeholder="Optional city" className="rounded-xl h-10 bg-muted/30" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Subscription Status</Label>
                                        <select
                                            value={broadcastForm.subscriptionStatus}
                                            onChange={(e) => updateBroadcastForm("subscriptionStatus", e.target.value)}
                                            className="w-full rounded-xl h-10 bg-muted/30 border border-input px-3 text-sm"
                                        >
                                            <option value="">All</option>
                                            <option value="active">Active</option>
                                            <option value="expired">Expired</option>
                                            <option value="pending_payment">Pending Payment</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Subscription Plan</Label>
                                    <select
                                        value={broadcastForm.subscriptionPlanId}
                                        onChange={(e) => updateBroadcastForm("subscriptionPlanId", e.target.value)}
                                        className="w-full rounded-xl h-10 bg-muted/30 border border-input px-3 text-sm"
                                    >
                                        <option value="">All Plans</option>
                                        {subscriptionPlans.map((plan) => (
                                            <option key={plan._id || plan.id} value={plan._id || plan.id}>
                                                {plan.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Title</Label>
                                    <Input value={broadcastForm.title} onChange={(e) => updateBroadcastForm("title", e.target.value)} placeholder="Weekend beauty flash sale" className="rounded-xl h-10 bg-muted/30" required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Message</Label>
                                    <Textarea value={broadcastForm.message} onChange={(e) => updateBroadcastForm("message", e.target.value)} placeholder="Short, clear message for the selected audience." className="rounded-2xl min-h-[110px] bg-muted/30" required />
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Click Link</Label>
                                        <Input value={broadcastForm.link} onChange={(e) => updateBroadcastForm("link", e.target.value)} placeholder="/notifications" className="rounded-xl h-10 bg-muted/30" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Icon URL</Label>
                                        <Input value={broadcastForm.icon} onChange={(e) => updateBroadcastForm("icon", e.target.value)} placeholder="Optional icon URL" className="rounded-xl h-10 bg-muted/30" />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-2">
                                    <Button 
                                        type="submit" 
                                        disabled={broadcasting} 
                                        className="rounded-xl font-bold gap-2 bg-primary hover:bg-primary/90 w-full px-8 h-12 text-base"
                                    >
                                        <Send className="h-5 w-5" /> {broadcasting ? "Sending..." : "Send Notification"}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-base font-bold">Recent Broadcasts</CardTitle>
                            <CardDescription>Latest admin-triggered push broadcasts with audience and delivery summary.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {broadcastHistory.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                                    No push broadcasts sent yet.
                                </div>
                            ) : (
                                broadcastHistory.map((entry) => (
                                    <div key={entry._id || entry.id} className="rounded-2xl border border-border/60 p-4 bg-muted/20">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold">{entry.title}</p>
                                                <p className="text-xs text-muted-foreground mt-1">{entry.message}</p>
                                            </div>
                                            <Badge variant="outline" className="rounded-full text-[10px] font-black">
                                                {(entry.filters?.roles || []).join(", ") || "all"}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground font-medium">
                                            <span>Targeted: {entry.stats?.targeted ?? 0}</span>
                                            <span>Push sent: {entry.stats?.pushSent ?? 0}</span>
                                            <span>Push failed: {entry.stats?.pushFailed ?? 0}</span>
                                            {entry.filters?.city ? <span>City: {entry.filters.city}</span> : null}
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
