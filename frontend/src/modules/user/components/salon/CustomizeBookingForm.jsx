import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, User, Phone, PartyPopper, Users, Calendar, Clock, CheckCircle2, Sparkles, LayoutGrid, CheckSquare, Square, Minus, Plus, ShoppingBag, ChevronRight, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { api } from "@/modules/user/lib/api";

const EVENT_TYPES = ["Bridal Event", "Birthday Party", "Kitty Party", "Corporate Event", "Festival Gathering", "Engagement", "Other"];

const CustomizeBookingForm = ({ isOpen, onClose }) => {
    const { gender } = useGenderTheme();
    const { categories, services } = useUserModuleData();
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        eventType: "",
        noOfPeople: "",
        date: "",
        timeSlot: "",
        selectedServices: [], // Array of { id, quantity, name, categoryName }
        notes: ""
    });

    const [activeCategoryId, setActiveCategoryId] = useState("");
    const [view, setView] = useState("form"); // "form" | "services" | "review"
    const [submitted, setSubmitted] = useState(false);
    const [errors, setErrors] = useState({});
    const [lastEnquiry, setLastEnquiry] = useState(null);

    // Filter categories by gender
    const filteredCategories = useMemo(() => 
        categories.filter(c => c.gender === gender || !c.gender),
        [categories, gender]
    );

    // Initial category
    useEffect(() => {
        if (isOpen && !activeCategoryId && filteredCategories.length > 0) {
            setActiveCategoryId(filteredCategories[0].id);
        }
    }, [isOpen, filteredCategories, activeCategoryId]);

    useEffect(() => {
        let cancelled = false;
        if (!isOpen) return;
        (async () => {
            try {
                const { enquiries } = await api.bookings.custom.list();
                if (cancelled) return;
                const list = Array.isArray(enquiries) ? enquiries : [];
                const latest = list
                    .slice()
                    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
                setLastEnquiry(latest || null);
            } catch {
                if (!cancelled) setLastEnquiry(null);
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen, submitted]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const toggleService = (service) => {
        setFormData(prev => {
            const existing = prev.selectedServices.find(s => s.id === service.id);
            if (existing) {
                return {
                    ...prev,
                    selectedServices: prev.selectedServices.filter(s => s.id !== service.id)
                };
            }
            const cat = categories.find(c => c.id === service.category);
            return {
                ...prev,
                selectedServices: [
                    ...prev.selectedServices,
                    { 
                        id: service.id, 
                        quantity: 1, 
                        name: service.name, 
                        categoryName: cat?.name || "General",
                        price: service.price 
                    }
                ]
            };
        });
    };

    const updateQuantity = (id, delta) => {
        setFormData(prev => ({
            ...prev,
            selectedServices: prev.selectedServices.map(s => {
                if (s.id === id) {
                    const newQty = Math.max(1, s.quantity + delta);
                    return { ...s, quantity: newQty };
                }
                return s;
            })
        }));
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = "Name is required";
        if (!formData.phone.trim() || formData.phone.length < 10) newErrors.phone = "Valid phone number required";
        if (!formData.eventType) newErrors.eventType = "Select event type";
        if (!formData.noOfPeople) newErrors.noOfPeople = "Enter number of people";
        if (formData.selectedServices.length === 0) newErrors.selectedServices = "Select at least one service";
        if (!formData.date) newErrors.date = "Select date";
        if (!formData.timeSlot) newErrors.timeSlot = "Select time slot";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) {
            setView("form");
            return;
        }
        try {
            const payload = {
                name: formData.name,
                phone: formData.phone,
                eventType: formData.eventType,
                noOfPeople: formData.noOfPeople,
                date: formData.date,
                timeSlot: formData.timeSlot,
                selectedServices: formData.selectedServices,
                notes: formData.notes,
                address: undefined
            };
            const { enquiry } = await api.bookings.custom.create(payload);
            setLastEnquiry(enquiry);
            setSubmitted(true);
        } catch (e) {
            alert(e?.message || "Failed to submit enquiry");
        }
    };

    const handleClose = () => {
        setSubmitted(false);
        setFormData({ 
            name: "", phone: "", eventType: "", noOfPeople: "", 
            date: "", timeSlot: "", selectedServices: [], notes: "" 
        });
        setErrors({});
        setView("form");
        onClose();
    };

    const totalSelectedCount = formData.selectedServices.reduce((acc, s) => acc + s.quantity, 0);

    const TIME_SLOTS = ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM"];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-10 sm:p-8 md:p-12">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 10 }}
                        className="relative w-full max-w-lg bg-background rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto"
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-background z-10 shrink-0">
                            <div>
                                <h2 className="text-lg font-bold font-display uppercase tracking-tight flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-500" /> {submitted ? "Request Sent" : "Customize Bulk Booking"}
                                </h2>
                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">
                                    {submitted ? "We will contact you soon" : "Professional Event Services"}
                                </p>
                            </div>
                            <button onClick={handleClose} className="p-2 rounded-full hover:bg-accent transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Navigation Stepper (Only if not submitted) */}
                        {!submitted && (
                            <div className="flex border-b border-border bg-muted/30 px-6 py-3 justify-between items-center shrink-0 overflow-x-auto hide-scrollbar gap-4">
                                {[
                                    { id: "form", label: "Details", icon: User },
                                    { id: "services", label: "Services", icon: LayoutGrid },
                                    { id: "review", label: "Review", icon: ShoppingBag },
                                ].map((step) => (
                                    <button
                                        key={step.id}
                                        onClick={() => setView(step.id)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                                            view === step.id 
                                            ? "bg-primary text-primary-foreground shadow-sm" 
                                            : "text-muted-foreground hover:bg-accent"
                                        }`}
                                    >
                                        <step.icon className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{step.label}</span>
                                        {step.id === "review" && totalSelectedCount > 0 && (
                                            <span className="w-4 h-4 bg-white text-primary rounded-full flex items-center justify-center text-[8px] font-black">
                                                {totalSelectedCount}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Content Area */}
                        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-6 space-y-5">
                            <AnimatePresence mode="wait">
                                {submitted ? (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="py-10 flex flex-col items-center gap-4"
                                    >
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 200, damping: 12 }}
                                            className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center"
                                        >
                                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                                        </motion.div>
                                        <h3 className="text-xl font-bold font-display text-center">Enquiry Submitted! 🎉</h3>
                                        <p className="text-sm text-muted-foreground text-center max-w-xs leading-relaxed font-medium">
                                            Our event manager will call you at <strong>{formData.phone}</strong> within <strong>2-4 hours</strong> with a customized quote according to your bulk requirements.
                                        </p>
                                        
                                        <div className="glass-strong rounded-2xl p-5 w-full border border-border/50 mt-4 space-y-4">
                                            <div>
                                                <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase mb-2">Event Info</p>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="p-2 bg-white/50 rounded-lg"><span className="opacity-60 block">Event</span><strong>{formData.eventType}</strong></div>
                                                    <div className="p-2 bg-white/50 rounded-lg"><span className="opacity-60 block">Date</span><strong>{formData.date}</strong></div>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase mb-2">Requested Services ({totalSelectedCount})</p>
                                                <div className="max-h-32 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                                                    {formData.selectedServices.map(s => (
                                                        <div key={s.id} className="flex justify-between items-center text-xs p-2 bg-accent/30 rounded-lg">
                                                            <span>{s.name} x {s.quantity}</span>
                                                            <span className="font-bold text-primary">{s.categoryName}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <Button onClick={handleClose} className="w-full h-12 rounded-2xl font-bold mt-4 bg-black text-white hover:bg-black/80">
                                            Done
                                        </Button>
                                    </motion.div>
                                ) : view === "form" ? (
                                    <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                            <User className="w-4 h-4" /> Personal Details
                                        </h3>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-2">Name</label>
                                                <input
                                                    type="text"
                                                    value={formData.name}
                                                    onChange={e => handleChange("name", e.target.value)}
                                                    placeholder="Full Name"
                                                    className={`w-full h-12 px-4 rounded-xl bg-accent/50 text-sm font-bold border-2 ${errors.name ? "border-destructive" : "border-transparent"}`}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-2">Phone</label>
                                                <input
                                                    type="tel"
                                                    value={formData.phone}
                                                    onChange={e => handleChange("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                                                    placeholder="10-digit mobile"
                                                    className={`w-full h-12 px-4 rounded-xl bg-accent/50 text-sm font-bold border-2 ${errors.phone ? "border-destructive" : "border-transparent"}`}
                                                />
                                            </div>
                                        </div>

                                        <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2 pt-2">
                                            <PartyPopper className="w-4 h-4" /> Event Logistics
                                        </h3>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-2">Event Type</label>
                                                <select
                                                    value={formData.eventType}
                                                    onChange={e => handleChange("eventType", e.target.value)}
                                                    className={`w-full h-12 px-3 rounded-xl bg-accent/50 text-xs font-bold border-2 ${errors.eventType ? "border-destructive" : "border-transparent"}`}
                                                >
                                                    <option value="">Select Event</option>
                                                    {EVENT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-2">Est. People</label>
                                                <select
                                                    value={formData.noOfPeople}
                                                    onChange={e => handleChange("noOfPeople", e.target.value)}
                                                    className={`w-full h-12 px-3 rounded-xl bg-accent/50 text-xs font-bold border-2 ${errors.noOfPeople ? "border-destructive" : "border-transparent"}`}
                                                >
                                                    <option value="">Number of People</option>
                                                    {["1-5", "5-10", "10-20", "20-50", "50+"].map(e => <option key={e} value={e}>{e}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-2">Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.date}
                                                    min={new Date().toISOString().split("T")[0]}
                                                    onChange={e => handleChange("date", e.target.value)}
                                                    className={`w-full h-12 px-3 rounded-xl bg-accent/50 text-xs font-bold border-2 ${errors.date ? "border-destructive" : "border-transparent"}`}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-2">Preferred Slot</label>
                                                <select
                                                    value={formData.timeSlot}
                                                    onChange={e => handleChange("timeSlot", e.target.value)}
                                                    className={`w-full h-12 px-3 rounded-xl bg-accent/50 text-xs font-bold border-2 ${errors.timeSlot ? "border-destructive" : "border-transparent"}`}
                                                >
                                                    <option value="">Select Time</option>
                                                    {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <Button 
                                            onClick={() => setView("services")}
                                            className="w-full h-14 rounded-2xl bg-black text-white hover:bg-black/90 font-bold gap-2 mt-2"
                                        >
                                            Pick Services <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </motion.div>
                                ) : view === "services" ? (
                                    <motion.div key="services" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                        {/* Category Tabs */}
                                        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 pt-1">
                                            {filteredCategories.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setActiveCategoryId(cat.id)}
                                                    className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-tight whitespace-nowrap border-2 transition-all ${
                                                        activeCategoryId === cat.id 
                                                        ? "bg-primary border-primary text-primary-foreground shadow-md" 
                                                        : "bg-white border-border text-muted-foreground hover:border-primary/20"
                                                    }`}
                                                >
                                                    {cat.name}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Services in selected category */}
                                        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                            {services.filter(s => s.category === activeCategoryId).map(service => {
                                                const selected = formData.selectedServices.find(s => s.id === service.id);
                                                return (
                                                    <div 
                                                        key={service.id}
                                                        className={`p-4 rounded-2xl border-2 transition-all ${
                                                            selected 
                                                            ? "bg-primary/5 border-primary shadow-sm" 
                                                            : "bg-accent/20 border-border/40 hover:border-primary/20"
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-start gap-4">
                                                            <div className="flex-1" onClick={() => toggleService(service)}>
                                                                <h4 className="text-sm font-bold leading-tight">{service.name}</h4>
                                                                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{service.description}</p>
                                                            </div>
                                                            <button 
                                                                onClick={() => toggleService(service)}
                                                                className={`p-2 rounded-xl transition-colors ${
                                                                    selected ? "text-primary" : "text-muted-foreground hover:bg-accent"
                                                                }`}
                                                            >
                                                                {selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                            </button>
                                                        </div>

                                                        {selected && (
                                                            <motion.div 
                                                                initial={{ opacity: 0, height: 0 }} 
                                                                animate={{ opacity: 1, height: "auto" }}
                                                                className="flex items-center justify-between mt-4 pt-4 border-t border-primary/10"
                                                            >
                                                                <span className="text-[10px] font-black uppercase text-primary">Quantity (People)</span>
                                                                <div className="flex items-center gap-3">
                                                                    <button 
                                                                        onClick={() => updateQuantity(service.id, -1)}
                                                                        className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center hover:bg-accent active:scale-95 transition-all text-muted-foreground"
                                                                    >
                                                                        <Minus className="w-3 h-3" />
                                                                    </button>
                                                                    <span className="text-sm font-black w-4 text-center">{selected.quantity}</span>
                                                                    <button 
                                                                        onClick={() => updateQuantity(service.id, 1)}
                                                                        className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center hover:bg-accent active:scale-95 transition-all text-primary"
                                                                    >
                                                                        <Plus className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3">
                                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                                                You can select services across <strong>multiple categories</strong>. Just tap other category tabs above to add more.
                                            </p>
                                        </div>

                                        <Button 
                                            disabled={totalSelectedCount === 0}
                                            onClick={() => setView("review")}
                                            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-2"
                                        >
                                            Review Request ({totalSelectedCount}) <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </motion.div>
                                ) : (
                                    <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-black uppercase tracking-widest text-primary">Review Selection</h3>
                                            <button onClick={() => setView("services")} className="text-[10px] font-black text-primary uppercase hover:underline">Add More</button>
                                        </div>

                                        <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
                                            {formData.selectedServices.map(s => (
                                                <div key={s.id} className="flex items-center justify-between p-4 bg-white border border-border rounded-2xl shadow-sm">
                                                    <div>
                                                        <h4 className="text-sm font-bold">{s.name}</h4>
                                                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tight">{s.categoryName}</p>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-2 px-3 py-1 bg-accent/30 rounded-full">
                                                            <span className="text-[10px] font-black text-muted-foreground">Qty:</span>
                                                            <span className="text-sm font-black">{s.quantity}</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => toggleService({ id: s.id })}
                                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            {formData.selectedServices.length === 0 && (
                                                <div className="py-12 text-center text-muted-foreground italic flex flex-col items-center gap-2">
                                                    <ShoppingBag className="w-8 h-8 opacity-20" />
                                                    <p className="text-sm">No services selected yet</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Special Notes</label>
                                            <textarea
                                                value={formData.notes}
                                                onChange={e => handleChange("notes", e.target.value)}
                                                placeholder="Any specific brand preferences or additional requirements?"
                                                rows={3}
                                                className="w-full p-4 rounded-2xl bg-accent/30 text-xs font-medium border-2 border-transparent focus:border-primary/20 outline-none"
                                            />
                                        </div>

                                        <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100 flex items-center gap-3">
                                            <Clock className="w-4 h-4 text-violet-500" />
                                            <p className="text-[10px] font-bold text-violet-900">
                                                Final quote will be prepared by our team based on your quantities.
                                            </p>
                                        </div>

                                        <Button 
                                            disabled={formData.selectedServices.length === 0}
                                            onClick={handleSubmit}
                                            className="w-full h-14 rounded-2xl bg-black text-white hover:bg-black/90 font-bold gap-2"
                                        >
                                            <Send className="w-4 h-4" /> Submit Bulk Enquiry
                                        </Button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Summary Sticky Bar (Only on services view) */}
                        {!submitted && view === "services" && totalSelectedCount > 0 && (
                            <motion.div 
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="px-6 py-4 bg-background border-t border-border flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <ShoppingBag className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black">{totalSelectedCount} Services</p>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none">Adding across categories</p>
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => setView("review")} className="font-bold rounded-xl h-9 px-4">
                                    Continue
                                </Button>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CustomizeBookingForm;
