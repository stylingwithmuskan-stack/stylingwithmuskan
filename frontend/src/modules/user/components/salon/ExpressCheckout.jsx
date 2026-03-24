import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, ShoppingCart, ArrowRight, Minus, Plus, Info, MapPin, Calendar, Clock, ChevronRight, ShieldCheck, CreditCard } from "lucide-react";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { Button } from "@/modules/user/components/ui/button";
import AddressModal from "./AddressModal";
import SlotSelectionModal from "./SlotSelectionModal";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { useNavigate } from "react-router-dom";

const ExpressCheckout = () => {
    const {
        cartItems, updateQuantity, clearCart, clearGroup, totalPrice, totalSavings,
        isCartOpen, setIsCartOpen, activeCheckoutType, setActiveCheckoutType,
        selectedSlot, getGroupedItems
    } = useCart();
    const { isLoggedIn, hasAddress, setIsLoginModalOpen, user } = useAuth();
    const { gender } = useGenderTheme();
    const { categories } = useUserModuleData(); // Access categories for dynamic advance payment
    const navigate = useNavigate();
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);

    if (!isCartOpen) return null;

    const groupedItems = getGroupedItems();
    const displayedGroups = activeCheckoutType && groupedItems[activeCheckoutType]
        ? { [activeCheckoutType]: groupedItems[activeCheckoutType] }
        : groupedItems;

    const displayedTotalPrice = Object.values(displayedGroups).reduce((acc, g) => acc + g.subtotal, 0);

    // Calculate dynamic advance payment based on category settings
    const calculateAdvancePayment = () => {
        let totalAdvance = 0;
        let itemsWithAdvance = [];

        cartItems.forEach(item => {
            // Check if item belongs to a displayed group
            if (activeCheckoutType && item.serviceType !== activeCheckoutType) return;

            const category = categories?.find(c => c.id === item.category);

            const advancePercent = category?.advancePercentage || 0;

            if (advancePercent > 0) {
                const itemAdvance = Math.round((item.price * item.quantity * advancePercent) / 100);
                totalAdvance += itemAdvance;
                itemsWithAdvance.push({
                    name: item.name,
                    percent: advancePercent,
                    advance: itemAdvance
                });
            }
        });

        return { totalAdvance, itemsWithAdvance, hasAdvance: totalAdvance > 0 };
    };

    const advanceInfo = calculateAdvancePayment();
    const isHighValue = advanceInfo.hasAdvance; // Re-use this flag for UI logic
    const advanceAmount = advanceInfo.totalAdvance;
    const remainingAmount = displayedTotalPrice - advanceAmount;

    const handleCheckout = (typeId = null) => {
        if (!isLoggedIn) {
            setIsLoginModalOpen(true);
            return;
        }

        if (!hasAddress) {
            setIsAddressModalOpen(true);
            return;
        }

        if (!selectedSlot) {
            setIsSlotModalOpen(true);
            return;
        }

        setIsCartOpen(false);
        const finalType = typeId || activeCheckoutType;

        // Pass advance info in state or use dynamic calculation in summary page too
        const bookingData = {
            totalAmount: displayedTotalPrice,
            advanceAmount: advanceAmount,
            remainingAmount: remainingAmount,
            type: finalType
        };

        if (finalType && typeof finalType === 'string') {
            navigate(`/booking/summary?type=${finalType}`, { state: bookingData });
        } else {
            navigate("/booking/summary", { state: bookingData });
        }
    };

    const getFormattedDate = (dateStr) => {
        if (!dateStr) return "";
        if (dateStr === "Today") return "Today";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
    };

    const primaryAddress = user?.addresses?.[0] || null;

    return (
        <>
            <AnimatePresence>
                <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsCartOpen(false)}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        className="relative w-full max-w-lg bg-background rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
                            <div>
                                <h2 className="text-xl font-bold font-display">
                                    {activeCheckoutType ? groupedItems[activeCheckoutType]?.label.replace(/🧴 |💇 |💄 /g, '') + " Checkout" : "Express Checkout"}
                                </h2>
                                <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-0.5">
                                    {activeCheckoutType ? "Focused Booking" : "Complete your booking"}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {activeCheckoutType ? (
                                    <button onClick={() => setActiveCheckoutType(null)} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-tight">
                                        Show All
                                    </button>
                                ) : (
                                    <button onClick={clearCart} className="text-[10px] font-bold text-destructive hover:underline uppercase tracking-tight">
                                        Clear All
                                    </button>
                                )}
                                <button onClick={() => setIsCartOpen(false)} className="p-2 rounded-full hover:bg-accent transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-4">

                            {/* Requirements Checker */}
                            <div className="space-y-3">
                                {/* Login Requirement */}
                                {!isLoggedIn && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between"
                                    >
                                        <div>
                                            <p className="text-sm font-bold text-amber-900">1. Required: Login</p>
                                            <p className="text-[10px] text-amber-800/80">Login to save your cart and book</p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => setIsLoginModalOpen(true)} className="h-8 text-xs font-bold border-amber-500/30 text-amber-900 bg-white/50">SIGN IN</Button>
                                    </motion.div>
                                )}

                                {/* Address Requirement */}
                                {isLoggedIn && (
                                    <motion.button
                                        onClick={() => setIsAddressModalOpen(true)}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`w-full text-left p-4 rounded-2xl flex items-center justify-between border-2 transition-all ${hasAddress ? "bg-green-500/5 border-green-500/20" : "bg-blue-500/5 border-blue-500/20"
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasAddress ? "bg-green-500/20" : "bg-blue-500/20"}`}>
                                                <MapPin className={`w-5 h-5 ${hasAddress ? "text-green-600" : "text-blue-600"}`} />
                                            </div>
                                            <div>
                                                <p className={`text-sm font-bold ${hasAddress ? "text-green-900" : "text-blue-900"}`}>2. Service Address</p>
                                                <p className={`text-[10px] ${hasAddress ? "text-green-700" : "text-blue-700"}`}>
                                                    {hasAddress && primaryAddress ? `${primaryAddress.houseNo || ""}${primaryAddress.houseNo ? ", " : ""}${primaryAddress.area || ""}` : "Tap to add your location"}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 ${hasAddress ? "text-green-600" : "text-blue-600"}`} />
                                    </motion.button>
                                )}

                                {/* Slot Requirement */}
                                {isLoggedIn && (
                                    <motion.button
                                        onClick={() => setIsSlotModalOpen(true)}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`w-full text-left p-4 rounded-2xl flex items-center justify-between border-2 transition-all ${selectedSlot ? "bg-green-500/5 border-green-500/20" : "bg-purple-500/5 border-purple-500/20"
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedSlot ? "bg-green-500/20" : "bg-purple-500/20"}`}>
                                                <Calendar className={`w-5 h-5 ${selectedSlot ? "text-green-600" : "text-purple-600"}`} />
                                            </div>
                                            <div>
                                                <p className={`text-sm font-bold ${selectedSlot ? "text-green-900" : "text-purple-900"}`}>3. Booking Slot</p>
                                                <p className={`text-[10px] ${selectedSlot ? "text-green-700" : "text-purple-700"}`}>
                                                    {selectedSlot
                                                        ? `${getFormattedDate(selectedSlot.date)} at ${selectedSlot.time} (${selectedSlot.provider?.name || 'Trained Professional'})`
                                                        : "Pick a date & time"}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 ${selectedSlot ? "text-green-600" : "text-purple-600"}`} />
                                    </motion.button>
                                )}
                            </div>

                            {/* Savings Banner */}
                            {totalSavings > 0 && (
                                <div className="bg-primary rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-primary/20 text-white">
                                    <span className="text-2xl">⚡</span>
                                    <p className="text-sm font-bold uppercase tracking-wide">
                                        You are saving ₹{totalSavings} today!
                                    </p>
                                </div>
                            )}

                            {/* Advance Payment Info */}
                            {isHighValue && (
                                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center gap-2 text-primary">
                                        <ShieldCheck className="w-5 h-5" />
                                        <h4 className="font-bold text-sm">Advance Payment Required</h4>
                                    </div>
                                    <div className="space-y-1.5">
                                        {advanceInfo.itemsWithAdvance.map((item, idx) => (
                                            <p key={idx} className="text-[10px] text-muted-foreground leading-relaxed flex justify-between">
                                                <span>• {item.name} ({item.percent}%)</span>
                                                <span className="font-bold text-foreground">₹{item.advance.toLocaleString()}</span>
                                            </p>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/80 italic">
                                        Remaining ₹{remainingAmount.toLocaleString()} is payable after service completion.
                                    </p>
                                    <div className="flex justify-between items-center pt-2 border-t border-primary/10">
                                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Total Advance Due Now</span>
                                        <span className="text-lg font-black text-primary">₹{advanceAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            {/* Grouped Items Section */}
                            <div className="space-y-6 pb-4">
                                {Object.entries(displayedGroups).map(([type, group]) => (
                                    <motion.div
                                        key={type}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white rounded-[28px] border border-border/50 overflow-hidden shadow-sm flex flex-col"
                                    >
                                        {/* Group Header */}
                                        <div className="relative h-24 sm:h-28 overflow-hidden">
                                            <img src={group.image} className="w-full h-full object-cover" alt="" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h3 className="text-sm font-black text-white">{group.label}</h3>
                                                        <p className="text-[10px] font-bold text-white/70 uppercase">{group.items.length} {group.items.length === 1 ? 'Service' : 'Services'}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => clearGroup(type)}
                                                        className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white hover:bg-black/40 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Items List */}
                                        <div className="p-1 space-y-1 bg-accent/5">
                                            {group.items.map((item) => (
                                                <div key={item.id} className="bg-white p-3 rounded-2xl flex gap-3 items-center">
                                                    <div className="w-12 h-12 rounded-xl bg-accent overflow-hidden flex-shrink-0">
                                                        <img src={item.image} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-[13px] font-bold text-foreground leading-tight truncate">{item.name}</h4>
                                                        <p className="text-[10px] font-bold text-primary mt-0.5">₹{item.price.toLocaleString()}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-accent/60 rounded-xl p-0.5">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, -1, type)}
                                                            className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                                                        >
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                        <span className="text-xs font-black min-w-4 text-center">{item.quantity}</span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, 1, type)}
                                                            className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Group Footer */}
                                        <div className="p-4 bg-white border-t border-border/30 flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Type Subtotal</p>
                                                <p className="text-lg font-black text-foreground">₹{group.subtotal.toLocaleString()}</p>
                                            </div>
                                            <Button
                                                onClick={() => handleCheckout(type)}
                                                className="h-11 px-6 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-sm gap-2 shadow-lg shadow-primary/20"
                                            >
                                                Checkout <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Final Footer */}
                        <div className="p-4 bg-background border-t border-border shadow-2xl relative z-20">
                            {isHighValue ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Total Service Value</span>
                                        <span className="text-sm font-bold">₹{displayedTotalPrice.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Advance to Pay Now</p>
                                            <p className="text-2xl font-black text-primary">₹{advanceAmount.toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Remaining Balance</p>
                                            <p className="text-sm font-bold text-foreground">₹{remainingAmount.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Payable Amount</p>
                                        <p className="text-2xl font-black text-primary">₹{displayedTotalPrice.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-green-600 uppercase">You Save</p>
                                        <p className="text-sm font-bold text-green-700">₹{totalSavings}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>

            <AddressModal
                isOpen={isAddressModalOpen}
                onClose={() => setIsAddressModalOpen(false)}
            />

            <SlotSelectionModal
                isOpen={isSlotModalOpen}
                onClose={() => setIsSlotModalOpen(false)}
            />
        </>
    );
};

export default ExpressCheckout;

