import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ArrowLeft, ChevronRight, Star, Smartphone, Apple } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { api } from "@/modules/user/lib/api";
import { Button } from "@/modules/user/components/ui/button";

const UserLoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isLoggedIn, loginWithOtp } = useAuth();
    const [step, setStep] = useState(1); // 1: Phone, 2: OTP
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [timer, setTimer] = useState(30);
    const [error, setError] = useState("");
    const [otpDeliveryMode, setOtpDeliveryMode] = useState("sms");

    useEffect(() => {
        if (isLoggedIn) {
            const from = location.state?.from || "/profile";
            const extraState = location.state || {};
            navigate(from, { state: extraState, replace: true });
        }
    }, [isLoggedIn, navigate, location.state]);

    useEffect(() => {
        let id;
        if (step === 2 && timer > 0) id = setInterval(() => setTimer(t => t - 1), 1000);
        return () => clearInterval(id);
    }, [step, timer]);

    const request = async () => {
        setError("");
        const res = await api.requestOtp(phone, "login");
        return res;
    };

    const handlePhoneSubmit = async (e) => {
        e.preventDefault();
        if (phone.length !== 10) return;

        // Basic phone validation (starts with 6-9)
        if (!/^[6-9]\d{9}$/.test(phone)) {
            setError("Please enter a valid 10-digit mobile number");
            return;
        }

        try {
            const res = await request();
            setOtpDeliveryMode(res?.deliveryMode || "sms");
            setStep(2);
            setTimer(30);
        } catch (e) {
            setError(e.message || "Failed to send OTP");
        }
    };

    const handleResend = async () => {
        try {
            setError(""); // Clear previous errors
            const res = await request();
            
            // Update delivery mode if returned
            if (res?.deliveryMode) {
                setOtpDeliveryMode(res.deliveryMode);
            }
            
            // Show success message
            toast.success(res?.message || "OTP sent successfully!");
            
            // Reset timer
            setTimer(30);
        } catch (e) {
            const errorMsg = e.message || "Failed to resend OTP";
            setError(errorMsg);
            toast.error(errorMsg);
        }
    };

    const handleOtpChange = (index, value) => {
        const char = value.slice(-1);
        if (char && !/^\d$/.test(char)) return;

        const newOtp = [...otp];
        newOtp[index] = char;
        setOtp(newOtp);

        // Auto-focus next field if a value was entered
        if (char && index < 5) {
            const nextInput = document.getElementById(`login-otp-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === "Backspace") {
            if (!otp[index] && index > 0) {
                const prevInput = document.getElementById(`login-otp-${index - 1}`);
                if (prevInput) prevInput.focus();
            }
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        const code = otp.join("");
        try {
            await loginWithOtp({ phone, otp: code, intent: "login" });
            navigate("/profile", { replace: true });
        } catch (ex) {
            setError(ex.message || "Verification failed");
        }
    };

    const StoreButton = ({ icon: Icon, label, sublabel, dark }) => (
        <button className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all hover:scale-105 active:scale-95 ${dark ? 'bg-black text-white' : 'bg-white text-black border-border border shadow-sm'}`}>
            <Icon className={`w-8 h-8 ${dark ? 'text-white' : 'text-primary'}`} />
            <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 leading-none">{sublabel}</p>
                <p className="text-lg font-black leading-tight mt-0.5">{label}</p>
            </div>
        </button>
    );

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
            <div className="w-full max-w-lg bg-white/60 backdrop-blur-xl rounded-[24px] sm:rounded-[32px] border border-white shadow-2xl p-5 sm:p-8 relative">
                <button onClick={() => navigate("/home")} className="absolute top-4 left-4 w-9 h-9 rounded-full hover:bg-black/5 flex items-center justify-center">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-theme flex items-center justify-center shadow-lg mb-3">
                        <ShieldCheck className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <h1 className="text-2xl font-black">Login</h1>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Enter mobile then OTP</p>
                </div>
                <AnimatePresence mode="wait">
                    {step === 1 ? (
                        <motion.form key="login-step-phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handlePhoneSubmit} className="space-y-6">
                            <div className="relative">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 border-r pr-3 text-sm font-bold text-gray-500">+91</div>
                                <input type="tel" autoFocus maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="Mobile Number*" className="w-full h-14 pl-20 pr-4 rounded-2xl bg-accent focus:bg-white focus:ring-2 focus:ring-primary/20" />
                            </div>
                            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
                            <Button type="submit" disabled={phone.length !== 10} className="w-full h-12 rounded-2xl font-bold">
                                Send OTP <ChevronRight className="ml-2 w-4 h-4" />
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">
                                New here? <button type="button" className="text-primary font-bold hover:underline" onClick={() => navigate("/register")}>Register</button>
                            </p>
                        </motion.form>
                    ) : (
                        <motion.form key="login-step-otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleVerify} className="space-y-6">
                            <p className="text-xs text-center text-muted-foreground font-medium">
                                {otpDeliveryMode === "allowlist"
                                    ? `Enter the 6-digit OTP for +91 ${phone}`
                                    : `Enter the 6-digit code sent to +91 ${phone}`}
                            </p>
                             <div className="flex justify-center gap-2 sm:gap-3 w-full max-w-sm mx-auto">
                                {otp.map((d, i) => (
                                    <input 
                                        key={i} 
                                        id={`login-otp-${i}`} 
                                        type="tel" 
                                        inputMode="numeric"
                                        maxLength={1} 
                                        value={d} 
                                        autoFocus={i === 0}
                                        autoComplete={i === 0 ? "one-time-code" : "off"}
                                        onChange={(e) => handleOtpChange(i, e.target.value)} 
                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold bg-accent rounded-xl border-2 border-transparent focus:border-primary focus:bg-white text-foreground flex-shrink-0" 
                                    />
                                ))}
                            </div>
                            {timer > 0 ? (
                                <p className="text-xs text-center text-muted-foreground">Resend in {timer}s</p>
                            ) : (
                                <button type="button" className="text-xs font-bold text-primary hover:underline block mx-auto" onClick={handleResend}>
                                    RESEND OTP
                                </button>
                            )}
                            {error && <p className="text-sm font-semibold text-red-600 text-center">{error}</p>}
                            <Button type="submit" disabled={otp.some(d => !d)} className="w-full h-12 rounded-2xl font-bold">
                                Verify & Login
                            </Button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>

            {/* App Store Links Section */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-16 text-center"
            >
                <div className="flex items-center gap-4 justify-center mb-8">
                    <div className="h-px w-12 bg-border" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Download Our Mobile App</p>
                    <div className="h-px w-12 bg-border" />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
                    <StoreButton icon={Smartphone} label="Google Play" sublabel="Get it on" />
                    <StoreButton icon={Apple} label="App Store" sublabel="Download on" dark />
                </div>

                <div className="mt-8 flex items-center justify-center gap-6">
                    <div className="flex -space-x-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-accent flex items-center justify-center overflow-hidden">
                                <img src={`https://i.pravatar.cc/100?u=${i}`} alt="user" className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-0.5 text-amber-500 mb-0.5">
                            <Star className="w-3 h-3 fill-current" />
                            <Star className="w-3 h-3 fill-current" />
                            <Star className="w-3 h-3 fill-current" />
                            <Star className="w-3 h-3 fill-current" />
                            <Star className="w-3 h-3 fill-current" />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground">Trusted by <span className="text-foreground">10k+ Customers</span></p>
                    </div>
                </div>
            </motion.div>

            {/* Bottom Credits */}
            <p className="mt-12 text-[10px] font-bold text-muted-foreground opacity-40 uppercase tracking-widest">
                &copy; {new Date().getFullYear()} stylingwithmuskan. All Rights Reserved.
            </p>
        </div>
    );
};

export default UserLoginPage;

