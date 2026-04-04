import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Phone, MessageSquare, MapPin, ExternalLink } from "lucide-react";

const VenderContactUsPage = () => {
  const navigate = useNavigate();

  const contacts = [
    { icon: Phone, label: "Call Vendor Support", value: "+91 999 000 0003", action: "tel:+919990000003" },
    { icon: Mail, label: "Email Support", value: "vendor@swm.com", action: "mailto:vendor@swm.com" },
    { icon: MessageSquare, label: "Business Inquiries", value: "Chat with our team", action: "#" },
    { icon: MapPin, label: "Head Office", value: "Main Market, Sector 15, Gurgaon", action: "#" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-semibold">Contact Us</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto mt-8 space-y-4">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-foreground">How can we help?</h2>
          <p className="text-sm text-muted-foreground mt-2">Vendor support available 9:00 AM - 9:00 PM for business assistance.</p>
        </div>

        {contacts.map((contact, i) => (
          <motion.div
            key={contact.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => contact.action.startsWith("/") ? navigate(contact.action) : window.open(contact.action, "_blank")}
            className="bg-white rounded-2xl p-5 border border-border/50 flex items-center gap-5 cursor-pointer hover:bg-accent/50 transition-all active:scale-[0.98] shadow-sm"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <contact.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">{contact.label}</p>
              <p className="font-bold text-foreground text-sm">{contact.value}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground opacity-30" />
          </motion.div>
        ))}

        <div className="mt-12 p-6 rounded-3xl bg-emerald-50 border border-emerald-100 text-center">
          <h3 className="font-bold text-emerald-600 mb-2">Connect on Social Media</h3>
          <div className="flex justify-center gap-6 mt-4">
            <div className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-emerald-600 shadow-sm">
                <span className="font-black text-xs">IG</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-emerald-600 shadow-sm">
                <span className="font-black text-xs">FB</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-emerald-600 shadow-sm">
                <span className="font-black text-xs">TW</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenderContactUsPage;
