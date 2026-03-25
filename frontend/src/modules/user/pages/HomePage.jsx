import { motion, AnimatePresence } from "framer-motion";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
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
  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <Header />

      <main className="max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={gender}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <BannerSlider />
            <CategoryGrid />
            {/* <SpotlightStories /> */}
            <ReelsSection />
            <PopularServices />
            <OurGallery />
            <WhyChooseUs />
            <Testimonials />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default HomePage;

