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
    <div className="min-h-screen bg-[#F8FAFC] pb-24 pt-10">
      <div className="px-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8 px-2">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h1 className="text-2xl font-black text-slate-900">About Us</h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Our Story</p>
            </div>
        </div>
        <div className="text-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center mx-auto mb-6 shadow-xl relative overflow-hidden">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-black text-foreground">Styling With Muskan</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Empowering city vendors to manage and scale their beauty service operations with powerful tools and insights.
          </p>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold text-foreground px-2">Why Partner With Us</h3>
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
