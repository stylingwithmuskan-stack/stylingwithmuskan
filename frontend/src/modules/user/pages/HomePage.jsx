import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import Header from "@/modules/user/components/salon/Header";
import BannerSlider from "@/modules/user/components/salon/BannerSlider";
import CategoryGrid from "@/modules/user/components/salon/CategoryGrid";
import PopularServices from "@/modules/user/components/salon/PopularServices";
import WhyChooseUs from "@/modules/user/components/salon/WhyChooseUs";
import SpotlightStories from "@/modules/user/components/salon/SpotlightStories";
import ReelsSection from "@/modules/user/components/salon/ReelsSection";
import OurGallery from "@/modules/user/components/salon/OurGallery";
import Testimonials from "@/modules/user/components/salon/Testimonials";

// Helper to detect touch devices
const isTouchDevice = typeof window !== "undefined" && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const HomePage = () => {
  const { gender } = useGenderTheme();
  const { isLoading } = useUserModuleData();
  const navigate = useNavigate();

  // Show referral error from registration if any
  useEffect(() => {
    const refError = sessionStorage.getItem("swm_referral_error");
    if (refError) {
      toast.error(refError, {
        duration: 5000,
      });
      sessionStorage.removeItem("swm_referral_error");
    }
  }, []);

  // Redirect to booking summary if there's a pending booking from before login
  useEffect(() => {
    const pending = sessionStorage.getItem("swm_pending_booking");
    if (pending) {
      try {
        const { path, state } = JSON.parse(pending);
        sessionStorage.removeItem("swm_pending_booking");
        if (path && state) {
          navigate(path, { state, replace: true });
        }
      } catch (e) {
        console.error("Failed to parse pending booking", e);
        sessionStorage.removeItem("swm_pending_booking");
      }
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <Header />

      <main className="max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading-skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-40 pointer-events-none"
            >
              <div className="relative">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <div className="absolute -inset-4 bg-primary/5 blur-2xl rounded-full -z-10" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mt-6 animate-pulse">
                Loading SWM...
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={gender}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <BannerSlider />
              <CategoryGrid />
              <PopularServices />
              <ReelsSection />
              <OurGallery />
              <WhyChooseUs />
              <Testimonials />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating WhatsApp Support Button - Commented out for testing iOS click issue 
      <motion.a
        href={`https://wa.me/91${import.meta.env.VITE_SUPPORT_PHONE || "8349764176"}?text=Hello%20Styling%20With%20Muskan,%20I%20need%20assistance.`}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={isTouchDevice ? undefined : { scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        transition={{ delay: 1, type: "spring", stiffness: 260, damping: 20 }}
        className="fixed bottom-24 lg:bottom-10 right-6 z-50 w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-2xl shadow-[#25D366]/40 group"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <svg 
          viewBox="0 0 24 24" 
          fill="currentColor" 
          className="w-8 h-8"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>

        {!isTouchDevice && (
          <span className="absolute inset-0 rounded-full bg-[#25D366]/40 animate-ping -z-10 pointer-events-none" />
        )}

        <span className="absolute right-full mr-4 bg-black/80 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none hidden lg:block">
          WhatsApp Support
        </span>
      </motion.a>
      */}
    </div>
  );
};

export default HomePage;
