import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, Zap, ShieldCheck, PieChart, Users, PhoneCall, Image } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { toast } from "sonner";

export default function VenderSubscription() {
    const { vendor } = useVenderAuth();
    const [plan, setPlan] = useState(null);

    useEffect(() => {
        // Use dynamically set subscription or default to active 6-month trial
        if (vendor?.subscription) {
            setPlan(vendor.subscription);
        } else {
            const sixMonthsFromNow = new Date();
            sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
            
            setPlan({
                name: "SWM City Manager Enterprise",
                status: "active",
                isTrial: true,
                expiresAt: sixMonthsFromNow.toISOString(),
                fee: 4999
            });
        }
    }, [vendor]);

const benefits = [
    { icon: PieChart, title: "Advanced Analytics", desc: "Deep dive into local demand and provider metrics." },
    { icon: Users, title: "Sub-Accounts", desc: "Create admin accounts for local support staff." },
    { icon: PhoneCall, title: "Priority Support", desc: "Direct WhatsApp/Call line to Central Admin." },
    { icon: Image, title: "Marketing Credits", desc: "₹1,000 monthly credits for homepage banners." }
];

const SubscriptionSkeleton = () => (
    <div className="flex flex-col gap-6 w-full animate-pulse px-4 md:px-0">
        {/* Banner Skeleton */}
        <div className="h-[200px] rounded-[32px] bg-slate-300/40 shadow-inner"></div>
        
        <div className="grid lg:grid-cols-3 gap-6">
            {/* Plan Overview Skeleton */}
            <div className="lg:col-span-1 h-[420px] rounded-[24px] bg-slate-200/30 border border-slate-300/20 p-6 flex flex-col gap-4">
                <div className="h-4 w-1/3 bg-slate-300/50 rounded"></div>
                <div className="h-10 w-2/3 bg-slate-300/50 rounded mt-2"></div>
                <div className="h-8 w-1/2 bg-slate-300/50 rounded"></div>
                <div className="mt-auto space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-300/40 rounded-xl w-full"></div>)}
                    <div className="h-12 bg-slate-300/60 rounded-xl w-full mt-4"></div>
                </div>
            </div>
            
            {/* Benefits Skeleton Area */}
            <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-[100px] rounded-[24px] bg-slate-200/20 border border-slate-300/10 p-5 flex gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-300/50 shrink-0"></div>
                        <div className="flex-1 space-y-3">
                            <div className="h-4 w-1/2 bg-slate-300/50 rounded"></div>
                            <div className="h-3 w-full bg-slate-300/50 rounded"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default function VenderSubscription() {
    const { vendor } = useVenderAuth();
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (vendor) {
            // Artificial delay to prevent flickering and ensure smooth transition
            const timer = setTimeout(() => {
                if (vendor.subscription) {
                    setPlan(vendor.subscription);
                } else {
                    const sixMonthsFromNow = new Date();
                    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
                    
                    setPlan({
                        name: "SWM City Manager Enterprise",
                        status: "active",
                        isTrial: true,
                        expiresAt: sixMonthsFromNow.toISOString(),
                        fee: 4999
                    });
                }
                setLoading(false);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [vendor]);

    const daysLeft = plan ? Math.ceil((new Date(plan.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

    return (
        <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto pt-4 md:pt-0 pb-16 bg-background text-foreground transition-colors">
            {/* Header always shows immediately */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                    <CreditCard className="h-6 w-6 lg:h-8 lg:w-8 text-primary" /> Subscription Plan
                </h1>
                <p className="text-sm text-muted-foreground font-medium mt-1">Manage your platform access and billing</p>
            </div>

            {loading ? (
                <SubscriptionSkeleton />
            ) : (
                <>
                    {plan?.isTrial && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-[24px] p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden relative mx-4 md:mx-0"
                        >
                            {/* Background decoration */}
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                <Zap className="h-32 w-32" />
                            </div>
                            
                            <div className="relative z-10 w-full md:w-auto">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-white/30 backdrop-blur-md">
                                        Exclusive Offer
                                    </span>
                                    <span className="bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-amber-300 shadow-md">
                                        Active Free Trial
                                    </span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-none mb-1">
                                    6 Months Free Access
                                </h2>
                                <p className="text-sm font-medium text-white/90 max-w-md mt-2">
                                    You are currently enjoying the full <strong>{plan.name}</strong> experience completely free. No credit card required.
                                </p>
                            </div>

                            <div className="relative z-10 bg-white text-emerald-950 rounded-2xl p-4 md:px-8 text-center shrink-0 w-full md:w-auto shadow-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Trial Ends In</p>
                                <p className="text-3xl md:text-4xl font-black leading-none">{daysLeft}</p>
                                <p className="text-xs font-bold text-muted-foreground mt-1">Days</p>
                            </div>
                        </motion.div>
                    )}

                    <div className="grid lg:grid-cols-3 gap-6 px-4 md:px-0">
                        {/* Current Plan Overview */}
                        <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <Card className="shadow-sm border-border/50 bg-card">
                                <CardHeader className="bg-accent/50 border-b border-border/50 pb-6 rounded-t-xl">
                                    <CardTitle className="text-base font-bold text-muted-foreground uppercase tracking-widest">Current Plan</CardTitle>
                                    <div className="mt-4">
                                        <h3 className="text-2xl font-black tracking-tight text-card-foreground leading-tight">
                                            {plan?.name}
                                        </h3>
                                        <div className="flex items-end gap-1 mt-3">
                                            <span className="text-3xl font-black">₹{plan?.fee.toLocaleString()}</span>
                                            <span className="text-sm font-bold text-muted-foreground mb-1">/month</span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex justify-between items-center py-2 border-b border-border/10">
                                        <span className="text-sm font-bold text-muted-foreground">Status</span>
                                        <span className="bg-green-100 text-green-700 text-xs font-black px-2 py-1 rounded uppercase tracking-wider">Active</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/10">
                                        <span className="text-sm font-bold text-muted-foreground">Billing Cycle</span>
                                        <span className="text-sm font-black text-foreground">Monthly</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/10">
                                        <span className="text-sm font-bold text-muted-foreground">Next Invoice</span>
                                        <span className="text-sm font-black text-foreground">{plan ? new Date(plan.expiresAt).toLocaleDateString() : ""}</span>
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-2 pb-6">
                                    <Button 
                                        className="w-full h-12 rounded-xl text-sm font-bold opacity-50 cursor-not-allowed" 
                                        disabled 
                                    >
                                        {plan?.isTrial ? "Auto-Renews after Trial" : "Manage Billing (Coming Soon)"}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>

                        {/* Benefits Sheet */}
                        <motion.div 
                            className="lg:col-span-2"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Card className="h-full shadow-sm border-primary/20 bg-primary/5">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ShieldCheck className="h-5 w-5 text-primary" /> Plan Included Benefits
                                    </CardTitle>
                                    <CardDescription>Everything you need to successfully manage your city</CardDescription>
                                </CardHeader>
                                <CardContent className="grid sm:grid-cols-2 gap-4">
                                    {benefits.map((b, i) => (
                                        <div key={i} className="flex gap-4 p-4 rounded-2xl bg-card border border-border/50 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
                                            <div className="h-10 w-10 shrink-0 bg-primary/10 rounded-xl flex items-center justify-center">
                                                <b.icon className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-card-foreground">{b.title}</h4>
                                                <p className="text-xs text-muted-foreground font-medium leading-snug mt-1">{b.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </>
            )}
            
            <div className="bg-accent/40 rounded-2xl p-6 border border-border/50 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-4 mx-4 md:mx-0">
                <div>
                    <h4 className="text-sm font-bold text-foreground">Have questions about billing?</h4>
                    <p className="text-xs text-muted-foreground mt-1">Our central finance team is here to help you.</p>
                </div>
                <Button variant="outline" className="rounded-xl font-bold bg-card text-primary hover:bg-primary/5 hover:text-primary transition-colors border-primary/20">
                    Contact Central Admin
                </Button>
            </div>
        </div>
    );
}
