import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Volume2, VolumeX, Heart } from "lucide-react";
import { api } from "@/modules/user/lib/api";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { toast } from "sonner";

const ReelsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth();
    const { reels = [], startIndex = 0 } = location.state || {};
    
    const [currentIndex, setCurrentIndex] = useState(startIndex);
    const [muted, setMuted] = useState(true);
    const [reelsData, setReelsData] = useState(reels);
    const containerRef = useRef(null);
    const videoRefs = useRef([]);

    // Redirect if no reels data
    useEffect(() => {
        if (!reels.length) {
            navigate("/home");
        }
    }, [reels, navigate]);

    // Handle scroll to change reels
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const windowHeight = window.innerHeight;
            const newIndex = Math.round(scrollTop / windowHeight);
            
            if (newIndex !== currentIndex && newIndex >= 0 && newIndex < reels.length) {
                setCurrentIndex(newIndex);
            }
        };

        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, [currentIndex, reels.length]);

    // Auto-play current video, pause others
    useEffect(() => {
        videoRefs.current.forEach((video, index) => {
            if (video) {
                if (index === currentIndex) {
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            }
        });
    }, [currentIndex]);

    const handleVideoClick = (index) => {
        const video = videoRefs.current[index];
        if (video) {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
    };

    const handleLike = async (reelId, index) => {
        if (!isLoggedIn) {
            toast.error("Please login to like reels");
            return;
        }

        // Optimistic update
        setReelsData(prev => {
            const updated = [...prev];
            const currentLikes = updated[index].likes || 0;
            const isLiked = updated[index].isLikedByUser;
            
            updated[index] = {
                ...updated[index],
                likes: isLiked ? currentLikes - 1 : currentLikes + 1,
                isLikedByUser: !isLiked
            };
            return updated;
        });

        // API call
        try {
            await api.content.toggleSpotlightLike(reelId);
        } catch (error) {
            console.error("Failed to like reel:", error);
            // Revert on error
            setReelsData(prev => {
                const updated = [...prev];
                const currentLikes = updated[index].likes || 0;
                const isLiked = updated[index].isLikedByUser;
                
                updated[index] = {
                    ...updated[index],
                    likes: isLiked ? currentLikes - 1 : currentLikes + 1,
                    isLikedByUser: !isLiked
                };
                return updated;
            });
            toast.error("Failed to like reel");
        }
    };

    if (!reels.length) return null;

    return (
        <div className="fixed inset-0 bg-black z-50">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex items-center justify-between max-w-[500px] mx-auto lg:max-w-full">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <div className="w-10 h-10 lg:hidden" /> {/* Spacer for mobile */}
                </div>
            </div>

            {/* Reels Container */}
            <div
                ref={containerRef}
                className="h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
            >
                {reelsData.map((reel, index) => (
                    <div
                        key={reel.id}
                        className="relative h-screen w-full snap-start snap-always bg-black flex items-center justify-center"
                    >
                        {/* Video Container - Centered on Desktop */}
                        <div className="relative w-full h-full lg:w-auto lg:h-[90vh] lg:max-h-[800px] lg:aspect-[9/16] lg:rounded-3xl lg:overflow-hidden">
                            {/* Video */}
                            <video
                                ref={(el) => (videoRefs.current[index] = el)}
                                className="h-full w-full object-contain lg:rounded-3xl"
                                loop
                                playsInline
                                muted={muted}
                                poster={reel.poster}
                                onClick={() => handleVideoClick(index)}
                            >
                                <source src={reel.video} type="video/mp4" />
                            </video>

                            {/* Mute Button - Top Right Inside Video */}
                            <button
                                onClick={() => setMuted(!muted)}
                                className="absolute top-4 right-4 z-20 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md grid place-items-center hover:bg-white/20 transition-colors lg:block hidden"
                                style={{ padding: 0 }}
                            >
                                {muted ? (
                                    <VolumeX className="w-5 h-5 text-white" style={{ display: 'block', margin: 'auto' }} />
                                ) : (
                                    <Volume2 className="w-5 h-5 text-white" style={{ display: 'block', margin: 'auto' }} />
                                )}
                            </button>

                            {/* Right Side Actions - Aligned with Bottom Text */}
                            <div className="absolute right-4 bottom-8 flex flex-col gap-2 z-10 items-center">
                                <button
                                    onClick={() => handleLike(reel.id, index)}
                                    className="flex flex-col items-center gap-1"
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md inline-flex items-center justify-center hover:bg-white/20 transition-colors">
                                        <Heart
                                            className={`w-6 h-6 flex-shrink-0 transition-all ${reel.isLikedByUser ? "fill-red-500 text-red-500 scale-110" : "text-white"}`}
                                        />
                                    </div>
                                    <span className="text-xs text-white font-bold">
                                        {reel.likes > 999 ? `${(reel.likes / 1000).toFixed(1)}k` : reel.likes || 0}
                                    </span>
                                </button>
                            </div>

                            {/* Bottom Info - Inside Video Container */}
                            <div className="absolute left-4 right-20 bottom-8 z-10 pointer-events-none">
                                <div className="inline-flex items-center rounded-full bg-black/50 backdrop-blur-sm px-3 py-1 border border-white/20 mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                                        {reel.category}
                                    </span>
                                </div>
                                <h3 className="text-base font-bold text-white line-clamp-2 mb-1">
                                    {reel.title}
                                </h3>
                                {reel.description && (
                                    <p className="text-sm text-white/70 line-clamp-2">
                                        {reel.description}
                                    </p>
                                )}
                            </div>

                            {/* Progress Indicator - Hidden on Desktop */}
                            <div className="absolute top-20 left-0 right-0 px-4 z-10 lg:hidden">
                                <div className="flex gap-1">
                                    {reelsData.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`h-0.5 flex-1 rounded-full transition-all ${
                                                idx === currentIndex
                                                    ? "bg-white"
                                                    : idx < currentIndex
                                                    ? "bg-white/50"
                                                    : "bg-white/20"
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReelsPage;
