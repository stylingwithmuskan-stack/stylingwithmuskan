import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminLoginPage() {
    const { login, isLoggedIn } = useAdminAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        document.documentElement.classList.remove("theme-women", "theme-men", "theme-beautician", "theme-vendor");
        document.documentElement.classList.add("theme-admin");
    }, []);

    useEffect(() => {
        if (isLoggedIn) navigate("/admin/dashboard", { replace: true });
    }, [isLoggedIn]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        const result = await login(email, password);
        if (result.success) navigate("/admin/dashboard");
        else setError(result.error || "Invalid credentials");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0c1a] p-4">
            {/* Background Pattern */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 -left-20 w-80 h-80 bg-indigo-600/8 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
            </div>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[420px] relative z-10">
                <div className="text-center mb-8">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
                        className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-600/20">
                        <Shield className="h-8 w-8 text-white" />
                    </motion.div>
                    <h1 className="text-2xl font-black tracking-tight text-white">Admin Console</h1>
                    <p className="text-sm text-gray-500 font-medium mt-1 uppercase tracking-widest">stylingwithmuskan</p>
                </div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-[#111328] rounded-2xl border border-gray-800/50 shadow-2xl p-6 space-y-5">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-xs font-bold text-gray-400">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <Input id="email" type="email" placeholder="admin@swm.com" value={email} onChange={e => setEmail(e.target.value)}
                                    className="pl-10 h-11 rounded-xl bg-[#1a1d35] border-gray-700/50 text-white placeholder:text-gray-600" required />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-xs font-bold text-gray-400">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <Input id="password" type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                                    className="pl-10 pr-10 h-11 rounded-xl bg-[#1a1d35] border-gray-700/50 text-white placeholder:text-gray-600" required />
                                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {error && <p className="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{error}</p>}

                        <Button type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-white gap-2 shadow-lg shadow-indigo-600/20">
                            Login <ArrowRight className="h-4 w-4" />
                        </Button>
                    </form>
                    <p className="text-[10px] text-gray-600 text-center">Enter any email & password to access the demo</p>
                </motion.div>
            </motion.div>
        </div>
    );
}
