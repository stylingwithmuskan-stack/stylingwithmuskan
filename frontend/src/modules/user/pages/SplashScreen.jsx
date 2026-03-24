import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { Scissors } from "lucide-react";
const SplashScreen = () => {
  const [show, setShow] = useState(true);
  const navigate = useNavigate();
  const { hasSelected } = useGenderTheme();
  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(() => {
        navigate(hasSelected ? "/home" : "/select-gender");
      }, 500);
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigate, hasSelected]);
  return (<AnimatePresence>
    {show && (<motion.div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-theme" exit={{ opacity: 0, scale: 1.1 }} transition={{ duration: 0.5 }}>
      <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15, duration: 0.8 }} className="mb-6">
        <div className="w-24 h-24 rounded-full bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center">
          <Scissors className="w-12 h-12 text-primary-foreground" />
        </div>
      </motion.div>

      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }} className="text-3xl md:text-4xl font-display font-bold text-primary-foreground text-center px-4">
        stylingwithmuskan
      </motion.h1>

      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.6 }} className="mt-3 text-primary-foreground/80 text-center text-sm md:text-base font-body">
        Salon Services at Your Doorstep
      </motion.p>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8, duration: 0.5 }} className="mt-8">
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (<motion.div key={i} className="w-2 h-2 rounded-full bg-primary-foreground/60" animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }} />))}
        </div>
      </motion.div>
    </motion.div>)}
  </AnimatePresence>);
};
export default SplashScreen;

