import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Save, RefreshCw, Palette, IndianRupee, Percent, Plus, Trash2, Info, Users, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { toast } from "sonner";
import { cn } from "@/modules/user/lib/utils";

export default function SystemSettings() {
    const { getStatusSettings, updateStatusSettings, getCommissionSettings, updateCommissionSettings, getSystemSettings, updateSystemSettings } = useAdminAuth();
    const [statusSettings, setStatusSettings] = useState({ statuses: [] });
    const [commissionSettings, setCommissionSettings] = useState({ rate: 15, minPayout: 500, dateFormat: "PPP" });
    const [systemSettings, setSystemSettings] = useState({ menSectionEnabled: false, availableRoles: ["user", "provider", "vendor"] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newRoleInput, setNewRoleInput] = useState("");

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const [status, commission, system] = await Promise.all([
                getStatusSettings(),
                getCommissionSettings(),
                getSystemSettings()
            ]);
            if (status) setStatusSettings(status);
            if (commission) setCommissionSettings(commission);
            if (system) {
                setSystemSettings({
                    ...system,
                    menSectionEnabled: system.menSectionEnabled ?? false,
                    availableRoles: system.availableRoles && system.availableRoles.length > 0 
                        ? system.availableRoles 
                        : ["user", "provider", "vendor"]
                });
            }
        } catch (err) {
            console.error("Failed to load settings:", err);
            toast.error("Failed to load system settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveStatus = async () => {
        setSaving(true);
        try {
            await updateStatusSettings(statusSettings);
            toast.success("Status settings updated successfully");
        } catch (err) {
            toast.error("Failed to update status settings");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveCommission = async () => {
        setSaving(true);
        try {
            await updateCommissionSettings(commissionSettings);
            toast.success("Commission settings updated successfully");
        } catch (err) {
            toast.error("Failed to update commission settings");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSystem = async () => {
        setSaving(true);
        try {
            // Sanitize payload to only include fields expected by the backend
            const payload = {
                menSectionEnabled: !!systemSettings.menSectionEnabled,
                availableRoles: (systemSettings.availableRoles && systemSettings.availableRoles.length > 0) 
                    ? systemSettings.availableRoles 
                    : ["user", "provider", "vendor"]
            };
            await updateSystemSettings(payload);
            toast.success("Platform configuration updated successfully");
        } catch (err) {
            console.error("Failed to update system settings:", err);
            toast.error("Failed to update platform configuration");
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = (index, field, value) => {
        setStatusSettings(prev => {
            const newStatuses = [...(prev?.statuses || [])];
            if (newStatuses[index]) {
                newStatuses[index] = { ...newStatuses[index], [field]: value };
            }
            return { ...prev, statuses: newStatuses };
        });
    };

    const addStatus = () => {
        setStatusSettings(prev => ({
            ...prev,
            statuses: [
                ...(prev?.statuses || []),
                { key: "new_status", label: "New Status", color: "bg-gray-500/15 text-gray-600" }
            ]
        }));
    };

    const removeStatus = (index) => {
        setStatusSettings(prev => ({
            ...prev,
            statuses: (prev?.statuses || []).filter((_, i) => i !== index)
        }));
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm font-bold text-muted-foreground animate-pulse">Initializing System Configuration...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-20">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl md:text-4xl font-black tracking-tight flex items-center gap-3">
                    <Settings className="h-8 w-8 text-primary" /> System Settings
                </h1>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                    Manage core platform configurations, status labels, and financial rules.
                </p>
            </motion.div>

            <div className="grid gap-8 lg:grid-cols-12">
                {/* Status Configuration */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="border-border/50 shadow-none overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b border-border/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <Palette className="h-5 w-5 text-primary" /> Booking Statuses
                                    </CardTitle>
                                    <CardDescription>Customize labels and Tailwind CSS colors for each status.</CardDescription>
                                </div>
                                <Button 
                                    type="button"
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 gap-1.5 font-bold rounded-lg relative z-50 cursor-pointer hover:bg-primary/5" 
                                    onClick={() => {
                                        addStatus();
                                        toast.info("New status row added. Scroll down to see it.");
                                    }}
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add New
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/50">
                                {statusSettings.statuses.map((status, index) => (
                                    <div key={index} className="p-4 md:p-6 hover:bg-muted/10 transition-colors">
                                        <div className="grid gap-4 md:grid-cols-12 items-end">
                                            <div className="md:col-span-2 space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Key (Internal)</Label>
                                                <Input 
                                                    value={status.key} 
                                                    onChange={e => updateStatus(index, "key", e.target.value)} 
                                                    className="h-10 rounded-xl bg-muted/30 font-mono text-xs" 
                                                    placeholder="e.g. pending"
                                                />
                                            </div>
                                            <div className="md:col-span-3 space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Display Label</Label>
                                                <Input 
                                                    value={status.label} 
                                                    onChange={e => updateStatus(index, "label", e.target.value)} 
                                                    className="h-10 rounded-xl bg-muted/30 font-bold" 
                                                    placeholder="e.g. Pending"
                                                />
                                            </div>
                                            <div className="md:col-span-4 space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">CSS Classes (Tailwind)</Label>
                                                <Input 
                                                    value={status.color} 
                                                    onChange={e => updateStatus(index, "color", e.target.value)} 
                                                    className="h-10 rounded-xl bg-muted/30 text-xs" 
                                                    placeholder="bg-blue-500/15 text-blue-600"
                                                />
                                            </div>
                                            <div className="md:col-span-3 flex items-center gap-2">
                                                <div 
                                                    className={cn(
                                                        "h-10 flex-1 rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest px-6 transition-all shadow-sm border border-black/5", 
                                                        status.color
                                                    )}
                                                    title="Live visual preview of the status label"
                                                >
                                                    {status.label || "Preview"}
                                                </div>
                                                <Button 
                                                    variant="outline" 
                                                    size="icon" 
                                                    className="h-10 w-10 border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-xl flex-shrink-0"
                                                    onClick={() => removeStatus(index)}
                                                    title="Remove status"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-6 bg-muted/20 border-t border-border/50 flex justify-end">
                                <Button onClick={handleSaveStatus} disabled={saving} className="h-11 px-8 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save Status Configuration
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                </div>

                {/* Financial Settings */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-border/50 shadow-none h-fit">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <IndianRupee className="h-5 w-5 text-primary" /> Finance Rules
                            </CardTitle>
                            <CardDescription>Global platform commission and payout thresholds.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold flex items-center gap-1.5 mb-1.5">
                                    <Percent className="h-3.5 w-3.5 text-primary" /> Standard Commission (%)
                                </Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    value={commissionSettings.rate} 
                                    onChange={e => setCommissionSettings({ ...commissionSettings, rate: Math.max(0, parseFloat(e.target.value) || 0) })} 
                                    className="h-12 rounded-xl bg-muted/30 font-black text-lg"
                                />
                                <p className="text-[10px] text-muted-foreground font-medium">Platform charge on every completed booking.</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold flex items-center gap-1.5 mb-1.5">
                                    <RefreshCw className="h-3.5 w-3.5 text-primary" /> Min Payout Threshold (₹)
                                </Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    value={commissionSettings.minPayout} 
                                    onChange={e => setCommissionSettings({ ...commissionSettings, minPayout: Math.max(0, parseFloat(e.target.value) || 0) })} 
                                    className="h-12 rounded-xl bg-muted/30 font-black text-lg"
                                />
                                <p className="text-[10px] text-muted-foreground font-medium">Minimum balance required for vendor/SP payout requests.</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold flex items-center gap-1.5 mb-1.5">
                                    <RefreshCw className="h-3.5 w-3.5 text-primary" /> Global Date Format
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: "Aug 24, 2023", value: "PPP" },
                                        { label: "24/08/2023", value: "dd/MM/yyyy" },
                                        { label: "08-24-2023", value: "MM-dd-yyyy" },
                                        { label: "2023-08-24", value: "yyyy-MM-dd" }
                                    ].map((opt) => (
                                        <div 
                                            key={opt.value}
                                            onClick={() => setCommissionSettings({ ...commissionSettings, dateFormat: opt.value })}
                                            className={cn(
                                                "p-3 rounded-xl border-2 cursor-pointer transition-all text-center",
                                                commissionSettings.dateFormat === opt.value 
                                                    ? "border-primary bg-primary/5 text-primary font-bold shadow-sm" 
                                                    : "border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/30"
                                            )}
                                        >
                                            <p className="text-[10px] uppercase font-black tracking-widest mb-1 opacity-60">Style</p>
                                            <p className="text-xs">{opt.label}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium">Choose how dates appear in financial reports and dashboards.</p>
                            </div>

                            <Button onClick={handleSaveCommission} disabled={saving} className="w-full h-12 rounded-xl font-black gap-2 bg-black text-white hover:bg-black/90 shadow-xl">
                                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Update Finance Rules
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Platform Configuration */}
                    <Card className="border-border/50 shadow-none overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b border-border/50">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Shield className="h-5 w-5 text-primary" /> Platform Configuration
                            </CardTitle>
                            <CardDescription>Manage global roles and feature flags.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-4">
                                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    Target Roles Management <Info className="h-3 w-3" />
                                </Label>
                                
                                <div className="flex flex-col gap-3">
                                    <div className="flex gap-2">
                                        <Input 
                                            value={newRoleInput} 
                                            onChange={(e) => setNewRoleInput(e.target.value)} 
                                            placeholder="Enter role (e.g. franchise)" 
                                            className="h-10 rounded-xl bg-muted/30 text-sm flex-1"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (newRoleInput.trim()) {
                                                        const r = newRoleInput.trim().toLowerCase();
                                                        const currentRoles = systemSettings.availableRoles || ["user", "provider", "vendor"];
                                                        if (!currentRoles.includes(r)) {
                                                            setSystemSettings({ ...systemSettings, availableRoles: [...currentRoles, r] });
                                                            setNewRoleInput("");
                                                        } else {
                                                            toast.error("Role already exists");
                                                        }
                                                    }
                                                }
                                            }}
                                        />
                                        <Button 
                                            type="button"
                                            onClick={() => {
                                                if (newRoleInput.trim()) {
                                                    const r = newRoleInput.trim().toLowerCase();
                                                    const currentRoles = systemSettings.availableRoles || ["user", "provider", "vendor"];
                                                    if (!currentRoles.includes(r)) {
                                                        setSystemSettings({ ...systemSettings, availableRoles: [...currentRoles, r] });
                                                        setNewRoleInput("");
                                                    } else {
                                                        toast.error("Role already exists");
                                                    }
                                                }
                                            }}
                                            className="h-10 px-4 rounded-xl font-bold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                                        >
                                            <Plus className="h-4 w-4 mr-1.5" /> Add
                                        </Button>
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {(systemSettings.availableRoles || []).map((role, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-xl px-3 py-1.5 group hover:border-primary/30 transition-all">
                                                <span className="text-xs font-bold capitalize">{role}</span>
                                                <button 
                                                    onClick={() => {
                                                        const currentRoles = systemSettings.availableRoles || ["user", "provider", "vendor"];
                                                        const newRoles = currentRoles.filter((_, i) => i !== idx);
                                                        setSystemSettings({ ...systemSettings, availableRoles: newRoles });
                                                    }}
                                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                                    title="Remove role"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium">Roles added here will appear in the Push Notification target list. Don't forget to click "Save Platform Config" below.</p>
                            </div>

                            <div className="pt-4 border-t border-border/30">
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-bold flex items-center gap-2">
                                            Men's Section Visibility
                                        </Label>
                                        <p className="text-[10px] text-muted-foreground">Toggle the visibility of the Men's grooming category platform-wide.</p>
                                    </div>
                                    <button 
                                        onClick={() => setSystemSettings({ ...systemSettings, menSectionEnabled: !systemSettings.menSectionEnabled })}
                                        className={cn(
                                            "w-11 h-6 rounded-full transition-all relative p-1 shrink-0",
                                            systemSettings.menSectionEnabled ? "bg-primary" : "bg-muted-foreground/30"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                                            systemSettings.menSectionEnabled ? "translate-x-5" : "translate-x-0"
                                        )} />
                                    </button>
                                </div>
                            </div>

                            <Button onClick={handleSaveSystem} disabled={saving} className="w-full h-12 rounded-xl font-black gap-2 bg-black text-white hover:bg-black/90 shadow-xl">
                                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Platform Config
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// Re-using some generic components for consistency
const Shield = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
);
