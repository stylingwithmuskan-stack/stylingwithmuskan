import { useState, useRef, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Star, Clock, ShieldCheck, Plus, Minus,
  Calendar, ChevronRight, ShoppingCart,
  Heart, Share2, Check, Timer, Sparkles, Camera,
  UserCheck, MessageSquare
} from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { useWishlist } from "@/modules/user/contexts/WishlistContext";
import { api, API_BASE_URL } from "@/modules/user/lib/api";

const ServiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { gender } = useGenderTheme();
  const { cartItems, addToCart, setIsCartOpen, selectedSlot: globalSlot, setSelectedSlot: setGlobalSlot } = useCart();
  const { isLoggedIn, user } = useAuth();
  const { services, categories, serviceTypes, providers: mockProviders, checkAvailability } = useUserModuleData();
  const service = services.find((s) => s.id === id);

  const [qty, setQty] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const { toggleWishlist, isInWishlist } = useWishlist();
  const isFav = isInWishlist(id);
  const [addedToCart, setAddedToCart] = useState(false);
  const [reviewsData, setReviewsData] = useState({ feedbacks: [], gallery: [] });
  const [loadingReviews, setLoadingReviews] = useState(true);
  const stepsRef = useRef(null);

  const userLocation = user?.addresses?.[0] || user?.address || null;
  const isAvailable = useMemo(() => {
    return checkAvailability(service, userLocation, selectedDate, selectedSlot?.split(' ')[0]);
  }, [service, userLocation, selectedDate, selectedSlot, checkAvailability]);

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Fetch real reviews and approved images
    const fetchReviews = async () => {
      if (!service?.name) return;
      try {
        setLoadingReviews(true);
        const res = await api.content.getServiceReviews(service.name);
        if (res.success) {
          setReviewsData(res.data);
        }
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
      } finally {
        setLoadingReviews(false);
      }
    };
    fetchReviews();
  }, [id, service?.name]);

  const { realRating, realReviews, allFeedbacks } = useMemo(() => {
    if (!service) return { realRating: 0, realReviews: 0, allFeedbacks: [] };
    
    // Combine local storage feedback with API feedback
    const localFeedback = JSON.parse(localStorage.getItem('muskan-feedback') || '[]');
    const serviceLocalFeedback = localFeedback.filter(f => f.serviceName === service.name && f.type === 'customer_to_provider');
    
    // Merge both, avoid duplicates by bookingId
    const combined = [...reviewsData.feedbacks];
    serviceLocalFeedback.forEach(lf => {
      if (!combined.some(cf => (cf.bookingId || cf.id) === (lf.bookingId || lf.id))) {
        combined.push(lf);
      }
    });

    if (combined.length === 0) return { realRating: service.rating || 0, realReviews: service.reviews || 0, allFeedbacks: [] };
    const sum = combined.reduce((a, b) => a + (b.rating || 0), 0);
    return { 
      realRating: (sum / combined.length).toFixed(1), 
      realReviews: combined.length,
      allFeedbacks: combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    };
  }, [service, reviewsData.feedbacks]);

  // Filter providers based on the service category/type
  const availableProviders = useMemo(() => {
    if (!service) return [];
    return mockProviders.filter(p => p.specialties?.includes(service.serviceType));
  }, [service]);

  useEffect(() => {
    if (availableProviders.length > 0 && !selectedProvider) {
      setSelectedProvider(availableProviders[0]);
    }
  }, [availableProviders, selectedProvider]);

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Service not found</p>
      </div>
    );
  }

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      key: d.toISOString().split("T")[0],
      isToday: i === 0,
    };
  });

  const slots = ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"];
  const discountPercent = service.originalPrice
    ? Math.round(((service.originalPrice - service.price) / service.originalPrice) * 100)
    : 0;

  const handleAddToCart = () => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }

    addToCart(service, qty);
    setAddedToCart(true);
    setIsCartOpen(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleBookingAction = () => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    handleAddToCart();
    setIsCartOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Hero Image */}
      <div className="relative h-48 md:h-64 lg:h-[380px]">
        <img
          src={service.image}
          alt={service.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

        {/* Top Actions */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full glass flex items-center justify-center backdrop-blur-xl"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => toggleWishlist(service)}
              className="w-10 h-10 rounded-full glass flex items-center justify-center backdrop-blur-xl"
            >
              <Heart className={`w-5 h-5 transition-all ${isFav ? "fill-red-500 text-red-500 scale-110" : "text-foreground"}`} />
            </button>
            <button
              onClick={() => shareContent({
                title: service.name,
                text: `Check out this ${service.name} at Styling with Muskan!`,
                url: window.location.href,
              })}
              className="w-10 h-10 rounded-full glass flex items-center justify-center backdrop-blur-xl"
            >
              <Share2 className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>

        {/* Discount Badge - Removed from here, moved to card below */}
      </div>

      <div className="px-4 md:px-8 lg:px-0 max-w-4xl mx-auto -mt-10 relative z-10">
        {/* ===== SERVICE INFO CARD ===== */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-4 md:p-5 shadow-elevated relative overflow-hidden"
        >
          {/* Discount Badge - Moved here for visibility */}
          {discountPercent > 0 && (
            <div className="absolute top-0 right-0 bg-gradient-to-l from-green-500 to-emerald-600 text-white px-4 py-1.5 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest shadow-lg z-20">
              {discountPercent}% OFF
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className={`text-xl md:text-2xl lg:text-3xl font-bold ${gender === "women" ? "font-display" : "font-heading-men"}`}>
                {service.name}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> {realRating}
                </span>
                <span>({realReviews} reviews)</span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <Clock className="w-3.5 h-3.5" /> {service.duration}
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 pt-2">
              <p className={`text-xl md:text-3xl font-bold ${isAvailable ? "text-primary" : "text-muted-foreground/50"}`}>₹{service.price.toLocaleString()}</p>
              {service.originalPrice && (
                <p className="text-xs text-muted-foreground line-through">₹{service.originalPrice.toLocaleString()}</p>
              )}
              {!isAvailable && (
                <p className="text-[9px] text-red-500 font-bold mt-1 max-w-[100px]">Not available</p>
              )}
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{service.description}</p>

          {/* What's Included */}
          <div className="mt-4">
            <h3 className="font-semibold text-xs mb-2 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> What's Included
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(service.includes || []).map((item) => (
                <span
                  key={item}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-accent text-accent-foreground flex items-center gap-1 shadow-sm border border-border/20"
                >
                  <Check className="w-2.5 h-2.5 text-primary" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 mt-4 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Verified & Certified Professional</span>
          </div>
        </motion.div>

        {/* ===== STEPS WE FOLLOW ===== */}
        {service.steps && service.steps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4"
          >
            <h3 className={`font-semibold text-base mb-4 px-1 flex items-center gap-2 ${gender === "women" ? "font-display" : "font-heading-men"}`}>
              <Timer className="w-5 h-5 text-primary" />
              Steps We Follow
            </h3>

            {/* Steps Scroll */}
            <div ref={stepsRef} className="flex gap-4 overflow-x-auto hide-scrollbar pb-3 px-1">
              {service.steps.map((step, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`flex-shrink-0 flex flex-col items-center gap-2 w-20 md:w-24 transition-all duration-300 ${activeStep === idx ? "scale-105" : "opacity-70"}`}
                >
                  {/* Rounded Image */}
                  <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-[3px] transition-all duration-300 ${activeStep === idx
                    ? "border-primary glow-primary shadow-lg"
                    : "border-border"
                    }`}>
                    <img
                      src={step.image}
                      alt={step.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Step Number Overlay */}
                    <div className={`absolute inset-0 flex items-center justify-center transition-all ${activeStep === idx ? "bg-primary/20" : "bg-background/30"
                      }`}>
                      <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${activeStep === idx
                        ? "bg-primary text-primary-foreground"
                        : "bg-background/80 text-foreground"
                        }`}>
                        {idx + 1}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[11px] md:text-xs text-center font-medium leading-tight ${activeStep === idx ? "text-primary" : "text-muted-foreground"
                    }`}>
                    {step.name}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Active Step Detail */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="glass-strong rounded-xl p-4 mt-2 flex items-center gap-4"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden flex-shrink-0 border border-border">
                  <img
                    src={service.steps[activeStep].image}
                    alt={service.steps[activeStep].name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Step {activeStep + 1}
                    </span>
                    <h4 className="font-semibold text-sm">{service.steps[activeStep].name}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {service.steps[activeStep].description}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Step Progress Bar */}
            <div className="flex items-center gap-1 mt-3 px-1">
              {service.steps.map((_, idx) => (
                <motion.div
                  key={idx}
                  className={`h-1 rounded-full flex-1 cursor-pointer transition-all duration-300 ${idx <= activeStep ? "bg-primary" : "bg-border"
                    }`}
                  onClick={() => setActiveStep(idx)}
                  whileHover={{ scaleY: 2 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ===== WORK GALLERY (Before/After) ===== */}
        {(service.gallery?.length > 0 || reviewsData.gallery?.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mt-4"
          >
            <h3 className={`font-semibold text-base mb-4 px-1 flex items-center gap-2 ${gender === "women" ? "font-display" : "font-heading-men"}`}>
              <Camera className="w-5 h-5 text-primary" />
              Real Service Results (Approved)
            </h3>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 px-1">
              {/* Combine Hardcoded Gallery with Approved Booking Images */}
              {[
                ...(service.gallery || []).map(img => ({ type: 'hardcoded', url: img })),
                ...(reviewsData.gallery || []).map(g => ({ 
                  type: 'approved', 
                  before: g.before, 
                  after: g.after, 
                  products: g.products || g.productImages || [],
                  customer: g.customerName 
                }))
              ].map((item, idx) => (
                <div key={idx} className="flex-shrink-0 w-[300px] space-y-3">
                  <div className="relative h-44 rounded-2xl overflow-hidden group shadow-lg border border-border bg-accent/30">
                    {item.type === 'hardcoded' ? (
                      <img src={item.url} alt="Work" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex">
                        <div className={`relative ${item.after?.length > 0 ? "w-1/2" : "w-full"}`}>
                          <img src={item.before?.[0]} alt="Before" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                          <div className="absolute top-2 left-2 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase backdrop-blur-md">Before</div>
                        </div>
                        {item.after?.length > 0 && (
                          <div className="w-1/2 relative">
                            <img src={item.after?.[0]} alt="After" className="w-full h-full object-cover" />
                            <div className="absolute top-2 right-2 bg-primary text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase shadow-lg">After</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ===== QUANTITY & COST ===== */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-4 glass-strong rounded-2xl p-4 md:p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-sm">Quantity</span>
              <p className="text-xs text-muted-foreground mt-0.5">Select number of sessions</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-9 h-9 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <motion.span
                key={qty}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="font-bold text-lg w-8 text-center"
              >
                {qty}
              </motion.span>
              <button
                onClick={() => setQty(qty + 1)}
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Price Summary */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price per session</span>
              <span>₹{service.price.toLocaleString()}</span>
            </div>
            {qty > 1 && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Quantity</span>
                <span>× {qty}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
              <span className="font-semibold">Total</span>
              <motion.span
                key={qty}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-xl font-bold text-primary"
              >
                ₹{(service.price * qty).toLocaleString()}
              </motion.span>
            </div>
          </div>
        </motion.div>

        {/* ===== CUSTOMER REVIEWS ===== */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-4 mb-8"
        >
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className={`font-semibold text-base flex items-center gap-2 ${gender === "women" ? "font-display" : "font-heading-men"}`}>
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              Customer Reviews
            </h3>
            <span className="text-xs font-bold text-primary">All Reviews ({allFeedbacks.length})</span>
          </div>

          <div className="space-y-3">
            {(() => {
              if (loadingReviews) {
                return <div className="py-8 text-center text-xs text-muted-foreground">Loading reviews...</div>;
              }

              if (allFeedbacks.length === 0) {
                return (
                  <div className="glass-strong rounded-2xl p-6 text-center border border-dashed border-border/60">
                    <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm font-bold text-muted-foreground">No real reviews yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Be the first to review this service!</p>
                  </div>
                );
              }

              return allFeedbacks.slice(0, 10).map((rev, i) => (
                <motion.div
                  key={rev._id || rev.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-strong rounded-2xl p-4 border border-border/40"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-[10px]">
                        {rev.customerName?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold">{rev.customerName}</p>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`w-2.5 h-2.5 ${s <= rev.rating ? "text-amber-500 fill-amber-500" : "text-slate-200"}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {rev.comment && (
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1 italic">
                      "{rev.comment}"
                    </p>
                  )}

                  {rev.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {rev.tags.map(tag => (
                        <span key={tag} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-accent text-accent-foreground border border-border/30">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ));
            })()}
          </div>
        </motion.div>
      </div>

      {/* ===== STICKY BOTTOM BAR ===== */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border p-4 z-40 bg-background/80 backdrop-blur-xl"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Total</p>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-black uppercase tracking-tighter border border-primary/20">
                {serviceTypes.find(t => t.id === categories.find(c => c.id === service.category)?.serviceType)?.label || "Service"}
              </span>
            </div>
            <motion.p
              key={qty}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="text-xl md:text-2xl font-black text-primary"
            >
              ₹{(service.price * qty).toLocaleString()}
            </motion.p>
          </div>
          <div className="flex items-center gap-2">
            {/* Add to Cart Button - Directly navigates to cart */}
            {!isAvailable ? (
              <Button
                disabled
                className="flex-1 h-12 gap-2 rounded-xl font-bold bg-muted text-muted-foreground px-6 min-w-[140px]"
              >
                Currently Unavailable
              </Button>
            ) : (
              <Button
                onClick={handleAddToCart}
                className="flex-1 h-12 gap-2 rounded-xl transition-all duration-300 font-bold bg-primary text-primary-foreground glow-primary px-6 min-w-[140px]"
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ServiceDetail;
