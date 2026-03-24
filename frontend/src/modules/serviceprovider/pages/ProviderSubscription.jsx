import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Sparkles, Zap, CheckCircle2, Crown, BadgeCheck, AlertCircle, TrendingUp, Clock, CreditCard } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { useProviderAuth } from "@/modules/serviceprovider/contexts/ProviderAuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function ProviderSubscription() {
    const { provider, upgradeToPro } = useProviderAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [showComparison, setShowComparison] = useState(false);

    const isPro = provider?.isPro;
    const daysLeft = isPro && provider?.proExpiry ? Math.ceil((new Date(provider.proExpiry) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

    const benefits = [
        { icon: TrendingUp, title: "5% Commission Rate", desc: "Keep more of your earnings. Standard providers pay 15-20%, you pay only 5%.", color: "bg-emerald-50 text-emerald-600" },
        { icon: Clock, title: "First-Dibs on Job Leads", desc: "Get notifications for new bookings in your area 5 minutes before everyone else.", color: "bg-amber-50 text-amber-600" },
        { icon: BadgeCheck, title: "Top Rated SWM Pro Badge", desc: "A premium golden badge on your profile visible to customers, boosting your selection rate.", color: "bg-blue-50 text-blue-600" },
        { icon: Sparkles, title: "Boosted Visibility", desc: "Appear at the top of search results when customers manually browse stylists.", color: "bg-violet-50 text-violet-600" },
        { icon: Crown, title: "Free Premium Training", desc: "Access high-end Masterclasses (e.g., Advanced Bridal Makeup) in the Training Hub for free.", color: "bg-pink-50 text-pink-600" }
    ];

    const comparisonData = [
        { feature: "Commission Rate", standard: "15% - 20%", pro: "5% Flat" },
        { feature: "Lead Access", standard: "Standard Delay", pro: "5 Mins Early" },
        { feature: "Search Ranking", standard: "Based on Rating", pro: "Priority Top Slot" },
        { feature: "Profile Badge", standard: "None", pro: "Golden Pro Badge" },
        { feature: "Premium Training", standard: "Paid Extra", pro: "100% Free" },
    ];

    const handleUpgrade = () => {
        setIsLoading(true);
        setTimeout(() => {
            upgradeToPro();
            toast.success("Welcome to SWM Pro Partner! Your benefits are now active.");
            setIsLoading(false);
        }, 1500);
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto pb-20 bg-background text-foreground transition-colors">
            <div className="flex items-center gap-3 px-4 md:px-0 pt-4 md:pt-0">
                <button onClick={() => navigate(-1)} className="md:hidden w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                    <span className="sr-only">Back</span>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                </button>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                        <Crown className="w-6 h-6 lg:w-8 lg:h-8 text-amber-500" /> SWM Pro Partner
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Supercharge your beauty career with premium benefits.</p>
                </div>
            </div>

            {isPro && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-amber-400 to-amber-600 rounded-[24px] p-6 text-white shadow-xl shadow-amber-500/20 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden mx-4 md:mx-0"
                >
                    <div className="absolute -right-10 -top-10 opacity-20 pointer-events-none">
                        <Crown className="w-48 h-48" />
                    </div>
                    
                    <div className="relative z-10 flex items-center gap-5 w-full md:w-auto">
                        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shrink-0 shadow-inner">
                            <BadgeCheck className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <span className="bg-white text-amber-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm mb-2 inline-block">
                                Active Subscription
                            </span>
                            <h2 className="text-2xl font-black leading-none text-white">Pro Partner</h2>
                            <p className="text-amber-100 font-medium text-sm mt-1">Enjoying 5% commission & priority leads</p>
                        </div>
                    </div>
                    
                    <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center shrink-0 w-full md:w-auto min-w-[120px]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-200 mb-1">Renews In</p>
                        <p className="text-3xl font-black leading-none text-white">{daysLeft}</p>
                        <p className="text-xs font-bold text-amber-100 mt-1">Days</p>
                    </div>
                </motion.div>
            )}

            {!isPro && (
                <div className="text-center py-6 px-4">
                    <motion.div
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="w-20 h-20 bg-gradient-to-tr from-amber-300 to-amber-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-amber-500/30 rotate-3"
                    >
                        <Crown className="w-10 h-10 text-white -rotate-3" />
                    </motion.div>
                    <h2 className="text-3xl font-black text-foreground leading-tight mb-2">Maximize Your<br/>Earnings with Pro</h2>
                    <p className="text-muted-foreground font-medium max-w-sm mx-auto">Stop paying high commissions. Get priority leads and keep more of what you earn.</p>
                </div>
            )}

            <div className="px-4 md:px-0 grid md:grid-cols-2 gap-4 mb-4">
                {benefits.map((benefit, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-card p-4 rounded-2xl border border-border shadow-sm flex items-start gap-4 transition-all hover:border-amber-200 hover:shadow-md"
                    >
                        <div className={`w-12 h-12 rounded-xl ${benefit.color} flex items-center justify-center shrink-0`}>
                            <benefit.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-card-foreground">{benefit.title}</h4>
                            <p className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed">{benefit.desc}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="px-4 md:px-0 mb-6">
                <button
                    onClick={() => setShowComparison(!showComparison)}
                    className="w-full text-center py-3 text-sm font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
                >
                    {showComparison ? "Hide Comparison" : "Compare Standard vs Pro →"}
                </button>
                <AnimatePresence>
                    {showComparison && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mt-2"
                        >
                            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                                <div className="grid grid-cols-3 text-xs font-black uppercase tracking-widest text-muted-foreground p-4 border-b border-border bg-accent/30">
                                    <span>Feature</span>
                                    <span className="text-center">Standard</span>
                                    <span className="text-center text-amber-600">Pro Partner</span>
                                </div>
                                {comparisonData.map((row, i) => (
                                    <div key={i} className={`grid grid-cols-3 text-sm p-4 ${i < comparisonData.length - 1 ? 'border-b border-border/10' : ''}`}>
                                        <span className="font-bold text-foreground/80">{row.feature}</span>
                                        <span className="text-center text-muted-foreground">{row.standard}</span>
                                        <span className="text-center text-amber-600 font-bold">{row.pro}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Savings Calculator / Logic Box */}
            {!isPro && (
                <div className="mx-4 md:mx-0 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                        <span className="text-sm font-black text-emerald-800 uppercase tracking-widest">Why It Makes Sense</span>
                    </div>
                    <p className="text-sm text-emerald-700 font-medium leading-relaxed">
                        If you do just ₹10,000 worth of services in a month:<br/>
                        • Standard (15% fee) = You pay <strong>₹1,500</strong><br/>
                        • Pro Partner (5% fee) = You pay ₹500 + ₹999 subs = <strong>₹1,499</strong>
                    </p>
                    <div className="mt-3 pt-3 border-t border-emerald-200/50">
                        <p className="text-sm text-emerald-800 font-bold">
                            Do more than ₹10k/month? <span className="text-emerald-600 font-black">Everything extra is purely 10% more profit in your pocket! 💸</span>
                        </p>
                    </div>
                </div>
            )}

            {!isPro ? (
                <div className="mx-4 md:mx-0 sticky bottom-4 z-10 bg-card p-4 rounded-3xl border border-border shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left w-full sm:w-auto">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Monthly Subscription</p>
                        <p className="text-3xl font-black text-foreground leading-none mt-1">₹999<span className="text-base text-muted-foreground font-bold">/mo</span></p>
                    </div>
                    <Button 
                        onClick={handleUpgrade}
                        disabled={isLoading}
                        className="w-full sm:w-auto h-14 px-8 rounded-2xl bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-lg shadow-lg shadow-amber-400/30 gap-2 border-none"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-amber-950 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                Upgrade to Pro <Crown className="w-5 h-5" />
                            </>
                        )}
                    </Button>
                </div>
            ) : (
                <div className="px-4 md:px-0 flex items-center justify-center pt-4">
                   <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                        <Shield className="w-4 h-4" /> Secure auto-renewal active. Manage billing in Account settings.
                   </div>
                </div>
            )}
        </div>
    );
}
