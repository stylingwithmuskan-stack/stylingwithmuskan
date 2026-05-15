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
    const { getSystemSettings, updateSystemSettings } = useAdminAuth();
    const [systemSettings, setSystemSettings] = useState({ 
        menSectionEnabled: false, 
        availableRoles: ["user", "provider", "vendor"],
        adminPassword: ""
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const system = await getSystemSettings();
            if (system) {
                setSystemSettings({
                    ...system,
                    adminPassword: system.adminPassword || ""
                });
            }
        } catch (err) {
            console.error("Failed to load settings:", err);
            toast.error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSavePassword = async () => {
        if (!systemSettings.adminPassword.trim()) {
            return toast.error("Please enter a valid password");
        }
        setSaving(true);
        try {
            // Keep existing flags but update password
            const payload = {
                ...systemSettings,
                adminPassword: systemSettings.adminPassword.trim()
            };
            await updateSystemSettings(payload);
            toast.success("Admin password updated successfully");
        } catch (err) {
            console.error("Failed to update password:", err);
            toast.error("Failed to update password");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm font-bold text-muted-foreground animate-pulse">Loading Admin Settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-2xl mx-auto pb-20">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl md:text-4xl font-black tracking-tight flex items-center gap-3">
                    <Shield className="h-8 w-8 text-primary" /> Admin Security
                </h1>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                    Manage your dynamic administrator password.
                </p>
            </motion.div>

            <Card className="border-border/50 shadow-none overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/50">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" /> Password Configuration
                    </CardTitle>
                    <CardDescription>Enter a new password to update your login credentials.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Admin Password
                        </Label>
                        <Input 
                            type="text"
                            value={systemSettings.adminPassword} 
                            onChange={(e) => setSystemSettings({ ...systemSettings, adminPassword: e.target.value })} 
                            placeholder="Enter new admin password" 
                            className="h-12 rounded-xl bg-muted/30 font-bold text-lg"
                        />
                        <p className="text-[10px] text-muted-foreground font-medium">This password will be used for your next login attempt.</p>
                    </div>

                    <Button 
                        onClick={handleSavePassword} 
                        disabled={saving} 
                        className="w-full h-12 rounded-xl font-black gap-2 bg-black text-white hover:bg-black/90 shadow-xl"
                    >
                        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Update Admin Password
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

const Shield = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
);
