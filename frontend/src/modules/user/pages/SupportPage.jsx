import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { ArrowLeft, MessageSquare, Phone, Mail, ChevronDown, ChevronUp, Search, ExternalLink } from "lucide-react";

const faqs = [
    { q: "How do I book a service?", a: "To book a service, go to the Home or Explore page, select your desired service, pick a date and time slot, and proceed to payment. You can choose from Booked, Pre-Book, or Customized booking types." },
    { q: "What should I prepare for a home service?", a: "Please ensure a clean area for the service and access to water/electricity if needed. Our professionals bring all necessary products and kits." },
    { q: "How do I cancel or reschedule?", a: "You can manage your bookings in the 'My Bookings' section. Cancellation is free up to 4 hours before the service time." },
    { q: "Are your professionals certified?", a: "Yes, all our beauticians and stylists are 100% background-verified, certified, and trained to follow strict hygiene protocols." },
    { q: "What are your service timings?", a: "Our professionals are available from 9:00 AM to 9:00 PM every day. You can book slots at your convenience." },
    { q: "Can I choose my favorite professional?", a: "Yes! If you have had a great experience with a particular professional, you can select them during the booking process if they are available." },
];

const SupportPage = () => {
    const navigate = useNavigate();
    const { gender } = useGenderTheme();
    const [openFaq, setOpenFaq] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");

    // Fix: Ensure page opens from the top
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const filteredFaqs = faqs.filter(f => 
        f.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
        f.a.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const supportPhone = import.meta.env.VITE_SUPPORT_PHONE || "9990000001";

    const contactOpts = [
        { 
            icon: MessageSquare, 
            label: "Chat", 
            color: "text-blue-500", 
            bg: "bg-blue-50", 
            action: () => window.open(`https://wa.me/91${supportPhone}?text=Hi%20SWM%20Support,%20I%20have%20a%20query.`, "_blank") 
        },
        { 
            icon: Phone, 
            label: "Call", 
            color: "text-green-500", 
            bg: "bg-green-50", 
            action: () => window.location.href = `tel:+91${supportPhone}` 
        },
        { 
            icon: Mail, 
            label: "Email", 
            color: "text-amber-500", 
            bg: "bg-amber-50", 
            action: () => window.location.href = "mailto:support@stylingwithmuskan.com" 
        },
    ];

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center hover:bg-black/5 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className={`text-lg font-black tracking-tight ${gender === "women" ? "font-display" : "font-heading-men"}`}>Help & Support</h1>
            </div>

            <div className="px-4 max-w-2xl mx-auto mt-6 space-y-8">
                {/* Contact Options */}
                <div className="grid grid-cols-3 gap-3">
                    {contactOpts.map((opt, i) => (
                        <button 
                            key={i} 
                            onClick={opt.action}
                            className="flex flex-col items-center gap-3 p-4 rounded-2xl glass-strong border border-border/50 hover:border-primary/30 transition-all active:scale-95 group"
                        >
                            <div className={`w-12 h-12 rounded-xl ${opt.bg} ${opt.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                                <opt.icon className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-tighter">{opt.label}</span>
                        </button>
                    ))}
                </div>

                {/* FAQ Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-base font-black">Common Questions</h3>
                        <button 
                            onClick={() => {
                                setSearchQuery("");
                                setOpenFaq(0);
                                window.scrollTo({ top: 300, behavior: 'smooth' });
                            }}
                            className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                        >
                            View All <ExternalLink className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="relative group">
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchQuery ? 'text-primary' : 'text-muted-foreground'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search for topics, issues..."
                            className="w-full h-13 pl-12 pr-4 rounded-2xl bg-accent/50 border border-transparent focus:bg-white focus:border-primary/20 text-sm font-bold transition-all shadow-sm"
                        />
                    </div>

                    <div className="space-y-3 min-h-[200px]">
                        {filteredFaqs.length > 0 ? (
                            filteredFaqs.map((faq, i) => (
                                <motion.div
                                    key={faq.q}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`rounded-2xl border transition-all duration-300 ${openFaq === i ? 'bg-primary/5 border-primary/20 p-5 shadow-sm' : 'glass-strong border-border/50 p-4'}`}
                                >
                                    <button
                                        onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                                        className="w-full flex items-center justify-between text-left"
                                    >
                                        <span className={`text-sm font-bold pr-4 transition-colors ${openFaq === i ? 'text-primary' : 'text-foreground'}`}>{faq.q}</span>
                                        {openFaq === i ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                    </button>
                                    <AnimatePresence>
                                        {openFaq === i && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <p className="text-[11px] font-medium text-muted-foreground mt-3 leading-relaxed border-t border-primary/10 pt-3">
                                                    {faq.a}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            ))
                        ) : (
                            <div className="py-12 text-center">
                                <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-xs font-bold text-muted-foreground">No matches found for "{searchQuery}"</p>
                                <button onClick={() => setSearchQuery("")} className="text-xs font-bold text-primary mt-2">Clear search</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Feedback Section */}
                <div className="p-6 rounded-[24px] bg-slate-900 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-125 transition-transform duration-700">
                        <MessageSquare className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-base font-black mb-1">Have a feedback?</p>
                        <p className="text-[11px] text-slate-400 leading-tight mb-5 font-medium">We'd love to hear your thoughts on how we can improve our service.</p>
                        <button 
                            onClick={() => navigate("/contact-us")}
                            className="bg-primary text-primary-foreground text-[10px] font-black uppercase px-6 py-2.5 rounded-xl active:scale-95 transition-all shadow-lg shadow-black/20"
                        >
                            Submit Feedback
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupportPage;
