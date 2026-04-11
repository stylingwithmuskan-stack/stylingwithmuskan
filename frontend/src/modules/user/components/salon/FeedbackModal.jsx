import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, MessageSquare, Send, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/modules/user/lib/api";

const FeedbackModal = ({ isOpen, onClose, booking, onSubmit }) => {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const tags = ["Professional", "On Time", "Great Service", "Clean", "Friendly", "Value for Money"];
    const [selectedTags, setSelectedTags] = useState([]);

    const toggleTag = (t) => setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

    const handleSubmit = async () => {
        if (rating === 0) return;
        
        setSubmitting(true);
        
        const feedback = {
            id: `FB${Date.now()}`,
            bookingId: booking?.id || booking?._id,
            customerName: booking?.customerName || booking?.address?.name || "Customer",
            providerName: booking?.slot?.provider?.name || booking?.assignedProvider || "Provider",
            serviceName: booking?.items?.[0]?.name || booking?.services?.[0]?.name || "Service",
            rating,
            comment,
            tags: selectedTags,
            type: "customer_to_provider",
            createdAt: new Date().toISOString(),
        };

        try {
            // Submit to backend
            await api.feedback.submit(booking?.id || booking?._id, {
                rating,
                comment,
                tags: selectedTags,
            });

            // Also save to localStorage for backward compatibility
            const existing = JSON.parse(localStorage.getItem("muskan-feedback") || "[]");
            // Remove any existing entry for this bookingId to avoid duplicates
            const filtered = existing.filter(f => f.bookingId !== (booking?.id || booking?._id));
            filtered.unshift(feedback);
            localStorage.setItem("muskan-feedback", JSON.stringify(filtered));

            if (onSubmit) onSubmit(feedback);
            
            setSubmitted(true);
            toast.success("Thank you for your feedback!");
            
            setTimeout(() => {
                setSubmitted(false);
                setRating(0);
                setComment("");
                setSelectedTags([]);
                onClose();
            }, 2000);
        } catch (error) {
            const alreadySubmitted = error?.status === 400 && /already submitted/i.test(error?.message || "");
            if (alreadySubmitted) {
                const existing = JSON.parse(localStorage.getItem("muskan-feedback") || "[]");
                const exists = existing.some(f => f.bookingId === (booking?.id || booking?._id) && f.type === "customer_to_provider");
                if (!exists) {
                    existing.unshift(feedback);
                    localStorage.setItem("muskan-feedback", JSON.stringify(existing));
                }
                if (onSubmit) onSubmit(feedback);
                toast.success("Feedback already recorded for this booking.");
                onClose();
                return;
            }
            toast.error(error?.message || "Failed to submit feedback");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
                <motion.div
                    initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
                    className="relative w-full max-w-md bg-background rounded-t-[32px] sm:rounded-[32px] border border-border p-6 pb-8 sm:pb-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
                >
                    {submitted ? (
                        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-12 text-center space-y-4">
                            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                                <ThumbsUp className="w-10 h-10 text-green-600" />
                            </div>
                            <h3 className="text-xl font-black tracking-tight">Thank You!</h3>
                            <p className="text-sm text-muted-foreground font-medium">Your feedback helps us improve our services.</p>
                        </motion.div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">Rate Your Experience</h3>
                                    <p className="text-xs text-muted-foreground font-medium mt-0.5">How was your service?</p>
                                </div>
                                <button onClick={onClose} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Service Info */}
                            <div className="bg-accent/50 rounded-2xl p-3 mb-5 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{booking?.items?.[0]?.name || booking?.services?.[0]?.name || "Service"}</p>
                                    <p className="text-[10px] text-muted-foreground font-medium">Booking #{booking?.id}</p>
                                </div>
                            </div>

                            {/* Stars */}
                            <div className="text-center mb-5">
                                <div className="flex justify-center gap-2 mb-2">
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <motion.button 
                                            key={s}
                                            animate={rating === 0 ? { scale: [1, 1.1, 1] } : {}}
                                            transition={{ repeat: rating === 0 ? Infinity : 0, duration: 2, delay: s * 0.1 }}
                                            onMouseEnter={() => setHoverRating(s)}
                                            onMouseLeave={() => setHoverRating(0)}
                                            onClick={() => setRating(s)}
                                            className="transition-transform hover:scale-125 active:scale-95"
                                        >
                                            <Star className={`w-9 h-9 transition-colors ${s <= (hoverRating || rating) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                                        </motion.button>
                                    ))}
                                </div>
                                <p className={`text-xs font-bold transition-colors ${rating === 0 ? "text-primary animate-pulse" : "text-muted-foreground"}`}>
                                    {rating === 0 ? "Select stars to enable submit" : rating <= 2 ? "We'll do better!" : rating <= 3 ? "Good" : rating === 4 ? "Great!" : "Excellent! 🎉"}
                                </p>
                            </div>

                            {/* Quick Tags */}
                            <div className="flex flex-wrap gap-2 mb-5">
                                {tags.map(t => (
                                    <button key={t} onClick={() => toggleTag(t)}
                                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${selectedTags.includes(t) ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-105" : "bg-accent border-border text-muted-foreground hover:border-primary/30"}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            {/* Comment */}
                            <textarea
                                value={comment} onChange={e => setComment(e.target.value)}
                                placeholder="Tell us more about your experience (optional)..."
                                rows={3}
                                className="w-full px-4 py-3 bg-accent/50 border border-border/50 rounded-2xl text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all mb-5"
                            />

                            {/* Submit */}
                            <button
                                onClick={() => {
                                    if (rating === 0) {
                                        toast.error("Please select a star rating first");
                                        return;
                                    }
                                    handleSubmit();
                                }}
                                disabled={submitting}
                                className={`w-full h-13 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${rating > 0 && !submitting ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.01]" : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"}`}
                            >
                                <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Review"}
                            </button>
                        </>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};

export default FeedbackModal;
