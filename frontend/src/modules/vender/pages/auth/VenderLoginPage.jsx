import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Store, Smartphone, ArrowRight } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function VenderLoginPage() {
    const { requestOtp, verifyOtp, isLoggedIn } = useVenderAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [error, setError] = useState("");

    useEffect(() => {
        document.documentElement.classList.remove("theme-women", "theme-men", "theme-beautician", "theme-admin");
        document.documentElement.classList.add("theme-vendor");
    }, []);

    useEffect(() => {
        if (isLoggedIn) navigate("/vender/dashboard", { replace: true });
    }, [isLoggedIn]);

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setError("");
        try {
            if (phone.length !== 10) return;
            await requestOtp(phone);
            setStep(2);
        } catch (err) {
            setError(err?.message || "Failed to request OTP");
        }
    };
    const handleVerify = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const code = otp.join("");
            await verifyOtp(phone, code);
            navigate("/vender/dashboard", { replace: true });
        } catch (err) {
            setError(err?.message || "Failed to verify OTP");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50/30 to-white p-4">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-[420px]"
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.2 }}
                        className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200"
                    >
                        <Store className="h-8 w-8 text-white" />
                    </motion.div>
                    <h1 className="text-2xl font-black tracking-tight text-gray-900">Vendor Portal</h1>
                    <p className="text-sm text-gray-500 font-medium mt-1 uppercase tracking-widest">stylingwithmuskan</p>
                </div>

                {/* Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-emerald-100/30 p-6 space-y-5"
                >
                    {step === 1 ? (
                        <form onSubmit={handleRequestOtp} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-xs font-bold text-gray-600">Mobile Number</Label>
                                <div className="relative">
                                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input id="phone" type="tel" placeholder="10-digit mobile number" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} className="pl-10 h-11 rounded-xl border-gray-200" required />
                                </div>
                            </div>

                            {error && <p className="text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

                            <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold text-white gap-2 shadow-lg shadow-emerald-200">
                                Continue <ArrowRight className="h-4 w-4" />
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerify} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-600">Enter OTP</Label>
                                <div className="grid grid-cols-6 gap-2">
                                    {otp.map((d, i) => (
                                        <Input key={i} id={`otp-${i}`} value={d} onChange={e => {
                                            if (/^\d*$/.test(e.target.value)) {
                                                const n = [...otp]; n[i] = e.target.value.slice(-1); setOtp(n);
                                                if (e.target.value && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
                                            }
                                        }} className="h-12 text-center font-bold" maxLength={1} />
                                    ))}
                                </div>
                            </div>
                            {error && <p className="text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                            <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold text-white gap-2 shadow-lg shadow-emerald-200">
                                Verify & Login <ArrowRight className="h-4 w-4" />
                            </Button>
                        </form>
                    )}

                    <div className="text-center pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 font-medium">
                            New vendor? <Link to="/vender/register" className="text-emerald-600 font-bold hover:underline">Register here</Link>
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}
