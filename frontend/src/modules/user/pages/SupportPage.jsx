import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { ArrowLeft, MessageSquare, Phone, Mail, ChevronDown, ChevronUp, Search, ExternalLink } from "lucide-react";

const faqs = [
    { q: "How do I book a service?", a: "To book a service, go to the Home or Explore page, select your desired service, pick a date and time slot, and proceed to payment. You can choose from Booked, Pre-Book, or Customized booking types." },
    { q: "What should I prepare for a home service?", a: "Please ensure a clean area for the service and access to water/electricity if needed. Our professionals bring all necessary products and kits." },
    { q: "How do I cancel or reschedule?", a: "You can manage your bookings in the 'My Bookings' section. Cancellation is free up to 4 hours before the service time." },
    { q: "Are your professionals certified?", a: "Yes, all our beauticians and stylists are 100% background-verified, certified, and trained to follow strict hygiene protocols." },
];

const SupportPage = () => {
    const navigate = useNavigate();
    const { gender } = useGenderTheme();
    const [openFaq, setOpenFaq] = useState(0);

    return (
        <div className="min-h-screen bg-background pb-8">
            {/* Header */}
            <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>Help & Support</h1>
            </div>

            <div className="px-4 max-w-2xl mx-auto mt-6 space-y-8">
                {/* Contact Options */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { icon: MessageSquare, label: "Chat", color: "text-blue-500", bg: "bg-blue-50" },
                        { icon: Phone, label: "Call", color: "text-green-500", bg: "bg-green-50" },
                        { icon: Mail, label: "Email", color: "text-amber-500", bg: "bg-amber-50" },
                    ].map((opt, i) => (
                        <button key={i} className="flex flex-col items-center gap-3 p-4 rounded-2xl glass-strong border border-border/50 hover:border-primary/30 transition-all">
                            <div className={`w-12 h-12 rounded-xl ${opt.bg} ${opt.color} flex items-center justify-center`}>
                                <opt.icon className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold">{opt.label}</span>
                        </button>
                    ))}
                </div>

                {/* FAQ Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-base font-bold">Frequently Asked Questions</h3>
                        <button className="text-xs font-bold text-primary flex items-center gap-1">
                            View All <ExternalLink className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search for topics, issues..."
                            className="w-full h-12 pl-12 pr-4 rounded-xl bg-accent border-none text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>

                    <div className="space-y-3">
                        {faqs.map((faq, i) => (
                            <div
                                key={i}
                                className={`rounded-2xl border transition-all duration-300 ${openFaq === i ? 'bg-primary/5 border-primary/20 p-5' : 'glass-strong border-border/50 p-4'}`}
                            >
                                <button
                                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                                    className="w-full flex items-center justify-between text-left"
                                >
                                    <span className="text-sm font-bold pr-4">{faq.q}</span>
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
                                            <p className="text-xs text-muted-foreground mt-3 leading-relaxed border-t border-primary/10 pt-3">
                                                {faq.a}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tracking Note */}
                <div className="p-4 rounded-2xl bg-accent/50 border border-border/50 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold">Have a feedback?</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-1">We'd love to hear your thoughts on how we can improve our service.</p>
                        <button className="text-[10px] font-bold text-primary mt-2 uppercase tracking-wider">Submit Feedback</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupportPage;
