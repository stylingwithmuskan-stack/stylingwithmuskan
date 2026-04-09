import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Phone, MessageSquare, MapPin, ExternalLink, Instagram, Facebook, Twitter } from "lucide-react";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";

const ContactUsPage = () => {
    const navigate = useNavigate();
    const { gender } = useGenderTheme();

    // Fix: Ensure page opens from the top
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const contacts = [
        { 
            icon: Phone, 
            label: "Call Us", 
            value: "+91 999 000 0001", 
            action: "tel:+919990000001" 
        },
        { 
            icon: Mail, 
            label: "Email Support", 
            value: "support@stylingwithmuskan.com", 
            action: "mailto:support@stylingwithmuskan.com" 
        },
        { 
            icon: MessageSquare, 
            label: "Live Chat", 
            value: "WhatsApp us for instant support", 
            action: "https://wa.me/919990000001?text=Hello%20Styling%20With%20Muskan,%20I%20need%20assistance." 
        },
        { 
            icon: MapPin, 
            label: "Visit Our Hub", 
            value: "Main Market, Sector 15, Gurgaon, Haryana", 
            action: "https://www.google.com/maps/search/?api=1&query=Main+Market+Sector+15+Gurgaon" 
        },
    ];

    const socialLinks = [
        { icon: Instagram, label: "Instagram", url: "https://instagram.com/stylingwithmuskan", color: "hover:text-pink-600" },
        { icon: Facebook, label: "Facebook", url: "https://facebook.com/stylingwithmuskan", color: "hover:text-blue-600" },
        { icon: Twitter, label: "Twitter", url: "https://twitter.com/stylingwithmuskan", color: "hover:text-sky-500" },
    ];

    return (
        <div className="min-h-screen bg-background pb-24 font-sans">
            <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className={`text-lg font-black uppercase tracking-tight ${gender === "women" ? "font-display" : "font-heading-men"}`}>Contact Us</h1>
            </div>

            <div className="px-4 max-w-2xl mx-auto mt-8 space-y-4">
                <div className="text-center mb-8">
                    <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4"
                    >
                        <MessageSquare className="w-10 h-10 text-primary" />
                    </motion.div>
                    <h2 className="text-2xl font-black text-foreground">How can we help?</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed font-medium">We're available 9:00 AM - 9:00 PM to assist you with any questions or bookings.</p>
                </div>

                {contacts.map((contact, i) => (
                    <motion.div
                        key={contact.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => {
                            if (contact.action.startsWith("http")) {
                                window.open(contact.action, "_blank");
                            } else if (contact.action.startsWith("/")) {
                                navigate(contact.action);
                            } else {
                                window.location.href = contact.action;
                            }
                        }}
                        className="glass-strong rounded-2xl p-5 border border-border/50 flex items-center gap-5 cursor-pointer hover:bg-accent/50 transition-all active:scale-[0.98] group"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                            <contact.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">{contact.label}</p>
                            <p className="font-bold text-foreground text-sm leading-tight">{contact.value}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                ))}

                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-12 p-8 rounded-[32px] bg-accent/50 border border-border/50 text-center"
                >
                    <h3 className="font-black text-lg text-foreground mb-1">Connect on Social Media</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">Stay updated with our latest offers</p>
                    <div className="flex justify-center gap-8">
                        {socialLinks.map((social) => (
                            <button 
                                key={social.label}
                                onClick={() => window.open(social.url, "_blank")}
                                className={`w-14 h-14 rounded-2xl bg-white border border-border flex items-center justify-center text-muted-foreground transition-all hover:scale-110 active:scale-90 shadow-sm ${social.color} hover:border-primary/20 hover:shadow-md`}
                            >
                                <social.icon className="w-6 h-6" />
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default ContactUsPage;
