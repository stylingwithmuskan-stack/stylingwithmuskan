import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Save, RefreshCw, Palette, IndianRupee, Percent, Plus, Trash2, Info, Users, X, Mail, Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { toast } from "sonner";
import { cn } from "@/modules/user/lib/utils";

export default function SystemSettings() {
    const { getSystemSettings, updateSystemSettings, sendSystemSettingsOtp } = useAdminAuth();
    const [systemSettings, setSystemSettings] = useState({
        menSectionEnabled: false,
        availableRoles: ["user", "provider", "vendor"],
        adminPassword: "",
        adminEmail: ""
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // OTP states
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otp, setOtp] = useState("");
    const [sendingOtp, setSendingOtp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

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
                    adminPassword: "",
                    adminEmail: system.adminEmail || ""
                });
            }
        } catch (err) {
            console.error("Failed to load settings:", err);
            toast.error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const handleRequestOtp = async () => {
        if (!systemSettings.adminPassword.trim()) {
            return toast.error("Please enter a valid password");
        }
        setSendingOtp(true);
        try {
            await sendSystemSettingsOtp();
            toast.success("Security OTP sent to registered admin email!");
            setShowOtpInput(true);
        } catch (err) {
            console.error("Failed to send OTP:", err);
            toast.error(err?.message || "Failed to send OTP");
        } finally {
            setSendingOtp(false);
        }
    };

    const handleSavePassword = async () => {
        if (!systemSettings.adminPassword.trim()) {
            return toast.error("Please enter a valid password");
        }
        if (!otp.trim() || otp.trim().length !== 6) {
            return toast.error("Please enter the 6-digit OTP code");
        }
        setSaving(true);
        try {
            // Send payload with new password and the verification OTP
            const payload = {
                ...systemSettings,
                adminPassword: systemSettings.adminPassword.trim(),
                adminEmail: systemSettings.adminEmail.trim(),
                otp: otp.trim()
            };
            await updateSystemSettings(payload);
            toast.success("Admin password updated successfully!");
            setShowOtpInput(false);
            setOtp("");
        } catch (err) {
            console.error("Failed to update password:", err);
            toast.error(err?.message || "Failed to update password");
        } finally {
            setSaving(false);
        }
    };

    const handleCancelOtp = () => {
        setShowOtpInput(false);
        setOtp("");
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
                    <CardDescription>
                        {showOtpInput
                            ? "Verify your identity using the OTP code sent to your registered email."
                            : "Enter a new password to update your login credentials."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Admin Email
                        </Label>
                        <Input
                            type="email"
                            disabled={showOtpInput}
                            value={systemSettings.adminEmail}
                            onChange={(e) => setSystemSettings({ ...systemSettings, adminEmail: e.target.value })}
                            placeholder="Enter email for OTPs & Admin alerts"
                            className={cn(
                                "h-12 rounded-xl font-bold text-lg",
                                showOtpInput ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : "bg-muted/30"
                            )}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Admin Password
                        </Label>
                        <div className="relative">
                            <Input
                                type={showPassword ? "text" : "password"}
                                disabled={showOtpInput}
                                value={systemSettings.adminPassword}
                                onChange={(e) => setSystemSettings({ ...systemSettings, adminPassword: e.target.value })}
                                placeholder="Enter new admin password"
                                className={cn(
                                    "h-12 rounded-xl font-bold text-lg pr-12",
                                    showOtpInput ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : "bg-muted/30"
                                )}
                            />
                            <button
                                type="button"
                                disabled={showOtpInput}
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                        {!showOtpInput && (
                            <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 text-amber-500" />
                                This password will be used for your next login attempt. Changing it requires email verification.
                            </p>
                        )}
                    </div>

                    {showOtpInput && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-3 pt-2"
                        >
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5" /> Enter 6-Digit OTP <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    type="text"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    placeholder="e.g. 123456"
                                    className="h-12 rounded-xl bg-muted/30 font-bold text-center text-xl tracking-[0.5em] placeholder:tracking-normal placeholder:text-muted-foreground/50"
                                />
                                <p className="text-[10px] text-muted-foreground font-medium">
                                    We sent a 6-digit OTP code to the registered administrator email. Please check your inbox or console log.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {!showOtpInput ? (
                        <Button
                            onClick={handleRequestOtp}
                            disabled={sendingOtp || !systemSettings.adminPassword.trim()}
                            className="w-full h-12 rounded-xl font-black gap-2 bg-black text-white hover:bg-black/90 shadow-xl disabled:opacity-50"
                        >
                            {sendingOtp ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            Request OTP & Update Password
                        </Button>
                    ) : (
                        <div className="space-y-3">
                            <Button
                                onClick={handleSavePassword}
                                disabled={saving || otp.length !== 6}
                                className="w-full h-12 rounded-xl font-black gap-2 bg-black text-white hover:bg-black/90 shadow-xl disabled:opacity-50"
                            >
                                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Verify & Update Dynamic Password
                            </Button>

                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <Button
                                    variant="outline"
                                    onClick={handleRequestOtp}
                                    disabled={sendingOtp}
                                    className="h-11 rounded-xl font-bold border-border bg-white text-black hover:bg-muted/50 gap-1.5"
                                >
                                    {sendingOtp ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                    Resend OTP
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={handleCancelOtp}
                                    className="h-11 rounded-xl font-bold hover:bg-red-50 text-red-600 hover:text-red-700 gap-1.5"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
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
