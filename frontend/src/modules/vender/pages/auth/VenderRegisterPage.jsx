import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Store, User, Mail, Phone, MapPin, Building2, ArrowRight, X } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/user/components/ui/select";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";

const CITIES = ["Delhi", "Mumbai", "Bangalore", "Hyderabad", "Chennai", "Pune", "Kolkata", "Jaipur", "Gurgaon", "Noida", "Lucknow", "Chandigarh", "Indore"];

export default function VenderRegisterPage() {
    const { registerRequest, verifyRegistrationOtp, isLoggedIn } = useVenderAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: "", email: "", phone: "", city: "" });
    const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        document.documentElement.classList.remove("theme-women", "theme-men", "theme-beautician", "theme-admin");
        document.documentElement.classList.add("theme-vendor");
    }, []);

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

        setLoading(true);
        try {
            const res = await registerRequest(form.phone);
            if (res?.success) {
                setIsOtpModalOpen(true);
                toast.success("OTP sent to your mobile number");
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
            const res = await verifyRegistrationOtp({ ...form, otp });
            if (res?.success) {
                toast.success("Registration request submitted! Please wait for admin approval.");
                navigate("/vender/login");
            }
        } catch (err) {
            toast.error(err.message || "OTP verification failed");
        } finally {
            setLoading(false);
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
                            <div className="space-y-2 col-span-2">
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
                        </div>
                        <Button type="submit" disabled={loading} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold text-white gap-2 shadow-lg shadow-emerald-200 mt-2">
                            {loading ? "Sending OTP..." : "Register"} <ArrowRight className="h-4 w-4" />
                        </Button>
                    </form>
                    <div className="text-center pt-4 mt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-500 font-medium">
                            Already registered? <Link to="/vender/login" className="text-emerald-600 font-bold hover:underline">Login here</Link>
                        </p>
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
                                <p className="text-xs text-gray-500 mt-1">Enter the 6-digit OTP sent to {form.phone}</p>
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
