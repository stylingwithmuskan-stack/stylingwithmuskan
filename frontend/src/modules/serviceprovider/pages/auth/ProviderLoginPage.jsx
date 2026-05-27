import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ChevronLeft,
    Smartphone,
    ArrowRight,
    ShieldCheck,
    Loader2
} from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { useProviderAuth } from "@/modules/serviceprovider/contexts/ProviderAuthContext";
import { api } from "@/modules/user/lib/api";
import { toast } from "sonner";

export default function ProviderLoginPage() {
    const navigate = useNavigate();
    const { requestOtp, verifyOtp, isLoggedIn, isRegistered, isApproved, isPending, isRejected } = useProviderAuth();
    const [step, setStep] = useState(1); // 1: Login, 2: OTP
    const [phone, setPhone] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [timer, setTimer] = useState(300); // 5 minutes OTP validity
    const [resendTimer, setResendTimer] = useState(60); // 1 minute resend cooldown
    const [error, setError] = useState("");
    const [otpDeliveryMode, setOtpDeliveryMode] = useState("sms");

    useEffect(() => {
        // Intentionally do not auto-redirect from login page based on stale local state.
        // Navigation will happen explicitly after OTP verification.
    }, [isLoggedIn, isRegistered, isApproved, isPending, isRejected]);

    useEffect(() => {
        let interval;
        if (step === 2 && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    useEffect(() => {
        let interval;
        if (step === 2 && resendTimer > 0) {
            interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [step, resendTimer]);

    const handleContinue = async () => {
        if (phone.length !== 10) return;

        // Basic phone validation (starts with 6-9)
        if (!/^[6-9]\d{9}$/.test(phone)) {
            setError("Please enter a valid 10-digit mobile number");
            return;
        }

        setIsLoading(true);
        try {
            setError("");
            const res = await requestOtp(phone);
            setOtpDeliveryMode(res?.deliveryMode || "sms");
            setStep(2);
            setTimer(300); // 5 minutes OTP validity
            setResendTimer(60); // 1 minute resend cooldown
        } catch (e) {
            setError(e?.message || "Failed to request OTP");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (timer <= 0) {
            setError("OTP has expired. Please resend.");
            toast.error("OTP has expired. Please resend.");
            return;
        }
        setIsLoading(true);
        try {
            setError("");
            const code = otp.join("");
            await verifyOtp(phone, code);
            navigate("/provider/dashboard", { replace: true });
        } catch (e) {
            setError(e?.message || "Failed to verify OTP");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpChange = (index, value) => {
        const char = value.slice(-1);
        if (char && !/^\d$/.test(char)) return;

        const newOtp = [...otp];
        newOtp[index] = char;
        setOtp(newOtp);

        // Auto-focus next
        if (char && index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === "Backspace") {
            if (!otp[index] && index > 0) {
                const prevInput = document.getElementById(`otp-${index - 1}`);
                if (prevInput) {
                    prevInput.focus();
                }
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            {/* Desktop Illustration - Only visible on larger screens */}
            <div className="hidden lg:flex flex-1 max-w-lg items-center justify-center mr-12">
                <div className="space-y-6">
                    <img src="/logo1.png" alt="Logo" className="h-28 w-28 rounded-full object-cover border-4 border-white shadow-xl mb-8 animate-bounce" />
                    <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">
                        Grow your <span className="text-violet-600">Profession</span> with stylingwithmuskan.
                    </h1>
                    <p className="text-lg text-gray-600">
                        Join 10,000+ professionals providing beauty services at home. Manage bookings, track earnings, and build your brand.
                    </p>
                    <div className="flex gap-4 pt-4">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-violet-100 flex items-center gap-3">
                            <ShieldCheck className="text-green-500 h-6 w-6" />
                            <span className="font-semibold text-sm">Verified Profile</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-violet-100 flex items-center gap-3">
                            <ShieldCheck className="text-purple-500 h-6 w-6" />
                            <span className="font-semibold text-sm">Fast Payouts</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Login Card */}
            <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 backdrop-blur-md rounded-[32px] overflow-hidden">
                <CardContent className="p-6 sm:p-10">
                    {step === 2 && (
                        <button onClick={() => setStep(1)} className="mb-6 p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <ChevronLeft className="h-6 w-6 text-gray-600" />
                        </button>
                    )}

                    <div className="flex flex-col items-center text-center mb-8">
                        <img src="/logo1.png" alt="SWM Logo" className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-lg mb-4" />
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                            {step === 1 ? "Professional Login" : "Verify Number"}
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">
                            {step === 1
                                ? "Access your professional dashboard"
                                : otpDeliveryMode === "allowlist"
                                    ? `Enter the 6-digit OTP for +91 ${phone}`
                                    : `Enter the 6-digit code sent to +91 ${phone}`}
                        </p>
                    </div>

                    {step === 1 ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-gray-400">Mobile Number</label>
                                <div className="flex gap-2">
                                    <div className="w-14 sm:w-16 shrink-0 flex items-center justify-center h-12 rounded-xl bg-gray-50 border border-gray-100 font-bold text-gray-700 text-sm sm:text-base">
                                        +91
                                    </div>
                                    <div className="flex-1 relative min-w-0">
                                        <Input
                                            type="tel"
                                            placeholder="10-digit mobile number"
                                            className="h-12 pl-9 sm:pl-10 w-full rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600 focus:border-violet-600 text-sm sm:text-base placeholder:text-xs sm:placeholder:text-sm"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        />
                                        <Smartphone className="absolute left-2.5 sm:left-3 top-3.5 h-5 w-5 text-gray-400" />
                                    </div>
                                </div>
                            </div>
                            {error && <p className="text-[12px] font-bold text-red-600">{error}</p>}

                            <Button
                                className="w-full h-14 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-lg shadow-lg shadow-violet-200 transition-all active:scale-[0.98]"
                                onClick={handleContinue}
                                disabled={phone.length < 10 || isLoading}
                            >
                                {isLoading ? <Loader2 className="animate-spin" /> : "Continue"}
                                {!isLoading && <ArrowRight className="ml-2 h-5 w-5" />}
                            </Button>

                            {/* Hide registration link on iOS for App Store compliance */}
                            {!(typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))) && (
                                <div className="text-center pt-4">
                                    <p className="text-gray-500 text-sm font-medium">
                                        New here?{" "}
                                        <Link 
                                            to="/provider/register" 
                                            onClick={() => localStorage.removeItem('swm-provider-registration')}
                                            className="text-violet-600 font-black hover:underline"
                                        >
                                            Register as Partner
                                        </Link>
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-between gap-1.5 sm:gap-3 w-full max-w-[320px] mx-auto">
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        id={`otp-${i}`}
                                        type="tel"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        autoFocus={i === 0}
                                        onChange={(e) => handleOtpChange(i, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                        className="flex-1 aspect-square min-w-0 max-w-[48px] h-auto text-center text-lg sm:text-xl font-bold bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-violet-600 focus:bg-white focus:ring-0 outline-none transition-all shadow-sm p-0 leading-none"
                                    />
                                ))}
                            </div>

                            <div className="space-y-4">
                                {error && <p className="text-[12px] font-bold text-red-600 text-center">{error}</p>}
                                <Button
                                    className="w-full h-14 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-lg shadow-lg shadow-violet-200"
                                    onClick={handleVerifyOtp}
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : "Verify & Login"}
                                </Button>

                                <div className="text-center">
                                    {resendTimer > 0 ? (
                                        <p className="text-gray-400 text-sm font-medium">
                                            Resend OTP in <span className="text-gray-900 font-bold">0:{resendTimer.toString().padStart(2, '0')}</span>
                                        </p>
                                    ) : (
                                        <button 
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const res = await requestOtp(phone);
                                                    setOtpDeliveryMode(res?.deliveryMode || "sms");
                                                    setTimer(300);
                                                    setResendTimer(60);
                                                    toast.success("OTP sent successfully!");
                                                } catch (err) {
                                                    console.error("[ProviderLogin] resend-otp error", err);
                                                    toast.error(err.message || "Failed to resend OTP");
                                                }
                                            }}
                                            className="text-violet-600 text-sm font-black hover:underline"
                                        >
                                            Resend OTP
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Support button floating at bottom */}
            <div className="fixed bottom-8 left-8 hidden sm:block">
                <button className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                    <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
                    Help & Support
                </button>
            </div>
        </div>
    );
}
