import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, User, ShieldCheck, Heart } from "lucide-react";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";

const AboutUsPage = () => {
  const navigate = useNavigate();
  const { gender } = useGenderTheme();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const values = [
    { title: "Quality Service", icon: Sparkles, content: "We partner with top professionals to ensure you receive premium beauty and wellness services at home." },
    { title: "Safety First", icon: ShieldCheck, content: "All our partners go through rigorous background checks and training to guarantee your safety." },
    { title: "Customer Centric", icon: Heart, content: "Your satisfaction is our priority. We're dedicated to making beauty services convenient and accessible." },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>About Us</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto mt-10 space-y-12">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-gradient-theme flex items-center justify-center mx-auto mb-6 shadow-xl relative overflow-hidden">
            <Sparkles className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-black text-foreground">Styling With Muskan</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Bringing the salon experience directly to your doorstep. We bridge the gap between beauty professionals and customers with seamless booking and quality service.
          </p>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold text-foreground px-2">Our Values</h3>
          <div className="grid gap-4">
            {values.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-strong rounded-2xl p-5 border border-border/50 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <value.icon className="w-5 h-5 text-primary" />
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
            <h3 className="text-2xl font-black mb-2 relative z-10">Join Our Mission</h3>
            <p className="text-sm text-slate-400 mb-6 relative z-10 font-medium">Be a part of the most convenient beauty service platform.</p>
            <button 
                onClick={() => navigate("/login")}
                className="bg-primary text-primary-foreground font-black px-8 py-3 rounded-2xl relative z-10 active:scale-95 transition-all shadow-xl shadow-primary/20"
            >
                Get Started
            </button>
        </div>
      </div>
    </div>
  );
};

export default AboutUsPage;
