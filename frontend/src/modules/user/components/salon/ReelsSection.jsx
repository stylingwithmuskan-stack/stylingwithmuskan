import { motion } from "framer-motion";
import { Flame, Volume2, VolumeX } from "lucide-react";
import { useMemo, useState } from "react";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";

const ReelsSection = () => {
    const { spotlights } = useUserModuleData();
    const [muted, setMuted] = useState(true);
    const reels = useMemo(() => (spotlights || []).slice(0, 6), [spotlights]);

    if (!reels.length) return null;

    return (
        <section className="py-12 px-4 bg-background">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Flame className="w-4 h-4 text-rose-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">Trending</span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-black font-display uppercase tracking-widest text-foreground">Reels</h2>
                    </div>
                    <button
                        onClick={() => setMuted((prev) => !prev)}
                        className="w-10 h-10 rounded-full bg-accent flex items-center justify-center border border-border hover:bg-accent/70 transition-colors"
                    >
                        {muted ? <VolumeX className="w-4 h-4 text-muted-foreground" /> : <Volume2 className="w-4 h-4 text-primary" />}
                    </button>
                </div>

                <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-2 snap-x snap-mandatory">
                    {reels.map((reel) => (
                        <motion.div
                            key={reel.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.2 }}
                            transition={{ duration: 0.35 }}
                            className="flex-shrink-0 w-[220px] md:w-[260px] h-[360px] md:h-[430px] rounded-[2rem] overflow-hidden border border-border bg-black relative snap-start"
                        >
                            <video
                                className="w-full h-full object-cover"
                                autoPlay
                                loop
                                playsInline
                                controls
                                muted={muted}
                                poster={reel.poster}
                            >
                                <source src={reel.video} type="video/mp4" />
                            </video>
                            <div className="absolute left-4 right-4 bottom-4">
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
