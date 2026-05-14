import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clapperboard, Plus, Save, Trash2, Upload, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { Badge } from "@/modules/user/components/ui/badge";
import { api } from "@/modules/user/lib/api";
import { toast } from "sonner";

const initialForm = {
    id: "",
    title: "",
    category: "",
    video: "",
    poster: "",
    gender: "",
    priority: 1,
    isActive: true,
};

export default function ReelsManagement() {
    const [reels, setReels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [editingId, setEditingId] = useState("");
    const videoInputRef = useRef(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState(null);

    const sortedReels = useMemo(
        () => [...reels].sort((a, b) => (Number(a.priority || 0) - Number(b.priority || 0))),
        [reels]
    );

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.admin.listSpotlights();
            setReels(Array.isArray(res?.spotlights) ? res.spotlights : []);
        } catch (e) {
            toast.error(e?.message || "Failed to load reels");
            setReels([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const updateForm = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const openCreate = () => {
        setEditingId("");
        const maxPriority = reels.length > 0 ? Math.max(...reels.map(r => Number(r.priority || 0))) : 0;
        setForm({ ...initialForm, id: `${Date.now()}`, priority: maxPriority + 1 });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const openEdit = (item) => {
        setEditingId(item.id);
        setForm({
            id: item.id || "",
            title: item.title || "",
            category: item.category || "",
            video: item.video || "",
            poster: item.poster || "",
            gender: item.gender || "",
            priority: Number(item.priority || 1),
            isActive: item.isActive !== false,
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleVideoUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const res = await api.admin.uploadSpotlightVideo(file);
            if (!res?.url) throw new Error("Upload failed");
            updateForm("video", res.url);
            toast.success("Video uploaded to Cloudinary");
        } catch (e) {
            toast.error(e?.message || "Video upload failed");
        } finally {
            setUploading(false);
            event.target.value = "";
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.id || !form.title || !form.video) {
            toast.error("ID, title aur video required hai");
            return;
        }

        const duplicatePriority = reels.find(r => Number(r.priority) === Number(form.priority) && r.id !== editingId);
        if (duplicatePriority) {
            toast.error(`Priority ${form.priority} is already used by "${duplicatePriority.title}". Please use a unique priority.`);
            return;
        }

        setSaving(true);
        const payload = {
            id: form.id.trim(),
            title: form.title.trim(),
            category: form.category.trim(),
            video: form.video.trim(),
            poster: form.poster.trim(),
            gender: form.gender.trim(),
            priority: Number(form.priority || 1),
            isActive: !!form.isActive,
        };
        try {
            if (editingId) await api.admin.updateSpotlight(editingId, payload);
            else await api.admin.addSpotlight(payload);
            toast.success(editingId ? "Reel updated" : "Reel created");
            setShowForm(false);
            setEditingId("");
            setForm(initialForm);
            await load();
        } catch (e) {
            toast.error(e?.message || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id) => {
        setDeleteTargetId(id);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;
        try {
            await api.admin.deleteSpotlight(deleteTargetId);
            toast.success("Reel deleted successfully");
            await load();
        } catch (e) {
            toast.error(e?.message || "Delete failed");
        } finally {
            setShowDeleteConfirm(false);
            setDeleteTargetId(null);
        }
    };

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2"><Clapperboard className="h-7 w-7 text-primary" /> Reels Manage</h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Cloudinary video URL ke through reels create, update aur delete karo</p>
                </div>
                <Button onClick={openCreate} className="gap-2 rounded-xl font-bold">
                    <Plus className="h-4 w-4" /> Add Reel
                </Button>
            </motion.div>

            {showForm && (
                <Card className="border-border/50 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-base font-bold">{editingId ? "Edit Reel" : "Create Reel"}</CardTitle>
                        <CardDescription className="text-xs">Video Cloudinary me upload hoga, database me sirf URL save hoga</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold">Reel ID</Label>
                                <Input value={form.id} onChange={(e) => updateForm("id", e.target.value)} className="rounded-xl h-10 bg-muted/30" required />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold">Title</Label>
                                <Input value={form.title} onChange={(e) => updateForm("title", e.target.value)} className="rounded-xl h-10 bg-muted/30" required />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold">Category</Label>
                                <Input value={form.category} onChange={(e) => updateForm("category", e.target.value)} className="rounded-xl h-10 bg-muted/30" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold">Gender (optional)</Label>
                                <Input value={form.gender} onChange={(e) => updateForm("gender", e.target.value)} placeholder="women / men / empty" className="rounded-xl h-10 bg-muted/30" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label className="text-xs font-bold">Video URL</Label>
                                <div className="flex flex-col md:flex-row gap-2">
                                    <Input value={form.video} onChange={(e) => updateForm("video", e.target.value)} placeholder="https://res.cloudinary.com/..." className="rounded-xl h-10 bg-muted/30" required />
                                    <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-xl gap-2"
                                        disabled={uploading}
                                        onClick={() => videoInputRef.current?.click()}
                                    >
                                        <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload Video"}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label className="text-xs font-bold">Poster URL</Label>
                                <Input value={form.poster} onChange={(e) => updateForm("poster", e.target.value)} placeholder="https://..." className="rounded-xl h-10 bg-muted/30" />
                            </div>
                             <div className="space-y-2">
                                <Label className="text-xs font-bold">Priority (Unique)</Label>
                                <Input type="number" min={1} value={form.priority} onChange={(e) => updateForm("priority", Number(e.target.value || 1))} className="rounded-xl h-10 bg-muted/30" />
                                {reels.some(r => Number(r.priority) === Number(form.priority) && r.id !== editingId) && (
                                    <p className="text-[10px] text-red-500 font-bold">Priority already in use!</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold">Status</Label>
                                <select
                                    value={form.isActive ? "active" : "inactive"}
                                    onChange={(e) => updateForm("isActive", e.target.value === "active")}
                                    className="w-full rounded-xl h-10 bg-muted/30 border border-input px-3 text-sm"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                            <div className="md:col-span-2 flex gap-2">
                                <Button type="submit" className="rounded-xl font-bold gap-2" disabled={saving || uploading}>
                                    <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Reel"}
                                </Button>
                                <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setShowForm(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-3 md:grid-cols-2">
                {loading ? (
                    <Card className="md:col-span-2 border-border/50">
                        <CardContent className="py-10 text-sm text-muted-foreground">Loading reels...</CardContent>
                    </Card>
                ) : sortedReels.length === 0 ? (
                    <Card className="md:col-span-2 border-border/50">
                        <CardContent className="py-16 text-center">
                            <Video className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-sm font-bold text-muted-foreground">No reels found</p>
                        </CardContent>
                    </Card>
                ) : (
                    sortedReels.map((reel) => (
                        <Card key={reel._id || reel.id} className="border-border/50 shadow-none overflow-hidden">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="text-sm font-bold">{reel.title || "Untitled"}</h3>
                                        <p className="text-xs text-muted-foreground mt-1">{reel.category || "No category"}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px]">{reel.isActive === false ? "Inactive" : "Active"}</Badge>
                                </div>
                                <video className="w-full h-40 rounded-lg object-cover bg-black" src={reel.video} controls playsInline poster={reel.poster || ""} />
                                <p className="text-[11px] text-muted-foreground break-all">{reel.video}</p>
                                <div className="flex items-center justify-between gap-2">
                                    <Badge variant="outline" className="text-[10px]">P{Number(reel.priority || 1)}</Badge>
                                    <div className="flex gap-2">
                                        <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-[11px]" onClick={() => openEdit(reel)}>Edit</Button>
                                        <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-[11px] border-red-500/30 text-red-400" onClick={() => handleDelete(reel.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Redesigned Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6 shadow-inner ring-4 ring-red-50/50">
                                    <Trash2 className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Delete Reel?</h3>
                                <p className="text-sm text-slate-500 font-bold leading-relaxed mb-8">
                                    Are you sure you want to remove this reel? This action will permanently delete the content and cannot be undone.
                                </p>
                            </div>
                            
                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={confirmDelete}
                                    className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-base shadow-lg shadow-red-100 transition-all active:scale-[0.98]"
                                >
                                    Delete Permanently
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setDeleteTargetId(null);
                                    }}
                                    className="w-full h-12 rounded-2xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Keep it for now
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
