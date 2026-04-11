import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Phone, MessageSquare, MapPin, ExternalLink, Instagram, Facebook, Twitter } from "lucide-react";

const ProviderContactUsPage = () => {
  const navigate = useNavigate();

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const contacts = [
    { icon: Phone, label: "Call Provider Support", value: "+91 999 000 0002", action: "tel:+919990000002" },
    { icon: Mail, label: "Email Support", value: "provider@swm.com", action: "mailto:provider@swm.com" },
    { icon: MessageSquare, label: "Live Chat", value: "Chat with support team", action: "/provider/support" },
    { icon: MapPin, label: "Visit Our Hub", value: "View all service zones on map", action: "/provider/all-zones" },
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
          <div className="w-20 h-20 rounded-3xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-10 h-10 text-violet-600" />
          </div>
          <h2 className="text-2xl font-black text-foreground">How can we help?</h2>
          <p className="text-sm text-muted-foreground mt-2">Provider support available 9:00 AM - 9:00 PM for any assistance.</p>
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
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600">
              <contact.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">{contact.label}</p>
              <p className="font-bold text-foreground text-sm">{contact.value}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground opacity-30" />
          </motion.div>
        ))}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 p-8 rounded-3xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-200/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-200/30 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <h3 className="text-lg font-black text-violet-900 mb-2">Connect on Social Media</h3>
            <p className="text-xs text-violet-600 mb-6 font-medium">Follow us for updates, tips & exclusive offers</p>
            
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

export default ProviderContactUsPage;
