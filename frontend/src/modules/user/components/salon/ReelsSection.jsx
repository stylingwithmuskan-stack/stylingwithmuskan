import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";

const ReelsSection = () => {
    const { spotlights } = useUserModuleData();
    const navigate = useNavigate();
    const [muted, setMuted] = useState(true);
    const reels = useMemo(() => (spotlights || []).slice(0, 6), [spotlights]);
    const videoRefs = useRef([]);

    // Force muted state for autoplay compliance
    useEffect(() => {
        videoRefs.current.forEach(video => {
            if (video) video.muted = true;
        });
    }, [reels]);

    const handleReelClick = (index) => {
        navigate("/reels", { state: { reels, startIndex: index } });
    };

    if (!reels.length) return null;

    return (
        <section className="py-12 px-4 bg-background">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Flame className="w-4 h-4 text-rose-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">Happy Clients</span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-black font-display uppercase tracking-widest text-foreground">REAL EXPERIENCE</h2>
                    </div>
                </div>

                <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-2 snap-x snap-mandatory">
                    {reels.map((reel, index) => (
                        <motion.div
                            key={reel.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.2 }}
                            transition={{ duration: 0.35 }}
                            className="flex-shrink-0 w-[220px] md:w-[260px] h-[360px] md:h-[430px] rounded-[2rem] overflow-hidden border border-border bg-black relative snap-start group"
                        >
                            <video
                                ref={(el) => {
                                    if (el) videoRefs.current[index] = el;
                                }}
                                className="w-full h-full object-cover"
                                autoPlay
                                loop
                                playsInline
                                muted={muted}
                                poster={reel.poster}
                                onClick={(e) => {
                                    // Prevent navigation when clicking on video area
                                    e.stopPropagation();
                                    handleReelClick(index);
                                }}
                            >
                                <source src={reel.video} type="video/mp4" />
                            </video>
                            
                            {/* Click overlay to open full screen - only active outside video controls area */}
                            <div 
                                onClick={() => handleReelClick(index)}
                                className="absolute inset-0 cursor-pointer group-hover:bg-black/10 transition-colors"
                                style={{ pointerEvents: 'auto' }}
                            />
                            
                            <div className="absolute left-4 right-4 bottom-16 pointer-events-none z-10">
                                <div className="inline-flex items-center rounded-full bg-black/50 backdrop-blur-sm px-3 py-1 border border-white/20">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">{reel.category}</span>
                                </div>
                                <h3 className="mt-2 text-sm md:text-base font-bold text-white line-clamp-2">{reel.title}</h3>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ReelsSection;
