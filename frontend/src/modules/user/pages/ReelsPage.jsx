import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Volume2, VolumeX, Heart, Download, MoreVertical, Share2, CheckCircle2 } from "lucide-react";
import { api } from "@/modules/user/lib/api";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { toast } from "sonner";

import { safeStorage } from "@/modules/user/lib/safeStorage";

const ReelsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isLoggedIn, user } = useAuth();
    const { reels = [], startIndex = 0 } = location.state || {};
    
    const [currentIndex, setCurrentIndex] = useState(startIndex);
    const [muted, setMuted] = useState(true);
    const [reelsData, setReelsData] = useState(reels);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showDownloadToast, setShowDownloadToast] = useState(false);
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
            
            if (newIndex !== currentIndex && newIndex >= 0 && newIndex < reelsData.length) {
                setCurrentIndex(newIndex);
                setIsMenuOpen(false);
            }
        };

        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, [currentIndex, reelsData.length]);

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
        // Check if any role is authenticated using safeStorage
        const hasToken = safeStorage.getItem("swm_token") || 
                         safeStorage.getItem("swm_provider_token") || 
                         safeStorage.getItem("swm_vendor_token");

        if (!hasToken) {
            toast.error("Please login to like reels");
            navigate('/login');
            return;
        }

        // Optimistic update
        setReelsData(prev => {
            const updated = [...prev];
            const currentLikes = updated[index].likes || 0;
            const isLiked = updated[index].isLikedByUser;
            
            updated[index] = {
                ...updated[index],
                likes: isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1,
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
            toast.error("Unable to like the reel. Please try again.");
        }
    };

    const handleDownload = async (reel) => {
        setIsMenuOpen(false);
        setIsDownloading(true);
        
        try {
            const response = await fetch(reel.video);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Name the file
            a.download = `SWM_Reel_${reel.id || Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            // Show custom "Downloaded" popup
            setShowDownloadToast(true);
            setTimeout(() => setShowDownloadToast(false), 3000);
        } catch (error) {
            console.error("Download failed:", error);
            toast.error("Failed to download video");
        } finally {
            setIsDownloading(false);
        }
    };

    if (!reelsData.length) return null;

    return (
        <div className="fixed inset-0 bg-black z-50 overflow-hidden">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-40 p-4 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center justify-between max-w-[500px] mx-auto lg:max-w-full">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <div className="flex items-center gap-2">
                         {/* Mute Toggle */}
                         <button
                            onClick={() => setMuted(!muted)}
                            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors"
                        >
                            {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Download Toast Notification */}
            <AnimatePresence>
                {showDownloadToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -100, x: "-50%", scale: 0.8 }}
                        animate={{ 
                            opacity: 1, 
                            y: 20, 
                            x: "-50%", 
                            scale: 1,
                            transition: { type: "spring", stiffness: 300, damping: 25 }
                        }}
                        exit={{ opacity: 0, y: -20, x: "-50%", scale: 0.95 }}
                        className="fixed top-8 left-1/2 z-[100] w-[90%] max-w-[320px] bg-white/95 backdrop-blur-xl px-4 py-3 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-3 border border-white/20 ring-1 ring-black/5"
                    >
                        <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center shrink-0 shadow-inner">
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[13px] font-black text-slate-900 leading-tight">Success!</span>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">Reel saved to gallery</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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

                            {/* Action Sidebar */}
                            <div className="absolute right-4 bottom-24 flex flex-col gap-6 z-30 items-center">
                                {/* Like Button */}
                                <button
                                    onClick={() => handleLike(reel.id, index)}
                                    className="flex flex-col items-center gap-1 group"
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 shadow-lg">
                                        <Heart
                                            className={`w-6 h-6 transition-all ${reel.isLikedByUser ? "fill-red-500 text-red-500 scale-110 shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "text-white"}`}
                                        />
                                    </div>
                                    <span className="text-[11px] text-white font-bold drop-shadow-md">
                                        {reel.likes > 999 ? `${(reel.likes / 1000).toFixed(1)}k` : reel.likes || 0}
                                    </span>
                                </button>

                                {/* More Options */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsMenuOpen(isMenuOpen === index ? null : index)}
                                        className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all shadow-lg"
                                    >
                                        <MoreVertical className="w-6 h-6 text-white" />
                                    </button>

                                    {/* More Menu */}
                                    <AnimatePresence>
                                        {isMenuOpen === index && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                                                className="absolute bottom-14 right-0 w-40 bg-white/95 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl border border-white/20"
                                            >
                                                <button
                                                    onClick={() => handleDownload(reel)}
                                                    disabled={isDownloading}
                                                    className="w-full px-3 py-3 flex items-center gap-2.5 hover:bg-primary/10 transition-colors text-black border-b border-border/50"
                                                >
                                                    <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                                                    <span className="text-xs font-bold">{isDownloading ? 'Downloading...' : 'Download Reel'}</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const playStoreUrl = "https://play.google.com/store/apps/details?id=com.glowrep.app";
                                                        const message = `Check out this amazing reel on *Styling With Muskan*! 🎥✨\n\nDownload the app to see more: ${playStoreUrl}${user?.referralCode ? `\n\nUse my code *${user.referralCode}* for a special discount!` : ''}`;
                                                        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                                                        window.open(whatsappUrl, '_blank');
                                                        setIsMenuOpen(null);
                                                    }}
                                                    className="w-full px-3 py-3 flex items-center gap-2.5 hover:bg-primary/10 transition-colors text-black"
                                                >
                                                    <Share2 className="w-4 h-4 text-green-600" />
                                                    <span className="text-xs font-bold">Share on WhatsApp</span>
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Bottom Content Info */}
                            <div className="absolute left-4 right-20 bottom-8 z-30 pointer-events-none">
                                {reel.category && (
                                    <motion.div 
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="inline-flex items-center rounded-full bg-primary/20 backdrop-blur-md px-3 py-1 border border-primary/30 mb-3"
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                                            {reel.category}
                                        </span>
                                    </motion.div>
                                )}
                                <h3 className="text-lg font-black text-white line-clamp-1 mb-1 drop-shadow-lg uppercase tracking-tight">
                                    {reel.title}
                                </h3>
                                {reel.description && (
                                    <p className="text-sm text-white/80 line-clamp-2 leading-tight drop-shadow-md">
                                        {reel.description}
                                    </p>
                                )}
                            </div>


                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReelsPage;
