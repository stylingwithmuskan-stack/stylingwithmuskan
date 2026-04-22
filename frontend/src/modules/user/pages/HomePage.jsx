import { motion, AnimatePresence } from "framer-motion";
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

const HomePage = () => {
  const { gender } = useGenderTheme();
  const { isLoading } = useUserModuleData();

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
              <WhyChooseUs />
              <ReelsSection />
              <OurGallery />
              <Testimonials />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default HomePage;
