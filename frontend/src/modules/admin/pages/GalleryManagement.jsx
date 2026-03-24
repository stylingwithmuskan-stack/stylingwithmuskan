import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Images, Plus, Save, Trash2, Upload, Image as ImageIcon } from "lucide-react";
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
    image: "",
    priority: 1,
    isActive: true,
};

export default function GalleryManagement() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [editingId, setEditingId] = useState("");
    const imageInputRef = useRef(null);

    const sortedItems = useMemo(
        () => [...items].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)),
        [items]
    );

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.admin.listGalleryItems();
            setItems(Array.isArray(res?.gallery) ? res.gallery : []);
        } catch (e) {
            toast.error(e?.message || "Failed to load gallery");
            setItems([]);
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
        setForm({ ...initialForm, id: `${Date.now()}` });
        setShowForm(true);
    };

    const openEdit = (item) => {
        setEditingId(item.id);
        setForm({
            id: item.id || "",
            title: item.title || "",
            image: item.image || "",
            priority: Number(item.priority || 1),
            isActive: item.isActive !== false,
        });
        setShowForm(true);
    };

    const handleImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const res = await api.admin.uploadGalleryImage(file);
            if (!res?.url) throw new Error("Upload failed");
            updateForm("image", res.url);
            toast.success("Image uploaded");
        } catch (e) {
            toast.error(e?.message || "Image upload failed");
        } finally {
            setUploading(false);
            event.target.value = "";
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.id || !form.title || !form.image) {
            toast.error("ID, title aur image required hai");
            return;
        }
        setSaving(true);
        const payload = {
            id: form.id.trim(),
            title: form.title.trim(),
            image: form.image.trim(),
            priority: Number(form.priority || 1),
            isActive: !!form.isActive,
        };
        try {
            if (editingId) await api.admin.updateGalleryItem(editingId, payload);
            else await api.admin.addGalleryItem(payload);
            toast.success(editingId ? "Gallery item updated" : "Gallery item created");
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

    const handleDelete = async (id) => {
        if (!window.confirm("Gallery item delete karna hai?")) return;
        try {
            await api.admin.deleteGalleryItem(id);
            toast.success("Deleted");
            await load();
        } catch (e) {
            toast.error(e?.message || "Delete failed");
        }
    };

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2"><Images className="h-7 w-7 text-primary" /> Gallery Manage</h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Home page Our Gallery section ke liye images manage karo</p>
                </div>
                <Button onClick={openCreate} className="gap-2 rounded-xl font-bold">
                    <Plus className="h-4 w-4" /> Add Gallery Item
                </Button>
            </motion.div>

            {showForm && (
                <Card className="border-border/50 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-base font-bold">{editingId ? "Edit Gallery Item" : "Create Gallery Item"}</CardTitle>
                        <CardDescription className="text-xs">Image URL store hoga aur same item user home gallery me show hoga</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold">Item ID</Label>
                                <Input value={form.id} onChange={(e) => updateForm("id", e.target.value)} className="rounded-xl h-10 bg-muted/30" required />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold">Title</Label>
                                <Input value={form.title} onChange={(e) => updateForm("title", e.target.value)} className="rounded-xl h-10 bg-muted/30" required />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label className="text-xs font-bold">Image URL</Label>
                                <div className="flex flex-col md:flex-row gap-2">
                                    <Input value={form.image} onChange={(e) => updateForm("image", e.target.value)} placeholder="https://res.cloudinary.com/..." className="rounded-xl h-10 bg-muted/30" required />
                                    <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-xl gap-2"
                                        disabled={uploading}
                                        onClick={() => imageInputRef.current?.click()}
                                    >
                                        <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload Image"}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold">Priority</Label>
                                <Input type="number" min={1} value={form.priority} onChange={(e) => updateForm("priority", Number(e.target.value || 1))} className="rounded-xl h-10 bg-muted/30" />
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
                                    <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Item"}
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
                        <CardContent className="py-10 text-sm text-muted-foreground">Loading gallery items...</CardContent>
                    </Card>
                ) : sortedItems.length === 0 ? (
                    <Card className="md:col-span-2 border-border/50">
                        <CardContent className="py-16 text-center">
                            <ImageIcon className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-sm font-bold text-muted-foreground">No gallery items found</p>
                        </CardContent>
                    </Card>
                ) : (
                    sortedItems.map((item) => (
                        <Card key={item.id} className="border-border/50 shadow-none overflow-hidden">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="text-sm font-bold">{item.title || "Untitled"}</h3>
                                        <p className="text-xs text-muted-foreground mt-1">{item.id}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px]">{item.isActive === false ? "Inactive" : "Active"}</Badge>
                                </div>
                                <img src={item.image} alt={item.title || "gallery item"} className="w-full h-40 rounded-lg object-cover bg-muted" />
                                <p className="text-[11px] text-muted-foreground break-all">{item.image}</p>
                                <div className="flex items-center justify-between gap-2">
                                    <Badge variant="outline" className="text-[10px]">P{Number(item.priority || 1)}</Badge>
                                    <div className="flex gap-2">
                                        <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-[11px]" onClick={() => openEdit(item)}>Edit</Button>
                                        <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-[11px] border-red-500/30 text-red-400" onClick={() => handleDelete(item.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
