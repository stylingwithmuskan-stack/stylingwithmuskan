import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Store, User, Mail, Phone, MapPin, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/user/components/ui/select";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { useNavigate, Link } from "react-router-dom";

const CITIES = ["Delhi", "Mumbai", "Bangalore", "Hyderabad", "Chennai", "Pune", "Kolkata", "Jaipur", "Gurgaon", "Noida", "Lucknow", "Chandigarh", "Indore"];

export default function VenderRegisterPage() {
    const { register, isLoggedIn } = useVenderAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", businessName: "" });

    useEffect(() => {
        document.documentElement.classList.remove("theme-women", "theme-men", "theme-beautician", "theme-admin");
        document.documentElement.classList.add("theme-vendor");
    }, []);

    useEffect(() => {
        if (isLoggedIn) navigate("/vender/dashboard", { replace: true });
    }, [isLoggedIn]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await register(form);
            if (res?.success) navigate("/vender/dashboard", { replace: true });
        } catch (err) {
            // keep UI unchanged; vendor can retry
        }
    };

    const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50/30 to-white p-4">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[480px]">
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
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-600">City</Label>
                                <Select value={form.city} onValueChange={val => update("city", val)}>
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder="Select city" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-600">Business Name</Label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input placeholder="My Salon" value={form.businessName} onChange={e => update("businessName", e.target.value)} className="pl-10 h-11 rounded-xl" />
                                </div>
                            </div>
                        </div>
                        <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold text-white gap-2 shadow-lg shadow-emerald-200 mt-2">
                            Register <ArrowRight className="h-4 w-4" />
                        </Button>
                    </form>
                    <div className="text-center pt-4 mt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-500 font-medium">
                            Already registered? <Link to="/vender/login" className="text-emerald-600 font-bold hover:underline">Login here</Link>
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}
