import React from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone, MapPin, Building2, Calendar, Shield, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { useNavigate } from "react-router-dom";

export default function VenderProfile() {
    const { vendor, logout } = useVenderAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/vender/login");
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
        <div className="space-y-6 max-w-2xl mx-auto">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">Profile</h1>
                <p className="text-sm text-muted-foreground font-medium mt-1">Your vendor account details</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="shadow-sm overflow-hidden">
                    {/* Header Banner */}
                    <div className="h-24 bg-gradient-to-r from-primary to-emerald-400 relative">
                        <div className="absolute -bottom-10 left-6">
                            <div className="h-20 w-20 rounded-2xl bg-card border-4 border-card shadow-lg flex items-center justify-center">
                                <span className="text-3xl font-black text-primary">{vendor?.name?.charAt(0) || "V"}</span>
                            </div>
                        </div>
                    </div>
                    <div className="pt-14 px-6 pb-6">
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-black">{vendor?.name || "Vendor"}</h2>
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-[9px] font-black">
                                <Shield className="h-2.5 w-2.5 mr-1" /> Verified
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">ID: {vendor?.id}</p>
                    </div>
                </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="shadow-sm">
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
                                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
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

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                <Button variant="outline" className="w-full h-12 rounded-xl font-bold text-red-600 border-red-200 hover:bg-red-50 gap-2" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" /> Logout
                </Button>
            </motion.div>
        </div>
    );
}
