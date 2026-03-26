import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ChevronRight, ArrowLeft, CheckCircle2, Star, Smartphone, Apple } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "@/modules/user/lib/api";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { Button } from "@/modules/user/components/ui/button";

/**
 * UserRegisterPage Component
 * Provides a dedicated, premium registration flow for users.
 */
const UserRegisterPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isLoggedIn, loginWithOtp } = useAuth();
    const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: Profile Setup
    const [phone, setPhone] = useState("");
    const [name, setName] = useState("");
    const [referralCode, setReferralCode] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [timer, setTimer] = useState(30);

    useEffect(() => {
        if (isLoggedIn) {
            const from = location.state?.from || "/home";
            const extraState = location.state || {};
            navigate(from, { state: extraState, replace: true });
        }
    }, [isLoggedIn, navigate, location.state]);

    useEffect(() => {
        let interval;
        if (step === 2 && timer > 0) {
            interval = setInterval(() => setTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    const handlePhoneSubmit = async (e) => {
        e.preventDefault();
        if (phone.length !== 10) return;
        try {
            const res = await api.requestOtp(phone, "register");
            console.log("[UserRegister] request-otp response", res);
            setStep(2);
            setTimer(30);
        } catch (err) {
             console.error("[UserRegister] request-otp error", err);
            alert(err.message || "Failed to send OTP");
            if ((err.message || "").toLowerCase().includes("already")) {
                navigate("/login");
            }
        }
    };

    const handleOtpChange = (index, value) => {
        if (isNaN(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);
  
          if (value && index < 5) {
              const nextInput = document.getElementById(`otp-${index + 1}`);
              nextInput?.focus();
          }

        if (newOtp.every(v => v !== "")) {
            setTimeout(() => setStep(3), 500);
        }
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        const enteredOtp = otp.join("");
        try {
            await loginWithOtp({ phone, otp: enteredOtp, name, referralCode, intent: "register" });
            console.log("[UserRegister] login success", { phone });
            navigate("/home");
        } catch (err) {
            console.error("[UserRegister] login error", err);
            alert(err.message || "Verification failed");
            setStep(2);
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
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 lg:p-8 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
            {/* Header / Logo Section */}
            <div className="mb-12 text-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-20 h-20 mx-auto rounded-3xl bg-gradient-theme flex items-center justify-center shadow-2xl shadow-primary/20 mb-6"
                >
                    <ShieldCheck className="w-10 h-10 text-primary-foreground" />
                </motion.div>
                <motion.h1
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-3xl font-black font-display tracking-tight text-foreground lowercase"
                >
                    stylingwithmuskan
                </motion.h1>
                <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-xs text-muted-foreground font-black uppercase tracking-widest mt-2"
                >
                    Salon & Spa at Home • Premium Services
                </motion.p>
            </div>

            {/* Main Form Card */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="w-full max-w-lg bg-white/50 backdrop-blur-xl rounded-[40px] border border-white p-8 lg:p-12 shadow-2xl relative overflow-hidden"
            >
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl px-12 pt-12" />

                <div className="relative">
                    {/* Back Button */}
                    {step > 1 && (
                        <button onClick={() => setStep(step - 1)} className="absolute -left-2 -top-1 w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}

                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <div className="mb-8">
                                    <h2 className="text-2xl font-black text-foreground">Sign Up</h2>
                                    <p className="text-sm text-muted-foreground mt-2 font-medium">Join us for a premium salon experience at your doorstep.</p>
                                </div>

                                <form onSubmit={handlePhoneSubmit} className="space-y-6">
                                    <div className="relative group">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2 border-r pr-4 border-border transition-colors group-focus-within:border-primary/30">
                                            <span className="text-sm font-black text-gray-400 font-display">🇮🇳 +91</span>
                                        </div>
                                        <input
                                            autoFocus
                                            type="tel"
                                            maxLength={10}
                                            placeholder="Mobile Number"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                                            className="w-full h-16 pl-[90px] pr-6 rounded-[24px] bg-accent/30 border-2 border-transparent focus:border-primary/20 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all text-lg font-bold"
                                        />
                                    </div>

                                    <Button disabled={phone.length !== 10} className="w-full h-16 rounded-[24px] text-base font-black tracking-widest uppercase bg-black text-white hover:bg-black/90 shadow-xl shadow-black/10 transition-all hover:scale-[1.02] active:scale-95">
                                        Receive OTP <ChevronRight className="ml-2 w-5 h-5" />
                                    </Button>

                                    <p className="text-[11px] text-muted-foreground text-center leading-relaxed font-medium px-4">
                                        By signing up, you agree to our <span className="text-primary font-bold cursor-pointer hover:underline">Terms of Service</span> and <span className="text-primary font-bold cursor-pointer hover:underline">Privacy Policy</span>.
                                    </p>
                                    <p className="text-[11px] text-muted-foreground text-center leading-relaxed font-medium px-4 mt-2">
                                        Already have an account?{" "}
                                        <button type="button" onClick={() => navigate("/login")} className="text-primary font-bold hover:underline">
                                            Login
                                        </button>
                                    </p>
                                </form>
                            </motion.div>
                        ) : step === 2 ? (
                            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <div className="mb-8 text-center pt-4">
                                    <h2 className="text-2xl font-black text-foreground">Verify OTP</h2>
                                    <p className="text-sm text-muted-foreground mt-2 font-medium">Enter the 6-digit code sent to +91 {phone}</p>
                                </div>

                                <div className="flex justify-center gap-4 mb-8">
                                    {otp.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            id={`otp-${idx}`}
                                            type="text"
                                            maxLength={1}
                                            value={digit}
                                            autoFocus={idx === 0}
                                            onChange={(e) => handleOtpChange(idx, e.target.value)}
                                            className="w-14 h-16 text-center text-2xl font-black bg-accent/40 rounded-2xl border-2 border-transparent focus:border-primary/20 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
                                        />
                                    ))}
                                </div>

                                <div className="text-center">
                                    {timer > 0 ? (
                                        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">Resend OTP in <span className="text-primary">{timer}s</span></p>
                                    ) : (
                                        <button onClick={() => setTimer(30)} className="text-[11px] font-black text-primary uppercase tracking-widest hover:underline decoration-2 underline-offset-4">
                                            RESEND OTP NOW
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <div className="mb-8 pt-4">
                                    <h2 className="text-2xl font-black text-foreground">Personalize Profile</h2>
                                    <p className="text-sm text-muted-foreground mt-2 font-medium">Help us know you better for a tailored experience.</p>
                                </div>

                                <form onSubmit={handleProfileSubmit} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-4">Full Name*</label>
                                        <input
                                            autoFocus
                                            type="text"
                                            required
                                            placeholder="e.g. Muskan Sharma"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full h-14 px-6 rounded-2xl bg-accent/30 border-none text-base focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-4">Referral Code (Optional)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. SAVE100"
                                            value={referralCode}
                                            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                                            className="w-full h-14 px-6 rounded-2xl bg-accent/30 border-none text-base focus:ring-2 focus:ring-primary/20 transition-all font-bold tracking-widest"
                                        />
                                    </div>

                                    <Button disabled={!name.trim()} className="w-full h-16 rounded-[24px] text-base font-black tracking-widest uppercase bg-black text-white hover:bg-black/90 shadow-xl shadow-black/10 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">
                                        Complete Account <CheckCircle2 className="w-5 h-5" />
                                    </Button>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

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

export default UserRegisterPage;
