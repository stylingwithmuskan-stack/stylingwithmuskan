import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, Phone, MessageSquare, MapPin, ExternalLink, Instagram, Facebook, Twitter, Loader2 } from "lucide-react";
import { api } from "@/modules/user/lib/api";

const ProviderContactUsPage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Scroll to top and fetch settings
  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await api.content.officeSettings();
        if (res && res.data) {
          setSettings(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch office settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const supportPhone = String(settings?.supportPhone || import.meta.env.VITE_SUPPORT_PHONE || "8349764176");
  const formattedPhone = `+91 ${supportPhone.slice(0, 5)} ${supportPhone.slice(5)}`;
  const startTime = settings?.startTime || "9:00 AM";
  const endTime = settings?.endTime || "9:00 PM";

  const contacts = [
    { id: 1, icon: Phone, label: "Call Provider Support", value: formattedPhone, action: `tel:+91${supportPhone}` },
    { id: 2, icon: Mail, label: "Email Support", value: settings?.supportEmail || "provider@swm.com", action: `mailto:${settings?.supportEmail || "provider@swm.com"}` },
    { id: 3, icon: MessageSquare, label: "Live Chat", value: "Chat with support team", action: "/provider/support" },
    { id: 4, icon: MapPin, label: "Visit Our Hub", value: "View all service zones on map", action: "/provider/all-zones" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-violet-600 mb-4" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Initializing Support...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button 
          onClick={() => navigate(-1)} 
          className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors active:scale-90"
        >
          <ArrowLeft className="w-5 h-5 text-slate-900" />
        </button>
        <h1 className="text-lg font-black text-slate-900 tracking-tight">Contact Us</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto mt-8 space-y-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-20 h-20 rounded-[2rem] bg-violet-100 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <MessageSquare className="w-10 h-10 text-violet-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">How can we help?</h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            Provider support available <span className="text-violet-600 font-bold">{startTime} - {endTime}</span> for any assistance.
          </p>
        </motion.div>

        <div className="grid gap-4">
          <AnimatePresence>
            {contacts.map((contact, i) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => contact.action.startsWith("/") ? navigate(contact.action) : window.open(contact.action, "_blank")}
                className="bg-white rounded-[2rem] p-5 border border-slate-100 flex items-center gap-5 cursor-pointer hover:shadow-xl hover:shadow-violet-500/5 transition-all active:scale-[0.98] shadow-sm group"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-violet-600 group-hover:text-white transition-colors duration-300">
                  <contact.icon className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">{contact.label}</p>
                  <p className="font-bold text-slate-900 text-[15px]">{contact.value}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 p-8 rounded-[2.5rem] bg-slate-900 text-center relative overflow-hidden shadow-2xl"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <h3 className="text-xl font-black text-white mb-2 tracking-tight">Connect on Social Media</h3>
            <p className="text-xs text-slate-400 mb-8 font-medium">Follow us for updates, tips & exclusive offers</p>
            
            <div className="flex justify-center gap-5">
              {[
                { Icon: Instagram, color: "from-purple-500 via-pink-500 to-orange-400", link: "https://instagram.com/stylingwithmuskan" },
                { Icon: Facebook, color: "from-blue-600 to-blue-500", link: "https://facebook.com/stylingwithmuskan" },
                { Icon: Twitter, color: "from-sky-500 to-blue-400", link: "https://twitter.com/stylingwmuskan" }
              ].map((social, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.1, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => window.open(social.link, "_blank")}
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${social.color} flex items-center justify-center text-white shadow-lg shadow-black/20`}
                >
                  <social.Icon className="w-6 h-6" />
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProviderContactUsPage;
