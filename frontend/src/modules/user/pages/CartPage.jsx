import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ChevronRight, Sparkles, ArrowLeft, Trash2 } from "lucide-react";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import ExpressCheckout from "@/modules/user/components/salon/ExpressCheckout";

const CartPage = () => {
    const navigate = useNavigate();
    const { totalItems, totalPrice, setIsCartOpen, getGroupedItems, setActiveCheckoutType, clearCart } = useCart();
    const { isLoggedIn } = useAuth();
    const { serviceTypes } = useUserModuleData();

    useEffect(() => {
        if (!isLoggedIn) {
            navigate("/home");
        }
    }, [isLoggedIn, navigate]);

    const handleOpenCart = (type = null) => {
        setActiveCheckoutType(type);
        setIsCartOpen(true);
    };

    if (totalItems === 0) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <header className="glass-strong border-b border-border z-50 sticky top-0">
                    <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                                <ShoppingBag className="w-5 h-5 text-primary" />
                                My Cart
                            </h1>
                        </div>
                    </div>
                </header>
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center mb-4">
                        <ShoppingBag className="w-10 h-10 text-muted-foreground opacity-50" />
                    </div>
                    <h2 className="text-lg font-bold">Your cart is empty</h2>
                    <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-xs">
                        Looks like you haven't added any services to your cart yet.
                    </p>
                    <button
                        onClick={() => navigate("/explore/facial")}
                        className="bg-primary text-white font-bold py-3 px-8 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95"
                    >
                        Explore Services
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col relative pb-32">
            <header className="glass-strong border-b border-border z-50 sticky top-0">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5 text-primary" />
                            My Cart
                        </h1>
                    </div>
                    <button onClick={clearCart} className="text-red-500 flex items-center gap-1.5 text-xs font-bold hover:bg-red-50 px-2 py-1.5 rounded-lg transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear
                    </button>
                </div>
            </header>

            <main className="flex-1 p-4 lg:p-6 lg:max-w-2xl lg:mx-auto w-full">
                <h2 className="text-base font-black uppercase tracking-widest text-muted-foreground mb-4">
                    Items grouped by service
                </h2>
                <div className="flex flex-col gap-4">
                    {Object.values(getGroupedItems()).map((group, idx) => {
                        const serviceTypeData = serviceTypes.find(t => t.id === group.id);
                        const categoryImage = serviceTypeData?.image || group.image;

                        return (
                            <motion.button
                                key={group.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                onClick={() => handleOpenCart(group.id)}
                                className="bg-white rounded-2xl p-4 shadow-sm border border-border/50 hover:shadow-md hover:border-primary/30 transition-all text-left flex flex-col gap-3 group/cartItem"
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-accent/50 flex items-center justify-center text-xl overflow-hidden border border-border/50">
                                            {categoryImage ? (
                                                <img src={categoryImage} alt={group.label} className="w-full h-full object-cover" />
                                            ) : (
                                                group.id === 'skin' ? '🧴' : group.id === 'hair' ? '💇' : group.id === 'makeup' ? '💄' : '✨'
                                            )}
                                        </div>
                                        <div>
                                        <h3 className="text-sm font-black">{group.label}</h3>
                                        <p className="text-xs text-muted-foreground font-medium">{group.itemCount} Items</p>
                                    </div>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    <span className="text-base font-black text-primary">₹{group.subtotal.toLocaleString()}</span>
                                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center group-hover/cartItem:bg-primary group-hover/cartItem:text-white transition-colors">
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </motion.button>
                        );
                    })}
                </div>
            </main>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] lg:max-w-2xl lg:mx-auto lg:rounded-t-3xl">
                <div className="flex items-center justify-between mb-4 px-2">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total Price</span>
                    <span className="text-xl font-black text-primary">₹{totalPrice.toLocaleString()}</span>
                </div>
                <button
                    onClick={() => handleOpenCart(null)}
                    className="w-full bg-primary text-white font-black text-sm uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    Checkout all items
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            
            <ExpressCheckout />
        </div>
    );
};

export default CartPage;
