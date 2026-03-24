import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Plus, Search, Edit2, Trash2, X, Play, Clock, 
    GraduationCap, CheckCircle2, Zap, Star, LayoutGrid,
    BookOpen, Eye, Save, AlertCircle, Camera
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Badge } from "@/modules/user/components/ui/badge";
import { toast } from "sonner";

const CATEGORIES = ["Hair Styling", "Makeup", "Skin Care", "Hygiene", "Business Skills", "Safety"];
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const STATUSES = ["New", "Mandatory", "Optional", "Completed"];

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
        difficulty: "Advanced",
        videoUrl: "https://example.com/video1"
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
        difficulty: "Intermediate",
        videoUrl: "https://example.com/video2"
    }
];

export default function TrainingManagement() {
    const [videos, setVideos] = useState([]);
    const [isMobile, setIsMobile] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVideo, setEditingVideo] = useState(null);
    const [formData, setFormData] = useState({
        title: "",
        category: "Hair Styling",
        duration: "",
        status: "New",
        thumbnail: "",
        provider: "SWM Academy",
        description: "",
        difficulty: "Beginner",
        videoUrl: "",
        views: "0"
    });

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        
        const stored = localStorage.getItem("swm_training_videos");
        if (stored) {
            setVideos(JSON.parse(stored));
        } else {
            setVideos(DEFAULT_VIDEOS);
            localStorage.setItem("swm_training_videos", JSON.stringify(DEFAULT_VIDEOS));
        }
        
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    const saveVideos = (newVideos) => {
        setVideos(newVideos);
        localStorage.setItem("swm_training_videos", JSON.stringify(newVideos));
    };

    const handleOpenModal = (video = null) => {
        if (video) {
            setEditingVideo(video);
            setFormData({ ...video });
        } else {
            setEditingVideo(null);
            setFormData({
                title: "",
                category: "Hair Styling",
                duration: "00:00",
                status: "New",
                thumbnail: "",
                provider: "SWM Academy",
                description: "",
                difficulty: "Beginner",
                videoUrl: "",
                views: "0"
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.title || !formData.thumbnail) {
            toast.error("Please fill all required fields");
            return;
        }

        if (editingVideo) {
            const updated = videos.map(v => v.id === editingVideo.id ? { ...formData, id: v.id } : v);
            saveVideos(updated);
            toast.success("Training module updated");
        } else {
            const newVideo = {
                ...formData,
                id: Date.now(),
                views: "0"
            };
            saveVideos([newVideo, ...videos]);
            toast.success("New training module added");
        }
        setIsModalOpen(false);
    };

    const handleDelete = (id) => {
        if (window.confirm("Are you sure you want to delete this training?")) {
            const updated = videos.filter(v => v.id !== id);
            saveVideos(updated);
            toast.success("Training module deleted");
        }
    };

    const filteredVideos = videos.filter(v => 
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <GraduationCap className="h-6 w-6 text-primary" /> Training Management
                    </h1>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">Admin Content Control Panel</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-primary/20 gap-2">
                    <Plus className="h-4 w-4" /> Add Training Module
                </Button>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by title or category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-11 h-12 rounded-xl bg-card border-border/50 shadow-sm"
                    />
                </div>
            </div>

            {/* Grid View */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredVideos.map((video) => (
                        <motion.div
                            key={video.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <Card className="overflow-hidden border-border/50 shadow-none hover:shadow-xl hover:border-primary/30 transition-all duration-300 group rounded-3xl bg-card/50">
                                <div className="relative aspect-video">
                                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                                        <Button size="icon" variant="secondary" onClick={() => handleOpenModal(video)} className="rounded-full h-10 w-10">
                                            <Edit2 className="h-4 w-4 text-primary" />
                                        </Button>
                                        <Button size="icon" variant="destructive" onClick={() => handleDelete(video.id)} className="rounded-full h-10 w-10">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="absolute top-3 left-3 flex gap-2">
                                        <Badge className="bg-white/90 backdrop-blur text-black font-black text-[8px] hover:bg-white border-none py-0.5 rounded-lg flex items-center gap-1 uppercase tracking-tighter">
                                            {video.category}
                                        </Badge>
                                        {video.status === "Mandatory" && (
                                            <Badge className="bg-red-500 text-white font-black text-[8px] border-none py-0.5 rounded-lg flex items-center gap-1 uppercase tracking-tighter">
                                                <Zap className="h-2.5 w-2.5 fill-current" /> Mandatory
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="absolute bottom-3 right-3 bg-black/70 text-white text-[9px] font-black px-2 py-0.5 rounded-lg">
                                        {video.duration}
                                    </div>
                                </div>
                                <CardContent className="p-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary">
                                            {video.difficulty}
                                        </Badge>
                                        <span className="text-[9px] text-muted-foreground font-bold flex items-center gap-1">
                                            <Eye className="h-3 w-3" /> {video.views} Views
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-sm leading-tight mb-2 line-clamp-1">{video.title}</h3>
                                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                                        {video.description}
                                    </p>
                                    <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Play className="h-3 w-3 text-primary" />
                                        </div>
                                        <span className="text-[10px] font-bold text-muted-foreground truncate">{video.provider}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-10">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                            animate={{ scale: 1, opacity: 1, y: 0 }} 
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-2xl bg-background rounded-[32px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        >
                            <div className="p-6 border-b flex items-center justify-between">
                                <h2 className="text-xl font-black">{editingVideo ? "Edit Training" : "New Training Module"}</h2>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="h-5 w-5" /></button>
                            </div>
                            
                            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Video Title *</label>
                                        <Input 
                                            value={formData.title} 
                                            onChange={e => setFormData({...formData, title: e.target.value})} 
                                            placeholder="Enter descriptive title" 
                                            className="h-12 rounded-xl"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Category</label>
                                            <select 
                                                value={formData.category} 
                                                onChange={e => setFormData({...formData, category: e.target.value})}
                                                className="w-full h-12 px-4 rounded-xl bg-card border border-border outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold appearance-none"
                                            >
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Difficulty</label>
                                            <select 
                                                value={formData.difficulty} 
                                                onChange={e => setFormData({...formData, difficulty: e.target.value})}
                                                className="w-full h-12 px-4 rounded-xl bg-card border border-border outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold appearance-none"
                                            >
                                                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Duration (min:sec)</label>
                                            <Input 
                                                value={formData.duration} 
                                                onChange={e => setFormData({...formData, duration: e.target.value})} 
                                                placeholder="e.g. 15:30" 
                                                className="h-12 rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Status Tag</label>
                                            <select 
                                                value={formData.status} 
                                                onChange={e => setFormData({...formData, status: e.target.value})}
                                                className="w-full h-12 px-4 rounded-xl bg-card border border-border outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold appearance-none"
                                            >
                                                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Thumbnail URL *</label>
                                        <div className="flex gap-4 items-center">
                                            <Input 
                                                value={formData.thumbnail} 
                                                onChange={e => setFormData({...formData, thumbnail: e.target.value})} 
                                                placeholder="https://images.unsplash.com/..." 
                                                className="h-12 rounded-xl flex-1"
                                            />
                                            {formData.thumbnail && (
                                                <div className="h-12 w-12 rounded-xl overflow-hidden border">
                                                    <img src={formData.thumbnail} className="h-full w-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Video Link (YouTube/Vimeo)</label>
                                        <Input 
                                            value={formData.videoUrl} 
                                            onChange={e => setFormData({...formData, videoUrl: e.target.value})} 
                                            placeholder="https://youtube.com/..." 
                                            className="h-12 rounded-xl"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Provider Name</label>
                                        <Input 
                                            value={formData.provider} 
                                            onChange={e => setFormData({...formData, provider: e.target.value})} 
                                            placeholder="SWM Academy, Senior Artist, etc." 
                                            className="h-12 rounded-xl"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Description</label>
                                        <textarea 
                                            value={formData.description} 
                                            onChange={e => setFormData({...formData, description: e.target.value})} 
                                            rows={3} 
                                            className="w-full p-4 rounded-xl bg-card border border-border outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium resize-none"
                                            placeholder="Explain what the professional will learn in this module..."
                                        />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full h-14 rounded-2xl text-base font-black gap-2">
                                    <Save className="h-5 w-5" /> {editingVideo ? "Save Changes" : "Publish Training"}
                                </Button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
