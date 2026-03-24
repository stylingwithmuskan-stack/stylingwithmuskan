import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";

const OurGallery = () => {
    const { gallery } = useUserModuleData();
    const scrollRef = useRef(null);
    const [isHovered, setIsHovered] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        if (isHovered || selectedImage) return;

        const interval = setInterval(() => {
            if (scrollRef.current) {
                const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
                const maxScroll = scrollWidth - clientWidth;

                if (scrollLeft >= maxScroll - 10) {
                    scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
                } else {
                    scrollRef.current.scrollTo({ left: scrollLeft + 300, behavior: "smooth" });
                }
            }
        }, 4000);

        return () => clearInterval(interval);
    }, [isHovered, selectedImage]);

    if (!gallery || gallery.length === 0) return null;

    return (
        <section className="py-12 px-4 overflow-hidden relative">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-black font-display uppercase tracking-[0.2em] text-primary">Our Gallery</h2>
                    <div className="h-1 w-20 bg-primary/20 mx-auto mt-2 rounded-full" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 mt-3 tracking-widest">A glimpse of our premium workspace</p>
                </div>

                <div
                    className="relative"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <div
                        ref={scrollRef}
                        className="flex overflow-x-auto hide-scrollbar gap-5 pb-6 snap-x"
                    >
                        {gallery.map((item) => (
                            <motion.div
                                key={item.id}
                                whileHover={{ scale: 1.02 }}
                                onClick={() => setSelectedImage(item)}
                                className="flex-shrink-0 w-[240px] md:w-[350px] aspect-[4/3] relative rounded-[2.5rem] overflow-hidden snap-center shadow-2xl group cursor-pointer"
                            >
                                <img
                                    src={item.image}
                                    className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-110 group-hover:rotate-1"
                                    alt={item.title}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center backdrop-blur-[2px]">
                                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-2xl scale-0 group-hover:scale-100 transition-transform duration-500 delay-100">
                                        <Maximize2 className="w-5 h-5 text-primary" />
                                    </div>
                                </div>
                                <div className="absolute bottom-6 left-8 right-8 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                                    <h3 className="text-white font-black text-lg drop-shadow-lg">{item.title}</h3>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Aesthetic footer info */}
                <div className="flex justify-center gap-2 mt-4">
                    {gallery.map((_, i) => {
                        // Estimate which index is "active" based on some logic or just keep static for now
                        // For simplicity, let's just make one dot active
                        return (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 2 ? 'bg-primary' : 'bg-primary/20'}`} />
                        )
                    })}
                </div>
            </div>

            {/* Lightbox Modal */}
            <AnimatePresence>
                {selectedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
                        onClick={() => setSelectedImage(null)}
                    >
                        {/* Close button */}
                        <motion.button
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="absolute top-8 right-8 w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all z-[110]"
                            onClick={() => setSelectedImage(null)}
                        >
                            <X className="w-6 h-6" />
                        </motion.button>

                        <motion.div
                            initial={{ scale: 0.9, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 20, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative max-w-5xl w-full aspect-video rounded-3xl overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={selectedImage.image}
                                alt={selectedImage.title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-8 md:p-12">
                                <motion.div
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <p className="text-[10px] font-bold text-primary-foreground/60 uppercase tracking-[0.3em] mb-2">Our Premium Space</p>
                                    <h3 className="text-2xl md:text-4xl font-black text-white drop-shadow-2xl">{selectedImage.title}</h3>
                                </motion.div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
};

export default OurGallery;
