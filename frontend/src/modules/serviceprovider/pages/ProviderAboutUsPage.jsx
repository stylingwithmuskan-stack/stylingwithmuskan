import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, ShieldCheck, Heart, TrendingUp } from "lucide-react";

const ProviderAboutUsPage = () => {
  const navigate = useNavigate();

  const values = [
    { title: "Grow Your Business", icon: TrendingUp, content: "Join our platform to reach more customers and grow your beauty service business with flexible scheduling and competitive earnings." },
    { title: "Safety & Support", icon: ShieldCheck, content: "We provide insurance coverage, safety protocols, and 24/7 support to ensure you can work with confidence and peace of mind." },
    { title: "Partner Success", icon: Heart, content: "Your success is our priority. We offer training, resources, and tools to help you deliver exceptional service and build your reputation." },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-semibold">About Us</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto mt-10 space-y-12">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-xl relative overflow-hidden">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-black text-foreground">Styling With Muskan</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Empowering beauty professionals to build successful careers by connecting them with customers who value quality service.
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
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <value.icon className="w-5 h-5 text-violet-600" />
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
            <p className="text-sm text-slate-400 mb-6 relative z-10 font-medium">Become a trusted beauty professional on our platform.</p>
            <button 
                onClick={() => navigate("/provider/register")}
                className="bg-violet-600 text-white font-black px-8 py-3 rounded-2xl relative z-10 active:scale-95 transition-all shadow-xl shadow-violet-600/20"
            >
                Get Started
            </button>
        </div>
      </div>
    </div>
  );
};

export default ProviderAboutUsPage;
