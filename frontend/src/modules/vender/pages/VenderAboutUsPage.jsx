import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, ShieldCheck, Heart, Building2 } from "lucide-react";

const VenderAboutUsPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const values = [
    { title: "Business Growth", icon: Building2, content: "Manage your city operations efficiently and grow your beauty service business with our comprehensive vendor management platform." },
    { title: "Quality Assurance", icon: ShieldCheck, content: "We ensure all service providers meet quality standards through verification, training, and continuous monitoring." },
    { title: "Partner Network", icon: Heart, content: "Build a strong network of service providers and deliver exceptional experiences to customers in your city." },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-gray-100 shadow-sm shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-900 hover:bg-slate-100 active:scale-90 transition-all border border-slate-100">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight">About Us</h1>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Our Story</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 sm:py-10 max-w-2xl mx-auto">
        <div className="text-center space-y-3 sm:space-y-4 mb-10 sm:mb-12">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-xl relative overflow-hidden">
            <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground">Styling With Muskan</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-[280px] sm:max-w-sm mx-auto">
            Empowering city vendors to manage and scale their beauty service operations with powerful tools and insights.
          </p>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <h3 className="text-base sm:text-lg font-bold text-foreground px-1">Why Partner With Us</h3>
          <div className="grid gap-4">
            {values.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl p-5 border border-border/50 space-y-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <value.icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h2 className="font-bold text-base text-foreground">{value.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {value.content}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="p-8 rounded-[32px] bg-slate-900 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10">
                <Sparkles className="w-40 h-40" />
            </div>
            <h3 className="text-2xl font-black mb-2 relative z-10">Join Our Network</h3>
            <p className="text-sm text-slate-400 mb-6 relative z-10 font-medium">Become a trusted city vendor on our platform.</p>
            <button 
                onClick={() => navigate("/vender/register")}
                className="bg-emerald-600 text-white font-black px-8 py-3 rounded-2xl relative z-10 active:scale-95 transition-all shadow-xl shadow-emerald-600/20"
            >
                Get Started
            </button>
        </div>
      </div>
    </div>
  );
};

export default VenderAboutUsPage;
