import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Phone, MessageSquare, MapPin, ExternalLink } from "lucide-react";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";

const ContactUsPage = () => {
  const navigate = useNavigate();
  const { gender } = useGenderTheme();

  const contacts = [
    { icon: Phone, label: "Call Us", value: "+91 999 000 0001", action: "tel:+919990000001" },
    { icon: Mail, label: "Email Support", value: "support@swm.com", action: "mailto:support@swm.com" },
    { icon: MessageSquare, label: "Live Chat", value: "Chat with us in real-time", action: "/support" },
    { icon: MapPin, label: "Visit Our Hub", value: "Main Market, Sector 15, Gurgaon", action: "#" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>Contact Us</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto mt-8 space-y-4">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-black text-foreground">How can we help?</h2>
          <p className="text-sm text-muted-foreground mt-2">We're available 9:00 AM - 9:00 PM to assist you with any questions or bookings.</p>
        </div>

        {contacts.map((contact, i) => (
          <motion.div
            key={contact.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => contact.action.startsWith("/") ? navigate(contact.action) : window.open(contact.action, "_blank")}
            className="glass-strong rounded-2xl p-5 border border-border/50 flex items-center gap-5 cursor-pointer hover:bg-accent/50 transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <contact.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">{contact.label}</p>
              <p className="font-bold text-foreground text-sm">{contact.value}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground opacity-30" />
          </motion.div>
        ))}

        <div className="mt-12 p-6 rounded-3xl bg-primary/5 border border-primary/10 text-center">
          <h3 className="font-bold text-primary mb-2">Connect on Social Media</h3>
          <div className="flex justify-center gap-6 mt-4">
            <div className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-primary shadow-sm">
                <span className="font-black text-xs">IG</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-primary shadow-sm">
                <span className="font-black text-xs">FB</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-primary shadow-sm">
                <span className="font-black text-xs">TW</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUsPage;
