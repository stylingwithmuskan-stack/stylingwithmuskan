import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Phone, MessageSquare, MapPin, ExternalLink, Instagram, Facebook, Twitter } from "lucide-react";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";

const ContactUsPage = () => {
  const navigate = useNavigate();
  const { gender } = useGenderTheme();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

    const supportPhone = import.meta.env.VITE_SUPPORT_PHONE || "9990000001";
    const formattedPhone = `+91 ${supportPhone.slice(0, 5)} ${supportPhone.slice(5)}`;

    const contacts = [
        { 
            icon: Phone, 
            label: "Call Us", 
            value: formattedPhone, 
            action: `tel:+91${supportPhone}` 
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
            action: `https://wa.me/91${supportPhone}?text=Hello%20Styling%20With%20Muskan,%20I%20need%20assistance.` 
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 p-8 rounded-3xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <h3 className={`text-lg font-black mb-2 ${gender === "women" ? "font-display text-primary" : "font-heading-men text-primary"}`}>
              Connect on Social Media
            </h3>
            <p className="text-xs text-muted-foreground mb-6 font-medium">Follow us for beauty tips, trends & exclusive offers</p>
            
            <div className="flex justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.open("https://instagram.com/stylingwithmuskan", "_blank")}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all"
              >
                <Instagram className="w-6 h-6" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.open("https://facebook.com/stylingwithmuskan", "_blank")}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all"
              >
                <Facebook className="w-6 h-6" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.open("https://twitter.com/stylingwmuskan", "_blank")}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-400 flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all"
              >
                <Twitter className="w-6 h-6" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ContactUsPage;
