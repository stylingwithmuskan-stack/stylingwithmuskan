import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Clock, Check, ChevronRight, Star, MapPin, UserCheck, ShieldCheck, Users } from "lucide-react";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { Button } from "@/modules/user/components/ui/button";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { api } from "@/modules/user/lib/api";

const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    // Case: "07:00 AM" or "07:00 PM"
    if (timeStr.includes("AM") || timeStr.includes("PM")) {
        const [time, period] = timeStr.split(" ");
        let [hours, minutes] = time.split(":").map(Number);
        if (period === "PM" && hours < 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        return hours * 60 + minutes;
    }
    // Case: "09:00" (HH:mm)
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + (minutes || 0);
};

const parseDurationToMinutes = (input, fallbackMinutes = 60) => {
    if (typeof input === "number" && !Number.isNaN(input)) {
        return Math.max(15, Math.min(Math.round(input), 12 * 60));
    }
    if (!input || typeof input !== "string") return fallbackMinutes;
    const s = input.toLowerCase()
        .replace(/hours?/g, "h")
        .replace(/hrs?/g, "h")
        .replace(/minutes?/g, "m")
        .replace(/mins?/g, "m");

    const range = s.match(/(\d+)\s*-\s*(\d+)/);
    if (range) {
        const max = Math.max(parseInt(range[1], 10), parseInt(range[2], 10));
        if (s.includes("h")) return Math.max(15, Math.min(max * 60, 12 * 60));
        if (s.includes("m")) return Math.max(15, Math.min(max, 12 * 60));
        return Math.max(15, Math.min(max, 12 * 60));
    }

    let minutes = 0;
    const hMatch = s.match(/(\d+)\s*h/);
    const mMatch = s.match(/(\d+)\s*m/);
    if (hMatch) minutes += parseInt(hMatch[1], 10) * 60;
    if (mMatch) minutes += parseInt(mMatch[1], 10);
    if (minutes === 0) {
        const num = s.match(/(\d+)/);
        minutes = num ? parseInt(num[1], 10) : fallbackMinutes;
    }
    return Math.max(15, Math.min(minutes, 12 * 60));
};

const getLocalDateKey = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const DEFAULT_TIME_SLOTS = [
    "07:00 AM", "07:30 AM", "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
    "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM",
    "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM", "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM"
];

