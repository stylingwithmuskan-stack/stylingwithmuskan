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
              className="space-y-8 px-4 mt-4"
            >
              {/* Banner Skeleton */}
              <div className="w-full h-48 md:h-64 rounded-3xl bg-accent animate-pulse object-cover"></div>
              
              {/* Category Grid Skeleton */}
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 pt-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-[24px] bg-accent animate-pulse"></div>
                    <div className="w-12 h-2 rounded bg-accent animate-pulse"></div>
                  </div>
                ))}
              </div>

              {/* Popular Services Skeleton */}
              <div>
                <div className="w-32 h-4 rounded bg-accent animate-pulse mb-4"></div>
                <div className="flex gap-4 overflow-hidden">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="min-w-[200px] h-[220px] rounded-2xl bg-accent animate-pulse"></div>
                  ))}
                </div>
              </div>
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
              {/* <SpotlightStories /> */}
              <ReelsSection />
              <PopularServices />
              <OurGallery />
              <WhyChooseUs />
              <Testimonials />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default HomePage;

