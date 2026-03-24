import React, { useState, useEffect, useMemo } from "react";
import {
    PlayCircle,
    CheckCircle2,
    Clock,
    ChevronLeft,
    Search,
    Filter,
    Play,
    Zap,
    GraduationCap,
    BookOpen,
    Star,
    ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { Badge } from "@/modules/user/components/ui/badge";
import { Button } from "@/modules/user/components/ui/button";
import { useNavigate } from "react-router-dom";

const DEFAULT_VIDEOS = [
    {
        id: 1,
        title: "Advanced Hair Styling Techniques",
        category: "Hair Styling",
        duration: "15:30",
        status: "Completed",
        thumbnail: "https://images.unsplash.com/photo-1560869713-7d0a294308a3?auto=format&fit=crop&w=800&q=80",
        provider: "StylingwithMuskan Academy",
        description: "Learn the latest professional hair styling techniques including 3D braiding and advanced blowouts.",
        views: "1.2k",
        difficulty: "Advanced"
    },
    {
        id: 2,
        title: "Bridal Makeup Masterclass 2026",
        category: "Makeup",
        duration: "45:00",
        status: "Ongoing",
        thumbnail: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80",
        provider: "Senior Artist - Rhea",
        description: "A comprehensive guide to long-lasting bridal makeup for various skin types and tones.",
        views: "3.5k",
        difficulty: "Intermediate"
    },
    {
        id: 3,
        title: "Hygiene & Sanitization Standards",
        category: "Hygiene",
        duration: "12:15",
        status: "Mandatory",
        thumbnail: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
        provider: "SWM Compliance Team",
        description: "Official SWM standards for maintaining a clean and safe workspace during every appointment.",
        views: "10k+",
        difficulty: "Beginner"
    },
    {
        id: 4,
        title: "Deep Cleansing Routine",
        category: "Skin Care",
        duration: "20:00",
        status: "New",
        thumbnail: "https://images.unsplash.com/photo-1570172235384-a0e3d5904003?auto=format&fit=crop&w=800&q=80",
        provider: "Skin Care Lead",
        description: "Standard operating procedure for performing deep cleansing skin treatments as per SWM guidelines.",
        views: "800",
        difficulty: "Intermediate"
    }
];

export default function TrainingHub() {
    const navigate = useNavigate();
    const [videos, setVideos] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load videos from localStorage or use defaults
        const storedVideos = localStorage.getItem("swm_training_videos");
        if (storedVideos) {
            setVideos(JSON.parse(storedVideos));
        } else {
            setVideos(DEFAULT_VIDEOS);
            localStorage.setItem("swm_training_videos", JSON.stringify(DEFAULT_VIDEOS));
        }
        setIsLoading(false);
    }, []);

    const categories = useMemo(() => {
        const cats = ["All", ...new Set(videos.map(v => v.category))];
        return cats;
    }, [videos]);

    const filteredVideos = useMemo(() => {
        return videos.filter(v => {
            const matchesCategory = selectedCategory === "All" || v.category === selectedCategory;
            const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                v.provider.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [videos, selectedCategory, searchQuery]);

    const stats = [
        { label: "Completed", count: videos.filter(v => v.status === "Completed").length, icon: CheckCircle2, color: "text-green-500" },
        { label: "Mandatory", count: videos.filter(v => v.status === "Mandatory").length, icon: Zap, color: "text-red-500" },
        { label: "Total Courses", count: videos.length, icon: BookOpen, color: "text-blue-500" },
    ];

    if (isLoading) return <div className="p-8 text-center font-bold">Loading Training Hub...</div>;

    return (
        <div className="flex flex-col bg-slate-50 min-h-screen -m-4 md:m-0 pb-20">
            {/* Premium Header */}
            <div className="bg-white px-6 py-8 border-b border-slate-200">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors border border-slate-100">
                        <ChevronLeft className="h-5 w-5 text-slate-600" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black font-display tracking-tight text-slate-900 flex items-center gap-2">
                            <GraduationCap className="h-6 w-6 text-purple-600" /> Learning Portal
                        </h2>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-0.5">Professional Certification Hub</p>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-200/50">
                            <stat.icon className={`h-4 w-4 ${stat.color} mb-1.5`} />
                            <p className="text-lg font-black leading-none">{stat.count}</p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search for skills, artists, or standards..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-12 pl-11 pr-4 rounded-xl bg-slate-100/50 border-none text-sm font-medium focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
                    />
                </div>
            </div>

            {/* Sticky Category Filter */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-3 border-b border-slate-200 overflow-x-auto hide-scrollbar">
                <div className="flex gap-2">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border-2 ${selectedCategory === cat
                                ? "bg-black border-black text-white shadow-lg shadow-black/10 scale-105"
                                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Courses Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredVideos.length > 0 ? (
                        filteredVideos.map((video, idx) => (
                            <motion.div
                                key={video.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <Card className="overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer bg-white rounded-3xl">
                                    <div className="relative aspect-video">
                                        <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" title={video.title} />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4">
                                            <div className="flex justify-between items-center">
                                                <Badge className="bg-white/90 backdrop-blur text-black font-black text-[9px] hover:bg-white border-none py-0.5 rounded-lg flex items-center gap-1">
                                                    <Clock className="h-2.5 w-2.5" /> {video.duration}
                                                </Badge>
                                                <div className="bg-purple-600 text-white p-2 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300 shadow-lg shadow-purple-600/30">
                                                    <Play className="h-4 w-4 fill-current" />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {video.status === "Mandatory" && (
                                            <div className="absolute top-3 left-3 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded-lg tracking-widest shadow-lg shadow-red-600/20 flex items-center gap-1">
                                                <Zap className="h-2.5 w-2.5 fill-current" /> Mandatory
                                            </div>
                                        )}
                                        {video.difficulty && (
                                            <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg tracking-widest">
                                                {video.difficulty}
                                            </div>
                                        )}
                                    </div>
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-black uppercase text-purple-600 tracking-tighter bg-purple-50 px-2 py-0.5 rounded-md">
                                                {video.category}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                                <Star className="h-2.5 w-2.5 fill-current text-amber-400" /> {video.views} enrolled
                                            </span>
                                        </div>
                                        <h3 className="font-black text-slate-900 group-hover:text-purple-700 transition-colors leading-tight mb-2">
                                            {video.title}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-4">
                                            {video.description || "Comprehensive training module by StylingwithMuskan experts."}
                                        </p>
                                        
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-200 border border-white overflow-hidden shadow-sm">
                                                    <img src={`https://ui-avatars.com/api/?name=${video.provider}&background=random`} alt={video.provider} />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-600 truncate max-w-[100px]">{video.provider}</span>
                                            </div>
                                            {video.status === "Completed" ? (
                                                <div className="flex items-center gap-1 text-green-600">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-black uppercase tracking-tight">Completed</span>
                                                </div>
                                            ) : (
                                                <button className="text-[10px] font-black uppercase tracking-tight text-purple-600 flex items-center gap-1 hover:gap-1.5 transition-all">
                                                    Watch Now <ArrowRight className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))
                    ) : (
                        <div className="col-span-full py-20 text-center">
                            <div className="bg-slate-100 inline-flex p-6 rounded-full mb-4">
                                <Search className="h-10 w-10 text-slate-300" />
                            </div>
                            <h4 className="text-xl font-black text-slate-900">No training modules found</h4>
                            <p className="text-sm text-slate-500 font-medium">Try searching for something else or change category</p>
                            <Button 
                                variant="outline" 
                                onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }}
                                className="mt-4 rounded-xl font-bold"
                            >
                                Reset Search
                            </Button>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
