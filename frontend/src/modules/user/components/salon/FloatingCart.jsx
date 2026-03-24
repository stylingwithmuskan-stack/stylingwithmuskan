import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ChevronRight, Sparkles } from "lucide-react";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";

const FloatingCart = () => {
    const { totalItems, totalPrice, setIsCartOpen, isCartOpen, getGroupedItems, setActiveCheckoutType, isFloatingSummaryOpen, setIsFloatingSummaryOpen } = useCart();
    const { isLoggedIn } = useAuth();

    // Only show if user is logged in AND has items AND cart is not already open AND summary state is open
    if (totalItems === 0 || !isLoggedIn || isCartOpen || !isFloatingSummaryOpen) return null;

    const handleOpenCart = (type = null) => {
        setActiveCheckoutType(type);
        setIsCartOpen(true);
        setIsFloatingSummaryOpen(false);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-20 lg:bottom-24 left-4 right-4 z-[45] max-w-xs sm:max-w-md mx-auto pointer-events-none"
            >
                <div
                    className="w-full bg-gradient-to-r from-primary to-primary/80 p-3 rounded-2xl shadow-2xl shadow-primary/30 flex flex-col gap-2 group overflow-hidden relative pointer-events-auto"
                >
                    {/* Shine Effect */}
                    <motion.div
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-1/2 -skew-x-12"
                    />

                    <div className="flex flex-col w-full gap-2 relative z-10">
                        {Object.values(getGroupedItems()).map((group) => (
                            <button
                                key={group.id}
                                onClick={() => handleOpenCart(group.id)}
                                className="flex items-center justify-between bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/20 hover:bg-white/20 transition-all text-left w-full"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm">
                                        {group.id === 'skin' ? '🧴' : group.id === 'hair' ? '💇' : group.id === 'makeup' ? '💄' : '✨'}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white text-[10px] font-bold truncate max-w-[120px]">{group.label}</p>
                                        <p className="text-white/60 text-[8px] font-bold uppercase">{group.itemCount} Items</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="text-white text-xs font-black">₹{group.subtotal.toLocaleString()}</p>
                                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                        <ChevronRight className="w-3 h-3 text-white" />
                                    </div>
                                </div>
                            </button>
                        ))}

                        <button
                            onClick={() => handleOpenCart(null)}
                            className="flex items-center justify-between mt-1 px-1 hover:bg-white/10 rounded-xl transition-all w-full text-left py-1"
                        >
                            <div className="flex flex-col">
                                <p className="text-white/60 text-[8px] font-bold uppercase tracking-tighter">Grand Total</p>
                                <p className="text-white text-base font-black">₹{totalPrice.toLocaleString()}</p>
                            </div>
                        </button>
                    </div>

                    <Sparkles className="absolute -top-1 right-20 w-4 h-4 text-white/40 animate-pulse" />
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default FloatingCart;
