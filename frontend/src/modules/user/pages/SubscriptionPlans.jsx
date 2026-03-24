import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { ArrowLeft, CheckCircle2, Zap, Shield, Sparkles, AlertCircle, Crown, Star, XCircle, Gift, Clock, BadgeCheck, ChevronRight } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { useToast } from "@/modules/user/components/ui/use-toast";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";

const SubscriptionPlans = () => {
    const navigate = useNavigate();
    const { gender, darkMode } = useGenderTheme();
    const { user, setUser, isLoggedIn, setIsLoginModalOpen } = useAuth();
    const { toast } = useToast();
    const [selectedPlan, setSelectedPlan] = useState("annual");
    const [isLoading, setIsLoading] = useState(false);
    const [showComparison, setShowComparison] = useState(false);

    const plans = [
        {
            id: "quarterly",
            title: "Quarterly",
            price: 299,
            perMonth: 100,
            duration: "3 Months",
            months: 3,
            savings: "",
            recommended: false,
            badge: ""
        },
        {
            id: "annual",
            title: "Annual",
            price: 899,
            perMonth: 75,
            duration: "12 Months",
            months: 12,
            savings: "Save ₹289",
            recommended: true,
            badge: "Best Value"
        }
    ];

    const benefits = [
        { icon: Shield, title: "Zero Convenience Fees", desc: "No extra charges on any bookings — saves ₹49-99 each time", color: "bg-emerald-50 text-emerald-600" },
        { icon: Sparkles, title: "Flat 10-15% Off Every Booking", desc: "Instant discount on all services above ₹499 cart value", color: "bg-violet-50 text-violet-600" },
        { icon: Zap, title: "Priority Booking Slots", desc: "First preference during weekends, Diwali, Eid & peak seasons", color: "bg-amber-50 text-amber-600" },
        { icon: XCircle, title: "Free Cancellation", desc: "Cancel up to 1 hour before with zero penalty — standard users lose advance", color: "bg-rose-50 text-rose-600" },
        { icon: Crown, title: "Elite Beauticians", desc: "Exclusive access to top-rated professionals who only service Plus members", color: "bg-indigo-50 text-indigo-600" },
        { icon: Gift, title: "Birthday & Anniversary Rewards", desc: "Bonus wallet credits and surprise discounts on your special days", color: "bg-pink-50 text-pink-600" }
    ];

    const comparisonData = [
        { feature: "Service Discount", free: "None", plus: "10-15% Off" },
        { feature: "Convenience Fee", free: "₹49-99", plus: "₹0 (Free)" },
        { feature: "Slot Priority", free: "Standard", plus: "VIP First" },
        { feature: "Cancellation", free: "Charges Apply", plus: "Free (1hr before)" },
        { feature: "Beautician Tier", free: "Regular", plus: "Elite + Regular" },
        { feature: "Support", free: "Email", plus: "Priority Chat" },
    ];

    const handleSubscribe = () => {
        if (!isLoggedIn) {
            setIsLoginModalOpen(true);
            return;
        }

        setIsLoading(true);

        const selectedPlanData = plans.find(p => p.id === selectedPlan);
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + selectedPlanData.months);

        // Simulate payment and API call
        setTimeout(() => {
            const updatedUser = {
                ...user,
                isPlusMember: true,
                plusExpiry: expiryDate.toISOString(),
                plusPlan: selectedPlan
            };

            setUser(updatedUser);

            toast({
                title: "Welcome to SWM Plus! 🎉",
                description: `Your ${selectedPlanData.duration} subscription is now active.`,
                className: "bg-green-50 border-green-200 text-green-900"
            });

            setIsLoading(false);
            navigate("/profile");
        }, 1500);
    };

    const isPlusMember = user?.isPlusMember;
    const daysLeft = isPlusMember && user?.plusExpiry ? Math.ceil((new Date(user.plusExpiry) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

    return (
        <div className="min-h-screen bg-background text-foreground pb-32 transition-colors duration-300">
            {/* Header */}
            <div className={`sticky top-0 z-30 backdrop-blur-xl border-b border-border/50 px-4 py-4 flex items-center gap-3 ${darkMode ? 'bg-background/80' : 'bg-white/80'}`}>
                <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-foreground hover:bg-accent/80 transition-colors shadow-sm">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-black flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        SWM Plus
                    </h1>
                </div>
                {isPlusMember && (
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-amber-200">
                        Active
                    </span>
                )}
            </div>

            <main className="max-w-lg mx-auto px-4 pt-2">
                {/* Active Member Status */}
                {isPlusMember && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-accent/30 border border-amber-400/20 rounded-2xl p-5 mb-6 mt-4 relative overflow-hidden"
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                                <BadgeCheck className="w-7 h-7 text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-black text-amber-600 text-base">Active Member</h3>
                                <p className="text-sm text-foreground/60 mt-0.5">
                                    Expires <strong className="text-foreground/90">{new Date(user.plusExpiry).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                                </p>
                            </div>
                            <div className="text-center shrink-0 bg-white/30 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/40">
                                <p className="text-2xl font-black text-foreground">{daysLeft}</p>
                                <p className="text-[9px] font-bold text-foreground/50 uppercase tracking-widest">Days Left</p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Hero */}
                <div className="text-center pt-8 pb-10 relative">
                    <motion.div
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="w-24 h-24 bg-gradient-to-tr from-amber-300 via-amber-400 to-amber-500 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-2xl shadow-amber-500/30 rotate-6 relative"
                    >
                        <Zap className="w-12 h-12 text-white -rotate-6" />
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-card rounded-full flex items-center justify-center shadow-md">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        </div>
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-3xl font-black text-foreground leading-tight mb-3"
                    >
                        {isPlusMember ? "Your Plus Benefits" : <>Upgrade to<br />Premium Experience</>}
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-muted-foreground font-medium px-4 text-sm"
                    >
                        {isPlusMember
                            ? "Enjoy all your exclusive perks on every booking."
                            : "Regular salon-goers save ₹3,000+ per year. Get flat 10-15% off, zero fees, and VIP treatment."}
                    </motion.p>
                </div>

                {/* Benefits */}
                <div className="space-y-3 mb-10">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1 mb-4">What's Included</h3>
                    {benefits.map((benefit, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + i * 0.06 }}
                            className="bg-card backdrop-blur-sm p-4 rounded-2xl border border-border/50 flex items-center gap-4 hover:bg-accent/20 transition-all shadow-sm"
                        >
                            <div className={`w-11 h-11 rounded-xl ${benefit.color} flex items-center justify-center shrink-0`}>
                                <benefit.icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-bold text-foreground text-sm">{benefit.title}</h4>
                                <p className="text-[11px] text-muted-foreground font-medium mt-0.5 leading-relaxed">{benefit.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Comparison Toggle */}
                <button
                    onClick={() => setShowComparison(!showComparison)}
                    className="w-full text-center py-3 text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider mb-4"
                >
                    {showComparison ? "Hide Comparison" : "Compare Free vs Plus →"}
                </button>

                {/* Comparison Table */}
                <AnimatePresence>
                    {showComparison && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-8"
                        >
                            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
                                <div className="grid grid-cols-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground p-3 border-b border-border/30 bg-accent/30">
                                    <span>Feature</span>
                                    <span className="text-center">Free</span>
                                    <span className="text-center text-primary">Plus</span>
                                </div>
                                {comparisonData.map((row, i) => (
                                    <div key={i} className={`grid grid-cols-3 text-xs p-3 ${i < comparisonData.length - 1 ? 'border-b border-border/20' : ''}`}>
                                        <span className="font-bold text-foreground/80">{row.feature}</span>
                                        <span className="text-center text-muted-foreground">{row.free}</span>
                                        <span className="text-center text-primary font-bold">{row.plus}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Plans (hide if already member) */}
                {!isPlusMember && (
                    <>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1 mb-4 mt-6">Choose Your Plan</h3>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {plans.map((plan) => (
                                <motion.div
                                    key={plan.id}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setSelectedPlan(plan.id)}
                                    className={`relative cursor-pointer rounded-2xl p-4 pb-5 transition-all duration-300 border-2 ${
                                        selectedPlan === plan.id
                                            ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5'
                                            : 'bg-card border-border/50 hover:border-primary/30'
                                    }`}
                                >
                                    {plan.badge && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-950 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-amber-400/20 whitespace-nowrap">
                                            {plan.badge}
                                        </div>
                                    )}
                                    <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 mt-1 ${selectedPlan === plan.id ? 'text-primary' : 'text-muted-foreground'}`}>
                                        {plan.duration}
                                    </h4>
                                    <div className={`text-3xl font-black mb-0.5 ${selectedPlan === plan.id ? 'text-foreground' : 'text-foreground/60'}`}>
                                        ₹{plan.price}
                                    </div>
                                    <div className={`text-[10px] font-bold ${selectedPlan === plan.id ? 'text-foreground/50' : 'text-muted-foreground/40'}`}>
                                        ₹{plan.perMonth}/month
                                    </div>
                                    <div className={`text-[10px] font-bold h-4 mt-1 ${selectedPlan === plan.id ? 'text-emerald-600' : 'text-emerald-600/50'}`}>
                                        {plan.savings}
                                    </div>

                                    {selectedPlan === plan.id && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute top-3 right-3"
                                        >
                                            <CheckCircle2 className="w-5 h-5 text-primary" />
                                        </motion.div>
                                    )}
                                </motion.div>
                            ))}
                        </div>

                        {/* Saving calculator */}
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">Quick Math</span>
                            </div>
                            <p className="text-[11px] text-foreground/60 font-medium leading-relaxed">
                                If you book just <strong className="text-foreground/80">2 services per month</strong> at avg ₹1,500, you save <strong className="text-emerald-600">~₹300/month</strong> in discounts + fees.
                                That's <strong className="text-emerald-600">₹3,600/year</strong> savings on a ₹899 membership — <strong className="text-foreground/80">4x return</strong>!
                            </p>
                        </div>
                    </>
                )}

                {/* Info */}
                <div className="bg-accent/50 border border-border/30 rounded-2xl p-4 flex gap-3 shadow-sm">
                    <AlertCircle className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground/60 font-medium leading-relaxed">
                        Subscription is auto-renewable. You can cancel anytime from your profile settings. By continuing, you agree to our Terms of Service.
                    </p>
                </div>
            </main>

            {/* Bottom Action */}
            <div className={`fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t border-border/50 p-4 z-40 transition-colors ${darkMode ? 'bg-background/90' : 'bg-white/90'}`}>
                <div className="max-w-lg mx-auto">
                    {isPlusMember ? (
                        <Button
                            onClick={() => navigate("/profile")}
                            className="w-full h-14 rounded-2xl bg-accent text-foreground font-bold text-base hover:bg-accent/80 border border-border/50"
                        >
                            Back to Profile
                        </Button>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col shrink-0">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                                <span className="text-xl font-black text-foreground leading-none">
                                    ₹{plans.find(p => p.id === selectedPlan)?.price}
                                </span>
                            </div>
                            <Button
                                onClick={handleSubscribe}
                                disabled={isLoading}
                                className="flex-1 h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-base shadow-xl shadow-primary/20 gap-2 border-none"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Join SWM Plus
                                        <Zap className="w-5 h-5" />
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SubscriptionPlans;
