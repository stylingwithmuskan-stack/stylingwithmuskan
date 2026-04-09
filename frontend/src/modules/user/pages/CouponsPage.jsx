import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { ArrowLeft, Ticket, Search, Info } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { api } from "@/modules/user/lib/api";

const CouponsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { gender } = useGenderTheme();
    const searchParams = new URLSearchParams(location.search);
    const checkoutType = searchParams.get('checkoutType');

    const [coupons, setCoupons] = useState([]);
    const [searchCode, setSearchCode] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        api.userCoupons().then(({ coupons }) => {
            if (cancelled) return;
            setCoupons(coupons || []);
            setIsLoading(false);
        }).catch(() => {
            if (!cancelled) setCoupons([]);
            setIsLoading(false);
        });
        return () => { cancelled = true; };
    }, []);

    const filteredCoupons = coupons.filter(c => 
        c.code.toUpperCase().includes(searchCode.toUpperCase())
    );

    const hasTypedSearch = searchCode.trim().length > 0;
    const isSearchEmpty = hasTypedSearch && filteredCoupons.length === 0;

    return (
        <div className="min-h-screen bg-background pb-8">
            {/* Header */}
            <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>Coupons & Offers</h1>
            </div>

            <div className="px-4 max-w-2xl mx-auto mt-6 space-y-6">
                {/* Search / Entry */}
                <div className="space-y-3">
                    <div className="relative group">
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${hasTypedSearch ? "text-primary" : "text-muted-foreground"}`} />
                        <form onSubmit={(e) => e.preventDefault()}>
                            <input
                                type="text"
                                placeholder="Enter coupon code..."
                                value={searchCode}
                                onChange={(e) => setSearchCode(e.target.value)}
                                className={`w-full h-14 pl-12 pr-6 rounded-2xl bg-accent border-2 transition-all font-bold uppercase placeholder:normal-case shadow-sm focus:outline-none ${
                                    isSearchEmpty ? "border-destructive/30 focus:border-destructive bg-destructive/5" : "border-transparent focus:border-primary/30"
                                }`}
                            />
                        </form>
                    </div>
                    {isSearchEmpty && (
                        <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2 text-destructive font-bold text-[11px] px-2"
                        >
                            <Info className="w-3.5 h-3.5" />
                            <span>This coupon code is not valid or has expired.</span>
                        </motion.div>
                    )}
                </div>

                {/* Coupon List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {hasTypedSearch ? "Search Results" : "Available Offers"}
                        </h3>
                        {!isLoading && (
                            <span className="text-[10px] font-bold text-muted-foreground/60">
                                {filteredCoupons.length} Found
                            </span>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="py-20 text-center">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="inline-block"
                            >
                                <Ticket className="w-12 h-12 text-primary/20 mx-auto" />
                            </motion.div>
                            <p className="text-muted-foreground/40 font-bold mt-4 text-xs uppercase tracking-widest">Searching Offers...</p>
                        </div>
                    ) : (hasTypedSearch ? filteredCoupons : coupons).length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-16 text-center glass-strong rounded-[32px] border border-dashed border-border/50"
                        >
                            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
                                <Ticket className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                            <p className="text-muted-foreground font-bold text-sm">
                                {hasTypedSearch ? "No matching coupons found" : "No coupons available right now"}
                            </p>
                            <p className="text-[11px] text-muted-foreground/60 mt-1 max-w-[200px] mx-auto">
                                Check back later for new deals and seasonal offers.
                            </p>
                        </motion.div>
                    ) : (
                        (hasTypedSearch ? filteredCoupons : coupons).map((coupon, i) => (
                            <motion.div
                                key={coupon._id || coupon.id || i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="relative overflow-hidden glass-strong rounded-[28px] border border-border/50 p-6 shadow-sm bg-white group hover:border-primary/30 transition-all"
                            >
                                {/* Notches with decorative edge */}
                                <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border/50 shadow-inner" />
                                <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border/50 shadow-inner" />

                                {/* Ticket Divider */}
                                <div className="absolute inset-y-6 left-[88px] border-l border-dashed border-border/50" />

                                <div className="flex items-center gap-8">
                                    <div className="w-16 h-16 flex items-center justify-center flex-shrink-0 relative">
                                        <div className="absolute inset-0 bg-primary/5 rounded-2xl rotate-45 group-hover:rotate-90 transition-transform duration-500" />
                                        <Ticket className="w-10 h-10 text-primary/10 absolute rotate-[-45deg]" />
                                        <span className="text-2xl font-black text-primary relative">{coupon.code[0]}</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-lg font-black tracking-tight text-foreground">{coupon.code}</h4>
                                            {coupon.firstTimeOnly && (
                                                <span className="text-[8px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">First order</span>
                                            )}
                                        </div>
                                        <p className="text-sm font-bold text-primary mt-0.5">
                                            {coupon.discountType === "percentage" ? `FLAT ${coupon.discountValue}% OFF` : `FLAT ₹${coupon.discountValue} OFF`}
                                        </p>
                                        <p className="text-[10px] font-medium text-muted-foreground mt-2 flex items-center gap-1.5 capitalize">
                                            <Info className="w-3 h-3" />
                                            {coupon.minOrder > 0 ? `Valid on orders above ₹${coupon.minOrder}` : "No minimum order value"}
                                            {coupon.maxDiscount > 0 && ` · Up to ₹${coupon.maxDiscount}`}
                                        </p>

                                        <div className="mt-4 flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                                            <span className="text-[10px] font-bold text-amber-600 tracking-wide uppercase">
                                                {coupon.expiryDate ? `Expires on ${new Date(coupon.expiryDate).toLocaleDateString()}` : "Active Offer"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default CouponsPage;
