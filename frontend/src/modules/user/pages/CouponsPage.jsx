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

    useEffect(() => {
        let cancelled = false;
        api.userCoupons().then(({ coupons }) => {
            if (cancelled) return;
            setCoupons(coupons || []);
        }).catch(() => setCoupons([]));
        return () => { cancelled = true; };
    }, []);

    const handleApply = (code) => {
        if (checkoutType) {
            navigate(`/booking/summary?type=${checkoutType}&coupon=${code}`);
        } else {
            navigate(-1);
        }
    };

    const handleSearchApply = () => {
        if (searchCode.trim()) {
            handleApply(searchCode.trim().toUpperCase());
        }
    };

    return (
        <div className="min-h-screen bg-background pb-8">
            {/* Header */}
            <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>Coupons & Offers</h1>
            </div>

            <div className="px-4 max-w-2xl mx-auto mt-6 space-y-6">
                {/* Search / Entry */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Have a coupon code? Enter here"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        className="w-full h-14 pl-12 pr-24 rounded-2xl bg-accent border-none text-base focus:ring-2 focus:ring-primary/20 transition-all font-medium uppercase placeholder:normal-case shadow-sm"
                    />
                    <button
                        onClick={handleSearchApply}
                        className="absolute right-3 top-2 bottom-2 px-4 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all"
                    >
                        APPLY
                    </button>
                </div>

                {/* Coupon List */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold ml-1">Available Coupons</h3>

                    {coupons.length === 0 ? (
                        <div className="py-10 text-center">
                            <Ticket className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-muted-foreground font-medium">No coupons available at the moment.</p>
                        </div>
                    ) : (
                        coupons.map((coupon, i) => (
                            <motion.div
                                key={coupon._id || coupon.id || i}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="relative overflow-hidden glass-strong rounded-[24px] border border-border/50 p-5 shadow-sm bg-white"
                            >
                                {/* Left Notch */}
                                <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border/50" />
                                {/* Right Notch */}
                                <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border/50" />

                                {/* Dashed Line */}
                                <div className="absolute inset-y-0 left-20 border-l border-dashed border-border/50" />

                                <div className="flex items-center gap-6">
                                    <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 text-primary">
                                        <Ticket className="w-10 h-10 rotate-45 opacity-20 absolute" />
                                        <span className="text-xl font-black rotate-[-45deg]">{coupon.code[0]}</span>
                                    </div>
                                    <div className="flex-1 pl-4">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-base font-bold text-primary">{coupon.code}</h4>
                                            {coupon.firstTimeOnly && (
                                                <span className="text-[9px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded uppercase">New User</span>
                                            )}
                                        </div>
                                        <p className="text-sm font-bold mt-0.5">
                                            {coupon.discountType === "percentage" ? `Flat ${coupon.discountValue}% OFF` : `Flat ₹${coupon.discountValue} OFF`}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                                            {coupon.minOrder > 0 ? `Valid on orders above ₹${coupon.minOrder}.` : "Valid on all orders."}
                                            {coupon.maxDiscount > 0 && ` Max discount up to ₹${coupon.maxDiscount}.`}
                                        </p>

                                        <div className="flex items-center justify-between mt-4">
                                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                                {coupon.expiryDate ? `Expires: ${new Date(coupon.expiryDate).toLocaleDateString()}` : "Valid Now"}
                                            </span>

                                            <button
                                                onClick={() => handleApply(coupon.code)}
                                                className="text-[10px] font-bold text-white bg-primary px-4 py-1.5 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all"
                                            >
                                                TAP TO APPLY
                                            </button>
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
