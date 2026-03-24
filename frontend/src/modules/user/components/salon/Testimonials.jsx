import { motion } from "framer-motion";
import { Star, Quote, ChevronLeft, ChevronRight, Facebook, Instagram, Twitter, Linkedin } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";

const Testimonials = () => {
    const { testimonials } = useUserModuleData();
    const scrollRef = useRef(null);
    const [isHovered, setIsHovered] = useState(false);

    // Robust Auto-Scroll Logic
    useEffect(() => {
        const scrollContainer = scrollRef.current;
        if (!scrollContainer || isHovered) return;

        const interval = setInterval(() => {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;

            if (scrollLeft + clientWidth >= scrollWidth - 50) {
                scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                scrollContainer.scrollTo({
                    left: scrollLeft + (clientWidth > 600 ? 400 : 320),
                    behavior: 'smooth'
                });
            }
        }, 4000);

        return () => clearInterval(interval);
    }, [isHovered]);

    const scroll = (direction) => {
        if (scrollRef.current) {
            const { scrollLeft, clientWidth } = scrollRef.current;
            const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
            scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
        }
    };

    if (!testimonials || testimonials.length === 0) return null;

    return (
        <section className="py-8 md:py-16 px-4 bg-white border-t border-border/50 overflow-hidden">
            <div className="max-w-6xl mx-auto">
                {/* Header Section: Split on Mobile */}
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-12 mb-8 md:mb-12">

                    {/* Left: Heading and Rating */}
                    <div className="flex-1 flex justify-between items-start md:block">
                        <div className="flex-1">
                            <h2 className="text-2xl md:text-5xl font-black font-display leading-[1.1] text-foreground tracking-tight">
                                Love from our <br className="hidden md:block" /> customers
                            </h2>

                            <div className="mt-4 md:mt-8 flex items-center md:items-baseline gap-3 md:gap-4">
                                <Star className="w-8 h-8 md:w-12 md:h-12 fill-amber-400 text-amber-400 drop-shadow-lg" />
                                <div>
                                    <span className="text-3xl md:text-6xl font-black text-foreground">4.5</span>
                                    <p className="text-[10px] md:text-lg font-bold text-muted-foreground opacity-60">49.6K reviews</p>
                                </div>
                            </div>
                        </div>

                        {/* Social Sidebar strictly for Mobile (Vertical/Grid on Right) */}
                        <div className="md:hidden w-1/3 flex flex-col items-end text-right space-y-3 pt-2">
                            <p className="text-[9px] font-black uppercase tracking-tighter text-primary whitespace-nowrap">
                                LET'S SOCIAL 💖
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {[Facebook, Instagram, Twitter, Linkedin].map((Icon, i) => (
                                    <motion.button
                                        key={i}
                                        whileTap={{ scale: 0.9 }}
                                        className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary border border-primary/10"
                                    >
                                        <Icon className="w-4 h-4" />
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Desktop Social and Controls */}
                    <div className="hidden md:flex lg:w-1/3 flex-col justify-between space-y-8">
                        <div className="space-y-4">
                            <p className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                Let's Get Social <span>💖</span>
                            </p>
                            <div className="flex gap-4">
                                {[Facebook, Instagram, Twitter, Linkedin].map((Icon, i) => (
                                    <motion.button
                                        key={i}
                                        whileHover={{ scale: 1.1, y: -2 }}
                                        className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-foreground hover:bg-primary hover:text-white transition-all shadow-sm"
                                    >
                                        <Icon className="w-5 h-5" />
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        <div className="hidden lg:flex items-center gap-4 pt-4">
                            <button onClick={() => scroll('left')} className="w-14 h-14 rounded-full border-2 border-primary/20 flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button onClick={() => scroll('right')} className="w-14 h-14 rounded-full border-2 border-primary/20 flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Testimonial Cards Section */}
                <div
                    className="relative -mx-4 px-4 md:mx-0 md:px-0"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onTouchStart={() => setIsHovered(true)}
                    onTouchEnd={() => setIsHovered(false)}
                >
                    <div
                        ref={scrollRef}
                        className="flex overflow-x-auto hide-scrollbar gap-4 md:gap-6 pb-6 md:pb-8 snap-x snap-mandatory scroll-smooth"
                    >
                        {testimonials.map((item) => (
                            <motion.div
                                key={item.id}
                                className="flex-shrink-0 w-[280px] md:w-[380px] bg-background rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-border/50 shadow-lg snap-start relative group"
                            >
                                <Quote className="absolute top-5 right-5 md:top-8 md:right-8 w-8 h-8 md:w-12 md:h-12 text-primary/5 group-hover:text-primary/10 transition-colors" />

                                <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
                                    <img src={item.image} className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl object-cover border-2 border-primary/10" alt={item.name} />
                                    <div>
                                        <h4 className="font-black text-sm md:text-base">{item.name}</h4>
                                        <div className="flex gap-0.5 mt-0.5 md:mt-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} className={`w-3.5 h-3.5 ${i < item.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <p className="text-muted-foreground text-[13px] md:text-sm leading-relaxed font-medium italic">
                                    "{item.feedback}"
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Mobile Navigation controls */}
                    <div className="flex md:hidden justify-center gap-4 mt-2">
                        <button onClick={() => scroll('left')} className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={() => scroll('right')} className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Testimonials;
