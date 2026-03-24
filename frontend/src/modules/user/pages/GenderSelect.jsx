import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { Scissors, Sparkles, User, UserCheck } from "lucide-react";

const GenderSelect = () => {
  const { setGender } = useGenderTheme();
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);

  const handleSelect = (g) => {
    if (g === "men") {
        const isMenEnabled = JSON.parse(localStorage.getItem('swm_men_enabled') ?? 'false');
        if (!isMenEnabled) {
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 2500);
            return;
        }
    }
    setGender(g);
    navigate("/home");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10 z-10"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-theme mx-auto mb-6 flex items-center justify-center rotate-12 shadow-elevated">
          <Scissors className="w-10 h-10 text-primary-foreground -rotate-12" />
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground lowercase">
          stylingwithmuskan
        </h1>
        <p className="mt-3 text-muted-foreground text-sm max-w-xs mx-auto">
          Experience luxury salon services at your doorstep. Please select a category to begin.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-5 w-full max-w-lg z-10">
        {/* Women Card */}
        <motion.button
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          whileHover={{ scale: 1.05, y: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSelect("women")}
          className="relative group overflow-hidden rounded-3xl aspect-[3/4.5] flex flex-col items-center justify-end p-6 shadow-2xl transition-all"
        >
          {/* Background Image */}
          <img
            src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&h=800&fit=crop"
            alt="Women Services"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-0 border-2 border-white/10 group-hover:border-white/30 rounded-3xl transition-all" />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <div className="p-2 rounded-full bg-white/20 backdrop-blur-md mb-2">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white">Women</span>
            <p className="text-[10px] text-white/70 font-medium uppercase tracking-wider">Beauty & Spa</p>
          </div>
        </motion.button>

        {/* Men Card */}
        <motion.button
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          whileHover={{ scale: 1.05, y: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSelect("men")}
          className="relative group overflow-hidden rounded-3xl aspect-[3/4.5] flex flex-col items-center justify-end p-6 shadow-2xl transition-all"
        >
          {/* Background Image */}
          <img
            src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&h=800&fit=crop"
            alt="Men Services"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-0 border-2 border-white/10 group-hover:border-white/30 rounded-3xl transition-all" />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <div className="p-2 rounded-full bg-white/20 backdrop-blur-md mb-2">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white">Men</span>
            <p className="text-[10px] text-white/70 font-medium uppercase tracking-wider">Hair & Grooming</p>
          </div>
          <AnimatePresence>
              {showPopup && (
                  <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.8 }} 
                      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4 rounded-3xl"
                  >
                      <span className="text-2xl mb-2">🚧</span>
                      <p className="font-bold text-white text-base">Currently Unavailable</p>
                      <p className="text-[10px] text-white/80 mt-1 text-center font-medium">This service category is launching soon!</p>
                  </motion.div>
              )}
          </AnimatePresence>
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-10 flex flex-col items-center gap-2"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent py-2 px-4 rounded-full">
          <UserCheck className="w-3.5 h-3.5 text-primary" />
          Trusted by 10,000+ happy customers
        </div>
        <p className="text-[10px] text-muted-foreground/60 italic">
          Change selection anytime in Profile
        </p>
      </motion.div>
    </div>
  );
};

export default GenderSelect;

