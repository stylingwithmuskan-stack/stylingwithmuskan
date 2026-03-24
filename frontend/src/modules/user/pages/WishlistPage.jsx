import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trash2, ShoppingBag, Heart, ShoppingCart } from "lucide-react";
import { useWishlist } from "@/modules/user/contexts/WishlistContext";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";

const WishlistPage = () => {
    const navigate = useNavigate();
    const { gender } = useGenderTheme();
    const { wishlistItems, removeFromWishlist, clearWishlist } = useWishlist();
    const { addToCart } = useCart();

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>My Wishlist</h1>
                </div>
                {wishlistItems.length > 0 && (
                    <button onClick={clearWishlist} className="text-[10px] font-bold text-destructive uppercase tracking-widest hover:underline">
                        Clear All
                    </button>
                )}
            </div>

            <div className="p-4 max-w-2xl mx-auto">
                <AnimatePresence mode="popLayout">
                    {wishlistItems.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {wishlistItems.map((item, idx) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="glass-strong rounded-2xl p-3 border border-border/50 flex gap-4 relative group"
                                >
                                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-accent flex-shrink-0">
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                        <div>
                                            <h3 className="font-bold text-sm truncate">{item.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="font-bold text-primary">₹{item.price}</span>
                                                {item.originalPrice && (
                                                    <span className="text-[10px] text-muted-foreground line-through">₹{item.originalPrice}</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{item.description}</p>
                                        </div>

                                        <div className="flex items-center gap-2 mt-2">
                                            <button
                                                onClick={() => {
                                                    addToCart(item);
                                                    removeFromWishlist(item.id);
                                                }}
                                                className="flex-1 h-9 bg-primary text-primary-foreground rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all"
                                            >
                                                <ShoppingCart className="w-3.5 h-3.5" /> Move to Cart
                                            </button>
                                            <button
                                                onClick={() => removeFromWishlist(item.id)}
                                                className="w-9 h-9 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive flex items-center justify-center hover:bg-destructive/10 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="py-20 text-center"
                        >
                            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 relative">
                                <Heart className="w-10 h-10 text-muted-foreground/30" />
                                <div className="absolute top-0 right-0 w-6 h-6 bg-primary/10 rounded-full animate-ping" />
                            </div>
                            <h2 className="text-xl font-bold mb-2">Feeling Empty?</h2>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8">
                                Give your favorite services some love. Save them here to book them later!
                            </p>
                            <button
                                onClick={() => navigate("/home")}
                                className="px-10 py-3 bg-primary text-primary-foreground rounded-full font-bold shadow-xl shadow-primary/20 active:scale-95 transition-all uppercase tracking-widest text-xs"
                            >
                                Discover Services
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default WishlistPage;