const SlotSelectionModal = ({ isOpen, onClose, onSave, address }) => {
    const { selectedSlot, setSelectedSlot, cartItems, setBookingType } = useCart();
    const { gender } = useGenderTheme();
    const { bookingTypeConfig, categories, officeSettings } = useUserModuleData();

    const [tempDate, setTempDate] = useState(selectedSlot?.date || null);
    const [tempSlot, setTempSlot] = useState(selectedSlot?.time || null);
    const [selectedProvider, setSelectedProvider] = useState(selectedSlot?.provider || undefined);

    const [providersLoading, setProvidersLoading] = useState(false);
    const [recentProviders, setRecentProviders] = useState([]);
    const [bookingMode, setBookingMode] = useState(null);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [slotMap, setSlotMap] = useState({});

    const serviceTypes = useMemo(() => {
        return [...new Set((cartItems || []).map(item => item.serviceType).filter(Boolean))];
    }, [cartItems]);

    const serviceCategories = useMemo(() => {
        return [...new Set((cartItems || []).map(item => item.category).filter(Boolean))];
    }, [cartItems]);

    const totalDurationMinutes = useMemo(() => {
        if (!Array.isArray(cartItems) || cartItems.length === 0) return 0;
        return cartItems.reduce((sum, item) => {
            const per = parseDurationToMinutes(item?.duration, 60);
            const qty = Number(item?.quantity || 1);
            return sum + (per * (Number.isFinite(qty) ? qty : 1));
        }, 0);
    }, [cartItems]);

    const providerList = useMemo(() => {
        // Filter providers based on eligibility for the current cart services
        // A provider must support ALL selected categories to be shown here
        return recentProviders.filter(p => {
            if (!serviceCategories || serviceCategories.length === 0) return true;
            
            // Check if provider has the required categories
            const pCats = Array.isArray(p.categories) ? p.categories : [];
            return serviceCategories.every(catId => pCats.includes(catId));
        });
    }, [recentProviders, serviceCategories]);

    useEffect(() => {
        let cancelled = false;
        if (isOpen) {
            const todayKey = getLocalDateKey();
            setTempDate(selectedSlot?.date || todayKey);
            setTempSlot(selectedSlot?.time || null);
            setAvailableSlots([]);

            setProvidersLoading(true);
            api.users.providerSuggestions({
                serviceTypes: serviceTypes.join(","),
                limit: "10",
                city: address?.city || address?.area || "",
                zone: address?.zone || address?.area || ""
            }).then((res) => {
                if (cancelled) return;
                const recent = Array.isArray(res?.recentProviders) ? res.recentProviders : [];
                const isFirst = !!res?.isFirstBooking;
                const mode = res?.mode === "new_user" || isFirst ? "new_user" : "repeat_user";
                setRecentProviders(mode === "repeat_user" ? recent : []);
                setBookingMode(mode);
                
                // Prioritize existing selected provider, otherwise default to "Any Professional" (null)
                // for repeat users to show maximum availability first.
                const next = selectedSlot?.provider?.id
                    ? (recent.find(p => p.id === selectedSlot.provider.id) || null)
                    : (selectedProvider === undefined ? null : selectedProvider);
                setSelectedProvider(next);
            }).catch(() => {
                if (cancelled) return;
                setRecentProviders([]);
                setSelectedProvider(null);
                setBookingMode("repeat_user");
            }).finally(() => {
                if (!cancelled) setProvidersLoading(false);
            });
        }
        return () => { cancelled = true; };
    }, [isOpen, selectedSlot?.date, selectedSlot?.time, selectedSlot?.provider?.id, serviceTypes, address]);

    const fetchSlots = async () => {
        if (!tempDate) return;
        setSlotsLoading(true);
        try {
            // If a specific provider is selected, we only show their free slots.
            // If "Any Professional" is selected (providerId is null), we show all slots where ANY pro is free.
            const pId = selectedProvider?.id || selectedProvider?._id;
            const params = {
                date: tempDate,
                serviceTypes: serviceTypes.join(","),
                categories: serviceCategories.join(","),
                city: address?.city || address?.area || "",
                zone: address?.zone || address?.area || ""
            };
            if (pId) params.providerId = pId;
            if (totalDurationMinutes > 0) params.durationMinutes = String(totalDurationMinutes);

            const { slots: rawSlots, slotMap: rawMap } = await api.providers.availableSlotsByDate(params);
            setAvailableSlots(rawSlots || []);
            setSlotMap(rawMap || {});
        } catch (e) {
            console.error("Failed to fetch slots:", e);
            setAvailableSlots([]);
        } finally {
            setSlotsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchSlots();
        }
    }, [isOpen, tempDate, selectedProvider, totalDurationMinutes, serviceTypes, serviceCategories, address?.city, address?.zone, address?.area]);

    const dates = useMemo(() => {
        let maxDays = 7; // Default

        // Find if cart has scheduled or instant items
        const hasScheduled = cartItems.some(item => {
            const cat = categories?.find(c => c.id === item.category);
            return (cat?.bookingType) === "scheduled";
        });

        // Config block defaults
        const schedConfig = bookingTypeConfig?.find(b => b.id === "scheduled");
        const instConfig = bookingTypeConfig?.find(b => b.id === "instant");

        if (hasScheduled) {
            maxDays = schedConfig?.maxAdvanceDays || 30;
        } else {
            // For Instant, take the max of allowedAdvanceDays array, default to 7
            let allowedArray = instConfig?.allowedAdvanceDays || [2, 5, 7];
            if (!Array.isArray(allowedArray)) allowedArray = [allowedArray];
            maxDays = Math.max(...allowedArray, 7);
        }

        return Array.from({ length: maxDays }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            return {
                label: d.toLocaleDateString("en-IN", { weekday: "short" }),
                date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
                key: getLocalDateKey(d),
                isToday: i === 0,
            };
        });
    }, [cartItems, categories, bookingTypeConfig]);

    const slots = useMemo(() => {
        // Backend already handles office hours and lead time filtering.
        // We just use the availableSlots returned.
        return availableSlots;
    }, [availableSlots]);

    const todayKey = getLocalDateKey();
    const isToday = tempDate === todayKey;
    const nextAvailableSlot = slots.length > 0 ? slots[0] : null;

    const handleSave = () => {
        if (tempDate && tempSlot) {
            const next = { date: tempDate, time: tempSlot };
            if (bookingMode === "repeat_user" && selectedProvider) {
                next.provider = selectedProvider;
            }
            setSelectedSlot(next);
            
            // Set booking type based on date: Today = Instant, Future = Scheduled
            const todayKey = getLocalDateKey();
            if (tempDate === todayKey) {
                setBookingType("instant");
            } else {
                setBookingType("scheduled");
            }

            onSave?.();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-10 sm:items-center sm:p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative w-full max-w-lg bg-background rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                >
                    {/* Fixed Header */}
                    <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-background z-10">
                        <div>
                            <h2 className="text-xl font-bold font-display uppercase tracking-tight">Select Slot</h2>
                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">
                                Choose professional & time
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-accent transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="overflow-y-auto hide-scrollbar p-6 space-y-6">

                        {/* Provider Selection */}
                        {bookingMode === "repeat_user" && (
                            <div>
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <UserCheck className="w-4 h-4 text-primary" /> Your Previous Professionals
                                </h3>
                                <div className="space-y-3">
                                    {/* Any Professional Button */}
                                    <button
                                        onClick={() => setSelectedProvider(null)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${selectedProvider === null
                                            ? "border-primary bg-primary/5 shadow-md"
                                            : "border-border glass hover:border-primary/20"
                                            }`}
                                    >
                                        <div className="relative">
                                            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <Users className="w-7 h-7 text-primary" />
                                            </div>
                                            {selectedProvider === null && (
                                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h4 className="font-bold text-sm truncate">Any Professional</h4>
                                                <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                    Best Availability
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground font-medium">
                                                Let us assign the best available professional
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0">
                                            <ShieldCheck className="w-6 h-6 text-green-500/40" />
                                        </div>
                                    </button>

                                    {providersLoading && (
                                        <div className="text-[10px] text-muted-foreground font-bold px-4 py-3 rounded-xl border border-border/40 glass">
                                            Loading professionals...
                                        </div>
                                    )}
                                    {!providersLoading && providerList.length === 0 && (
                                        <div className="text-[10px] text-muted-foreground font-bold px-4 py-3 rounded-xl border border-border/40 glass">
                                            No previous professionals found. Select "Any Professional" to get started.
                                        </div>
                                    )}
                                    {!providersLoading && providerList.map((provider, i) => (
                                        <button
                                            key={provider._id || provider.id || i}
                                            onClick={() => setSelectedProvider(provider)}
                                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${selectedProvider?.id === provider.id
                                                ? "border-primary bg-primary/5 shadow-md"
                                                : "border-border glass hover:border-primary/20"
                                                }`}
                                        >
                                            <div className="relative">
                                                <img src={provider.profilePhoto || provider.image} className="w-14 h-14 rounded-xl object-cover" alt={provider.name} />
                                                {selectedProvider?.id === provider.id && (
                                                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 text-left min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h4 className="font-bold text-sm truncate">{provider.name}</h4>
                                                    <span className="text-[8px] font-black uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                                                        {provider.bookingCount > 1 
                                                            ? `${provider.bookingCount}x Booked` 
                                                            : "Previously booked"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> {provider.rating}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-muted-foreground">• {provider.experience}</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground">• {provider.totalJobs} jobs</span>
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0">
                                                <ShieldCheck className="w-6 h-6 text-green-500/40" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Date Selection */}
                        <div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-primary" /> Select Date
                            </h3>
                            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                                {dates.map((d) => (
                                    <button
                                        key={d.key}
                                        onClick={() => setTempDate(d.key)}
                                        className={`flex-shrink-0 px-4 py-3 rounded-xl text-center text-xs transition-all duration-200 min-w-[70px] border-2 ${tempDate === d.key
                                            ? "bg-primary text-white border-primary shadow-lg scale-105"
                                            : "glass border-border hover:border-primary/30"
                                            }`}
                                    >
                                        <div className="font-bold">{d.label}</div>
                                        <div className="mt-1 text-[10px] opacity-80">{d.date}</div>
                                        {d.isToday && (
                                            <div className={`text-[8px] font-black mt-1 uppercase ${tempDate === d.key ? "text-white/90" : "text-primary"}`}>
                                                Today
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Time Slots */}
                        <div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-primary" /> Select Time Slot
                            </h3>
                            {isToday && nextAvailableSlot && (
                                <div className="mb-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Next Available Slot After Lead Time</p>
                                        <p className="text-xs font-bold text-emerald-900 mt-0.5">{nextAvailableSlot}</p>
                                    </div>
                                    <button
                                        onClick={() => setTempSlot(nextAvailableSlot)}
                                        className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-emerald-600 text-white shadow-sm"
                                    >
                                        Book Next
                                    </button>
                                </div>
                            )}
                            {isToday && !slotsLoading && slots.length === 0 && (
                                <div className="mb-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60 text-[10px] font-bold text-amber-700">
                                    No slots available for today after lead time. Please choose another date.
                                </div>
                            )}
                            <div className="grid grid-cols-4 gap-2">
                                {slotsLoading && (
                                    <div className="col-span-4 text-[10px] text-muted-foreground font-bold px-4 py-3 rounded-xl border border-border/40 glass">
                                        Loading available slots...
                                    </div>
                                )}
                                {!slotsLoading && DEFAULT_TIME_SLOTS.map((slot) => {
                                    const isAvailable = slotMap[slot] === true;
                                    const isSelected = tempSlot === slot;
                                    
                                    return (
                                        <button
                                            key={slot}
                                            onClick={() => isAvailable && setTempSlot(slot)}
                                            disabled={!isAvailable && !isSelected}
                                            className={`px-2 py-2.5 rounded-xl text-[10px] font-bold text-center border-2 transition-all duration-200 ${
                                                isSelected
                                                    ? "bg-primary text-white border-primary shadow-md scale-105"
                                                    : isAvailable
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100/50"
                                                        : "glass border-border text-muted-foreground/40 opacity-50 cursor-not-allowed"
                                            }`}
                                        >
                                            {slot}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Fixed Footer */}
                    <div className="p-6 bg-background border-t border-border">
                        <Button
                            onClick={handleSave}
                            disabled={!tempDate || !tempSlot}
                            className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 bg-black text-white hover:bg-black/90 flex items-center justify-center space-x-2 border-none"
                        >
                            <span>SECURE PROFESSIONAL</span>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground mt-3 font-medium">
                            Free cancellation up to 4 hours before service
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default SlotSelectionModal;

