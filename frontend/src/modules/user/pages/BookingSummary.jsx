import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Calendar, Clock, Tag, ChevronRight, CheckCircle2, ShoppingBag, Zap } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/modules/user/components/ui/alert-dialog";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { useBookings } from "@/modules/user/contexts/BookingContext";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { api } from "@/modules/user/lib/api";
import { toast } from "sonner";
import SlotSelectionModal from "@/modules/user/components/salon/SlotSelectionModal";

const BookingSummary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const checkoutType = searchParams.get('type');
  const bookingParam = searchParams.get('booking');

  const { gender } = useGenderTheme();
  const { cartItems, updateQuantity, clearCart, totalPrice, totalSavings, isCartOpen, setIsCartOpen, selectedSlot, getGroupedItems, bookingType: contextBookingType, customAdvance, setCustomAdvance } = useCart();
  const { user, setIsAddressModalOpen } = useAuth();
  const { addBooking, loadBookings } = useBookings();
  const { checkAvailability } = useUserModuleData();

  const allGroups = getGroupedItems();
  const displayGroupsCheck = checkoutType && allGroups[checkoutType] ? { [checkoutType]: allGroups[checkoutType] } : allGroups;
  const displayItemsCheck = Object.values(displayGroupsCheck).flatMap(g => g?.items || []).filter(Boolean);

  // If filtered display is empty but cart has items, fallback to all items to avoid empty screen
  const displayGroups = (displayItemsCheck.length === 0 && cartItems.length > 0) ? allGroups : displayGroupsCheck;
  const displayItems = Object.values(displayGroups).flatMap(g => g?.items || []).filter(Boolean);
  const displayItemsKey = JSON.stringify(displayItems.map((it) => ({
    name: it?.name || "",
    price: it?.price || 0,
    quantity: it?.quantity || 1,
    duration: it?.duration || "",
    category: it?.category || "",
    serviceType: it?.serviceType || "",
  })));

  const displayTotalPrice = displayItems.reduce((total, item) => total + ((item?.price || 0) * (item?.quantity || 1)), 0);
  const displayTotalSavings = displayItems.reduce((total, item) => {
    if (item?.originalPrice) {
      return total + ((item.originalPrice - item.price) * (item.quantity || 1));
    }
    return total;
  }, 0);

  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [isBusyModalOpen, setIsBusyModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quotePreview, setQuotePreview] = useState(null);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);

  // Determine effective booking type
  const effectiveBookingType = bookingParam || contextBookingType || "instant";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { coupons } = await api.userCoupons();
        if (!cancelled) setAvailableCoupons(Array.isArray(coupons) ? coupons : []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto apply coupon if redirected from CouponsPage
  useEffect(() => {
    const urlCoupon = searchParams.get('coupon');
    if (urlCoupon) {
      setCoupon(urlCoupon);
    }
  }, [location.search]);

  const handleApplyCoupon = async () => {
    try {
      const items = displayItems.filter(Boolean).map(it => ({ name: it?.name || "", price: it?.price || 0, quantity: it?.quantity || 1, duration: it?.duration, category: it?.category, serviceType: it?.serviceType, image: it?.image || "" }));
      const quote = await api.bookings.quote({ items, couponCode: coupon, bookingType: effectiveBookingType });
      const { discount: serverDiscount, couponApplied: appliedCode } = quote;
      if (!appliedCode) {
        setCouponError("Invalid or expired coupon");
        setCouponApplied(null);
        setQuotePreview(null);
        return;
      }
      setCouponError("");
      const safeDiscount = Number(serverDiscount) || 0;
      setCouponApplied({ code: appliedCode, discountType: "flat", discountValue: safeDiscount, maxDiscount: safeDiscount });
      setQuotePreview(quote);
    } catch (e) {
      setCouponError(e.message || "Coupon apply failed");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = displayItems.filter(Boolean).map(it => ({ name: it?.name || "", price: it?.price || 0, quantity: it?.quantity || 1, duration: it?.duration, category: it?.category, serviceType: it?.serviceType, image: it?.image || "" }));
        if (!items.length) return;
        const quote = await api.bookings.quote({
          items,
          couponCode: couponApplied?.code || undefined,
          bookingType: effectiveBookingType,
        });
        if (!cancelled) setQuotePreview(quote);
      } catch {
        if (!cancelled) setQuotePreview(null);
      }
    })();
    return () => { cancelled = true; };
  }, [displayItemsKey, effectiveBookingType, couponApplied?.code, user?.subscription?.planId]);

  const isPlusMember = !!(user?.subscription?.isPlusMember || user?.isPlusMember);
  const subscriptionPreview = quotePreview?.subscription || user?.subscription || null;
  const plusDiscountPercentage = Number(subscriptionPreview?.discountPercentage || user?.subscription?.discountPercentage || 10);
  const plusDiscount = Number(quotePreview?.subscriptionDiscount || 0);
  const combinedDiscount = Number(quotePreview?.discount || 0);
  const discount = Math.max(combinedDiscount - plusDiscount, 0);
  const convenienceFee = Number(quotePreview?.convenienceFee || 0);

  const passedBookingData = location.state;
  const customAdvanceData = passedBookingData?.customAdvance || customAdvance;
  const finalTotal = Number(quotePreview?.finalTotal ?? Math.max(displayTotalPrice - combinedDiscount, 0));

  // Calculate advance based on passed data or fallback
  // Instant bookings do not require advance payment
  let advanceAmount = (effectiveBookingType === 'instant') ? 0 : (passedBookingData?.advanceAmount || quotePreview?.advanceAmount || 0);
  
  // Safeguard: Advance cannot exceed the final discounted total
  if (advanceAmount > finalTotal) {
      advanceAmount = finalTotal;
  }
  
  const remainingAfterAdvance = finalTotal - advanceAmount;

  const loadRazorpay = () =>
    new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error("Razorpay SDK failed to load"));
      document.body.appendChild(script);
    });

  const goToPayment = ({ totals, serverAdvance, order, bookingId, customAdvance, paymentPurpose }) => {
    setIsProcessing(false);
    
    const state = customAdvance ? {
      discount: 0,
      finalTotal: serverAdvance,
      totalSavings: 0,
      checkoutType: "custom",
      advanceAmount: serverAdvance,
      remainingAmount: 0,
      isPartiallyPaid: false,
      customAdvance,
      paymentPurpose,
      amountOverride: serverAdvance,
      order,
      bookingId
    } : {
      discount: totals.total - totals.finalTotal,
      finalTotal: totals.finalTotal,
      totalSavings: displayTotalSavings,
      checkoutType,
      advanceAmount: serverAdvance,
      remainingAmount: totals.finalTotal - serverAdvance,
      isPartiallyPaid: serverAdvance > 0,
      order,
      bookingId
    };
    
    navigate("/payment", { state });
  };

  const handlePay = async (allowAutoFallback = false) => {
    if (customAdvanceData?.enquiryId) {
      const amt = Number(customAdvanceData.amount || 0);
      if (!(amt > 0)) {
        toast.error("Advance amount not available.");
        return;
      }
      goToPayment({ 
        serverAdvance: amt, 
        customAdvance: { enquiryId: customAdvanceData.enquiryId, amount: amt },
        paymentPurpose: "custom_advance"
      });
      return;
    }
    if (!user?.addresses || user.addresses.length === 0) {
      setIsAddressModalOpen(true);
      return;
    }
    if (!selectedSlot?.date || !selectedSlot?.time) {
      toast.error("Please select a booking slot (date & time)");
      return;
    }
    
    // Bug Fix 1: Zone Service Availability Validation
    // Check if the selected zone has available services
    const userAddress = user.addresses[0];

    if (displayItems.length > 0) {
      const hasUnavailableServices = displayItems.some((item) => !checkAvailability(item, userAddress));

      if (hasUnavailableServices) {
        toast.error("Currently this service is not available in your zone.");
        return;
      }
    }
    
    setIsProcessing(true);
    try {
      const items = displayItems.filter(Boolean).map(it => ({ name: it?.name || "", price: it?.price || 0, quantity: it?.quantity || 1, duration: it?.duration, category: it?.category, serviceType: it?.serviceType, image: it?.image || "" }));
      const address = {
        houseNo: user.addresses[0].houseNo,
        area: user.addresses[0].area,
        landmark: user.addresses[0].landmark || "",
        city: user.addresses[0].city || user.addresses[0].area || "",
        zone: user.addresses[0].zone || user.addresses[0].area || "",
        lat: user.addresses[0].lat ?? null,
        lng: user.addresses[0].lng ?? null
      };
      const payload = {
        items,
        slot: selectedSlot,
        address,
        bookingType: effectiveBookingType,
        couponCode: couponApplied?.code || undefined,
        preferredProviderId: selectedSlot?.provider?.id || selectedSlot?.provider?._id || undefined,
        allowAutoFallback
      };
      const { booking, totals, advanceAmount: serverAdvance, order } = await api.bookings.create(payload);
      const bookingId = booking?.id || booking?._id;
      setIsProcessing(false);
      goToPayment({ totals, serverAdvance, order, bookingId });
    } catch (e) {
      setIsProcessing(false);
      if (e.code === "PREFERRED_PROVIDER_BUSY") {
        setIsBusyModalOpen(true);
      } else if (e.code === "SLOT_UNAVAILABLE") {
        toast.error("Selected slot is no longer available. Please choose another slot.");
      } else {
        toast.error(e.message || "Payment initiation failed");
      }
    }
  };

  const getFormattedDate = (dateStr) => {
    if (!dateStr) return "";
    if (dateStr === "Today") return "Today";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6"
        >
          <CheckCircle2 className="w-14 h-14 text-primary" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-display font-bold text-center"
        >
          Booking Confirmed! 🎉
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-2 text-muted-foreground text-sm text-center"
        >
          Your beautician will be assigned shortly for {getFormattedDate(selectedSlot?.date)} at {selectedSlot?.time}
        </motion.p>
      </div>
    );
  }

  if (cartItems.length === 0 && !isProcessing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4 opacity-20" />
        <p className="text-muted-foreground">Your cart is empty</p>
        <Button onClick={() => navigate("/home")} className="mt-4">Go Back Home</Button>
      </div>
    );
  }

	  return (
	    <div className="min-h-screen bg-background pb-28">
	      {/* Header */}
	      <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
	        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
	          <ArrowLeft className="w-4 h-4" />
	        </button>
        <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>Booking Summary</h1>
      </div>

      <div className="px-4 md:px-8 lg:px-0 max-w-2xl mx-auto mt-4 space-y-4">
        {/* Address */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-2xl p-5 border border-border/50">
          <div className="flex items-center gap-2 text-sm font-bold mb-3 uppercase tracking-wider text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary" /> Service Address
          </div>
          {Array.isArray(user?.addresses) && user.addresses.length > 0 ? (
            <div>
              <p className="font-bold text-sm uppercase">{user.addresses[0].type}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {user.addresses[0].houseNo}, {user.addresses[0].area}
                {user.addresses[0].landmark && <span className="block italic text-xs mt-0.5 opacity-60">Near {user.addresses[0].landmark}</span>}
              </p>
            </div>
          ) : (
            <p className="text-sm text-destructive">No address selected</p>
          )}
        </motion.div>

        {/* Date & Time */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          onClick={() => setIsSlotModalOpen(true)}
          className="glass-strong rounded-2xl p-5 border border-border/50 flex justify-between items-center cursor-pointer hover:border-primary/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Selected Slot</p>
              <p className="text-sm font-bold mt-1 text-primary">{getFormattedDate(selectedSlot?.date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-border pl-6 relative">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Timing & Professional</p>
              <p className="text-sm font-bold mt-1 text-primary">
                {selectedSlot?.time}
                <span className="block text-[10px] text-muted-foreground mt-0.5">By {selectedSlot?.provider?.name || 'Any Trained Professional'}</span>
              </p>
            </div>
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-4 h-4 text-primary" />
            </div>
          </div>
        </motion.div>

        {/* Grouped Services */}
        <div className="space-y-6">
          {Object.entries(displayGroups).map(([type, group]) => (
            group && (
              <div key={type} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                    {group.label || "Services"}
                  </h3>
                  <span className="text-[10px] font-bold text-primary/60">
                    Section Subtotal: ₹{(group.subtotal || 0).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-3">
                  {group.items?.filter(Boolean).map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + idx * 0.05 }}
                      className="glass-strong rounded-2xl p-4 border border-border/50 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-accent flex-shrink-0 border border-border/50">
                          <img src={item.image} alt={item?.name || "Service"} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-foreground truncate">{item?.name || "Unknown Service"}</h3>
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                            Quantity: {item.quantity} · {item.duration}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-primary text-sm">₹{(item.price * item.quantity).toLocaleString()}</p>
                          {item.originalPrice && (
                            <p className="text-[9px] text-muted-foreground line-through opacity-60">
                              ₹{(item.originalPrice * item.quantity).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>

        {/* Coupon */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-strong rounded-2xl p-5 border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Tag className="w-4 h-4 text-primary" /> Offers & Benefits
            </div>
            <button
              onClick={() => navigate(`/coupons?checkoutType=${checkoutType || ''}`)}
              className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider"
            >
              See All Offers
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter coupon code"
              value={coupon}
              onChange={(e) => {
                setCoupon(e.target.value);
                setCouponError("");
                setCouponApplied(null);
              }}
              className="flex-1 h-12 rounded-xl bg-accent border-none text-base font-medium"
            />
            {availableCoupons.length > 0 && (
              <select
                value={coupon}
                onChange={(e) => {
                  setCoupon(e.target.value);
                  setCouponError("");
                  setCouponApplied(null);
                }}
                className="h-12 rounded-xl bg-white border border-border px-3 text-sm font-bold"
                aria-label="Select coupon"
              >
                <option value="">Choose coupon</option>
                {availableCoupons.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.type === "FIXED" ? `₹${c.value}` : `${c.value}%`})
                  </option>
                ))}
              </select>
            )}
            <Button
              className="h-12 rounded-xl px-6 font-bold"
              variant={couponApplied ? "secondary" : "default"}
              onClick={handleApplyCoupon}
              disabled={!coupon}
            >
              {couponApplied ? "Applied ✓" : "Apply"}
            </Button>
          </div>
          {couponError && <p className="text-[10px] text-destructive mt-2 ml-1 font-bold">{couponError}</p>}
          {couponApplied && <p className="text-[10px] text-green-600 mt-2 ml-1 font-bold">Coupon applied successfully!</p>}
        </motion.div>

        {/* SWM Plus Banner (for non-members) */}
        {!isPlusMember && displayTotalPrice >= 499 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            onClick={() => navigate('/plus-subscription')}
            className="bg-accent/40 rounded-2xl p-4 border border-amber-400/20 flex items-center gap-3 cursor-pointer hover:border-amber-400/40 transition-all shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-400/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-amber-600 dark:text-amber-400">SWM Plus members unlock up to 15% savings on eligible bookings.</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Join from ₹299/quarter → Save from ₹{Math.round(displayTotalPrice * 0.10)} now</p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />
          </motion.div>
        )}

        {/* Price Breakdown */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-strong rounded-2xl p-5 border border-border/50 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-medium">Service Total</span>
            <span className="font-bold">₹{(displayTotalPrice + displayTotalSavings).toLocaleString()}</span>
          </div>
          {displayTotalSavings > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-600 font-medium">Auto Discount Applied</span>
              <span className="text-green-600 font-bold">-₹{displayTotalSavings.toLocaleString()}</span>
            </div>
          )}
          {couponApplied && (
            <div className="flex justify-between text-sm">
              <span className="text-primary font-medium">Coupon Discount ({couponApplied.code})</span>
              <span className="text-primary font-bold">-₹{discount.toLocaleString()}</span>
            </div>
          )}
          {plusDiscount > 0 && (
            <div className="flex justify-between text-sm items-center">
              <span className="text-amber-600 font-medium flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> SWM Plus Discount ({plusDiscountPercentage}%)
              </span>
              <span className="text-amber-600 font-bold">-₹{plusDiscount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-medium">Convenience Fee</span>
            {isPlusMember && subscriptionPreview?.zeroConvenienceFee ? (
              <span className="font-bold text-emerald-600 flex items-center gap-1">
                {convenienceFee > 0 && (
                  <span className="line-through text-muted-foreground/50 text-xs">₹{convenienceFee}</span>
                )} FREE
              </span>
            ) : (
              <span className="font-bold">₹{convenienceFee.toLocaleString()}</span>
            )}
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-medium">Taxes & Fees</span>
            <span className="font-bold">₹0</span>
          </div>

          {advanceAmount > 0 && (
            <>
              <div className="pt-2 border-t border-border/30 flex justify-between text-sm text-primary font-bold">
                <span>Advance Payable Now</span>
                <span>₹{advanceAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground italic">
                <span>Remaining Balance (Due after service)</span>
                <span>₹{remainingAfterAdvance.toLocaleString()}</span>
              </div>
            </>
          )}

          <div className="pt-3 border-t border-dashed border-border flex justify-between items-center text-lg font-black">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Total Value</span>
              <span className="text-primary mt-1">₹{finalTotal.toLocaleString()}</span>
            </div>
            {displayTotalSavings + discount + plusDiscount > 0 && (
              <div className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-lg">
                SAVED ₹{(displayTotalSavings + discount + plusDiscount).toLocaleString()}
              </div>
            )}
          </div>
        </motion.div>

        <p className="text-[10px] text-muted-foreground text-center font-medium bg-accent/50 py-3 rounded-xl border border-border/30">
          Safe & Hygienic services · 100% Satisfaction Guarantee · Cancel anytime
        </p>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border p-5 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">{advanceAmount > 0 ? "Grand Total" : "Grand Total"}</p>
            <p className="text-2xl font-black text-primary leading-none">₹{finalTotal.toLocaleString()}</p>
          </div>
          <Button 
            onClick={() => handlePay(false)} 
            disabled={isProcessing}
            className="flex-1 h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-bold shadow-xl shadow-primary/20 gap-2 group border-none"
          >
            {isProcessing ? "Processing..." : (advanceAmount > 0 ? `PAY ADVANCE ₹${advanceAmount.toLocaleString()}` : "PROCEED TO PAY")}
            {!isProcessing && (
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ChevronRight className="w-5 h-5" />
              </div>
            )}
          </Button>
        </div>
      </div>

      {/* Provider Busy Modal */}
      <AlertDialog open={isBusyModalOpen} onOpenChange={setIsBusyModalOpen}>
        <AlertDialogContent className="rounded-[32px] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-display font-bold">Provider Currently Unavailable</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium">
              Your selected provider is booked for the selected time slot. Do you want to auto allocation booking to the next provider?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-0">
            <AlertDialogCancel 
              onClick={() => {
                toast.info("Kindly rebook the service.");
                navigate("/explore");
              }}
              className="rounded-2xl h-12 font-bold"
            >
              No, Rebook
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handlePay(true)}
              className="rounded-2xl h-12 bg-primary font-bold"
            >
              Yes, Auto Allocate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Slot Selection Modal */}
      <SlotSelectionModal 
        isOpen={isSlotModalOpen} 
        onClose={() => setIsSlotModalOpen(false)} 
        onSave={() => setIsSlotModalOpen(false)}
        address={user?.addresses?.[0]}
      />
    </div>
  );
};

export default BookingSummary;

