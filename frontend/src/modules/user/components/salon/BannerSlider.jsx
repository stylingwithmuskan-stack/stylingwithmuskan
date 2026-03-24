import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

const BannerSlider = () => {
  const { gender } = useGenderTheme();
  const { banners } = useUserModuleData();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [items, setItems] = useState(banners[gender] || []);

  useEffect(() => {
    const combined = [...(banners[gender] || [])];
    combined.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    setItems(combined);
  }, [gender, banners]);

  const goTo = useCallback(
    (index) => {
      setDirection(index > current ? 1 : -1);
      setCurrent(index);
    },
    [current]
  );

  const goNext = useCallback(() => {
    if (!items.length) return;
    setDirection(1);
    setCurrent((c) => (c + 1) % items.length);
  }, [items.length]);

  const goPrev = useCallback(() => {
    if (!items.length) return;
    setDirection(-1);
    setCurrent((c) => (c - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (isPaused) return;
    if (!items.length) return;
    const interval = setInterval(goNext, 4500);
    return () => clearInterval(interval);
  }, [goNext, isPaused]);

  // Reset index when gender changes
  useEffect(() => {
    setCurrent(0);
  }, [gender]);

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0, scale: 0.95 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0, scale: 0.95 }),
  };

  const banner = items[current];

  return (
    <div className="mt-2 w-full">
      {items.length === 0 ? (
        <div className="relative overflow-hidden h-48 md:h-64 lg:h-[300px] xl:h-[360px] w-full rounded-xl bg-black/5 flex items-center justify-center">
          <div className="text-center px-6">
            <p className="text-sm md:text-base text-muted-foreground">No banners available</p>
          </div>
        </div>
      ) : null}
      <div
        className="relative overflow-hidden h-48 md:h-64 lg:h-[300px] xl:h-[360px] w-full group cursor-pointer select-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`${gender}-${current}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-0"
          >
            {/* Background Image */}
            {banner && (
              <img
                src={banner.image}
                alt={banner.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[8s] ease-out group-hover:scale-110"
              />
            )}

            {/* Dark Overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />

            {/* Subtle colored overlay from theme */}
            {banner && <div className={`absolute inset-0 bg-gradient-to-r ${banner.gradient} opacity-20 mix-blend-overlay`} />}

            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-10 lg:px-12 z-10">
              {/* Offer Tag */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-1.5 mb-2"
              >
                <span className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-md text-white text-[10px] md:text-xs font-semibold px-2.5 py-1 rounded-full border border-white/20">
                  <Sparkles className="w-3 h-3" />
                  Limited Offer
                </span>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xl md:text-2xl lg:text-3xl font-bold text-white drop-shadow-lg font-display"
              >
                {banner?.title || "stylingwithmuskan"}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-1.5 text-sm md:text-base text-white/80 max-w-[280px] md:max-w-sm"
              >
                {banner?.subtitle || "Premium salon & spa at home"}
              </motion.p>

              {/* CTA Button */}
              {banner?.cta && (
                <motion.button
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-3 md:mt-4 self-start px-5 md:px-6 py-2 md:py-2.5 bg-white text-gray-900 text-xs md:text-sm font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-white/90"
                >
                  {banner.cta} →
                </motion.button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows - visible on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/30 z-20 border border-white/10"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/30 z-20 border border-white/10"
        >
          <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
        </button>

        {/* Progress Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="relative h-2 rounded-full overflow-hidden transition-all duration-300"
              style={{ width: i === current ? 24 : 8 }}
            >
              <div className="absolute inset-0 bg-white/30 rounded-full" />
              {i === current && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4.5, ease: "linear" }}
                  className="absolute inset-y-0 left-0 bg-white rounded-full"
                />
              )}
              {i !== current && (
                <div className="absolute inset-0 bg-white/50 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BannerSlider;

