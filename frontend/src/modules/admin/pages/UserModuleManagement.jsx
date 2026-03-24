import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Edit2, Trash2, Search, X, Camera, Image as ImageIcon } from "lucide-react";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { Button } from "@/modules/user/components/ui/button";
import { api } from "@/modules/user/lib/api";
import { toast } from "sonner";

const ImageUpload = ({ label, value, onChange, className = "" }) => {
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Create a canvas to resize/compress the image
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Max dimensions to keep localStorage footprint low
                    const MAX_SIZE = 800;
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with 0.8 quality
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    onChange(compressedDataUrl);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className={`space-y-1.5 ${className}`}>
            <label className="text-xs font-semibold text-muted-foreground uppercase block">{label}</label>
            <div className="flex items-center gap-3">
                <div
                    onClick={() => fileInputRef.current.click()}
                    className="w-16 h-16 rounded-xl bg-muted/50 border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:bg-muted transition-colors"
                >
                    {value ? (
                        <img src={value} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                        <Camera className="w-6 h-6 text-muted-foreground" />
                    )}
                </div>
                <div className="flex-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current.click()}
                        className="text-[10px] h-7"
                    >
                        {value ? "Change Image" : "Upload Image"}
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                    />
                </div>
                {value && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange("")}
                        className="text-red-500 hover:text-red-600 h-7 w-7 p-0"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </div>
    );
};

const BookingRulesConfig = ({ config, onUpdate }) => {
    const [localConfig, setLocalConfig] = useState(config || []);

    useEffect(() => {
        setLocalConfig(config || []);
    }, [config]);

    const handleSave = () => {
        onUpdate(localConfig);
        alert("Booking rules updated successfully!");
    };

    const updateItem = (id, key, value) => {
        setLocalConfig(prev => prev.map(item => item.id === id ? { ...item, [key]: value } : item));
    };

    return (
        <div className="bg-background rounded-2xl border border-border shadow-sm overflow-hidden p-6 space-y-6">
            <h2 className="text-lg font-bold text-foreground">Configure Booking Rules</h2>

            <div className="grid md:grid-cols-2 gap-6">
                {localConfig.map(item => (
                    <div key={item.id} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{item.icon}</span>
                            <div>
                                <h3 className="font-bold text-foreground">{item.label}</h3>
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                            </div>
                        </div>

                        {item.id === "scheduled" && (
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Max Advance Booking Days</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={item.maxAdvanceDays || 30}
                                    onChange={(e) => updateItem(item.id, 'maxAdvanceDays', Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">Users can book slots up to this many days in advance (e.g., 20, 30).</p>
                            </div>
                        )}

                        {item.id === "instant" && (
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Allowed Advance Days (Comma Separated)</label>
                                <input
                                    type="text"
                                    value={Array.isArray(item.allowedAdvanceDays) ? item.allowedAdvanceDays.join(', ') : (item.allowedAdvanceDays || "2, 5, 7")}
                                    onChange={(e) => {
                                        const values = e.target.value.split(',').map(v => Number(v.trim())).filter(v => !isNaN(v) && v > 0);
                                        updateItem(item.id, 'allowedAdvanceDays', values);
                                    }}
                                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">Specific days available before slot booking (e.g., 2, 5, 7).</p>
                            </div>
                        )}

                        {(item.id !== "scheduled" && item.id !== "instant") && (
                            <p className="text-xs text-muted-foreground italic">No custom rules configured yet for this type.</p>
                        )}
                        
                        <div className="pt-2 border-t border-border/40 mt-4">
                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Provider Response Time (Mins)</label>
                            <input
                                type="number"
                                min="1"
                                value={item.providerResponseTime || 20}
                                onChange={(e) => updateItem(item.id, 'providerResponseTime', Number(e.target.value))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Time allowed for the provider to accept before it vanishes.</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-2 flex justify-end">
                <Button onClick={handleSave} className="bg-primary text-primary-foreground font-bold">
                    Save Booking Rules
                </Button>
            </div>
        </div>
    );
};

const SystemSettingsConfig = () => {
    const [menEnabled, setMenEnabled] = useState(() => {
        return JSON.parse(localStorage.getItem('swm_men_enabled') ?? 'false');
    });

    const handleToggle = () => {
        const newValue = !menEnabled;
        setMenEnabled(newValue);
        localStorage.setItem('swm_men_enabled', JSON.stringify(newValue));
        alert(newValue ? "Men Category is now Enabled!" : "Men Category has been Disabled.");
    };

    return (
        <div className="bg-background rounded-2xl border border-border shadow-sm overflow-hidden p-6 space-y-6">
            <h2 className="text-lg font-bold text-foreground">Global System Settings</h2>
            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="font-bold text-foreground">Enable Men Section</h3>
                    <p className="text-xs text-muted-foreground mt-1">If disabled, users cannot access the Men panel. They will see a 'coming soon' message.</p>
                </div>
                <button 
                    onClick={handleToggle}
                    title={menEnabled ? 'Disable' : 'Enable'}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shadow-inner border border-black/10 ${menEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                    <span className={`${menEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'} inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow`} />
                </button>
            </div>
        </div>
    );
};

const AvailabilityEditor = ({ formData, setFormData }) => {
    const handleAddZone = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = e.target.value.trim();
            if (val && !(formData.zones || []).includes(val)) {
                setFormData({ ...formData, zones: [...(formData.zones || []), val] });
            }
            e.target.value = '';
        }
    };

    const removeZone = (idx) => {
        setFormData({ ...formData, zones: formData.zones.filter((_, i) => i !== idx) });
    };

    const addDisabledDate = () => {
        setFormData({
            ...formData,
            disabledDates: [...(formData.disabledDates || []), { date: '', startTime: '09:00', endTime: '21:00', fullDay: true }]
        });
    };

    const updateDisabledDate = (idx, key, value) => {
        const newDates = [...(formData.disabledDates || [])];
        newDates[idx] = { ...newDates[idx], [key]: value };
        // Clean up times if fullDay
        if (key === 'fullDay' && value) {
            newDates[idx].startTime = '00:00';
            newDates[idx].endTime = '23:59';
        }
        setFormData({ ...formData, disabledDates: newDates });
    };

    const removeDisabledDate = (idx) => {
        setFormData({ ...formData, disabledDates: formData.disabledDates.filter((_, i) => i !== idx) });
    };

    return (
        <div className="space-y-4 p-4 border border-border bg-muted/20 rounded-xl">
            <h4 className="text-sm font-bold text-foreground">Availability Rules</h4>

            {/* Zones */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Available Zones (Cities)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {(formData.zones || []).map((zone, idx) => (
                        <span key={idx} className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs flex items-center gap-1 font-bold">
                            {zone}
                            <button type="button" onClick={() => removeZone(idx)} className="text-primary hover:text-red-500"><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                    {!(formData.zones || []).length && (
                        <span className="text-[10px] text-muted-foreground italic">Available in all zones</span>
                    )}
                </div>
                <input
                    type="text"
                    placeholder="Type city name and press Enter (e.g. Indore)..."
                    onKeyDown={handleAddZone}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                />
            </div>

            {/* Disabled Dates/Times */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Disable specific dates & times</label>
                    <button type="button" onClick={addDisabledDate} className="text-[10px] bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90 transition-opacity">
                        + Add Exception
                    </button>
                </div>

                <div className="space-y-3">
                    {(formData.disabledDates || []).map((dateObj, idx) => (
                        <div key={idx} className="flex flex-col gap-2 p-3 bg-background border border-border rounded-xl relative">
                            <button type="button" onClick={() => removeDisabledDate(idx)} className="absolute top-2 right-2 text-red-500 hover:text-red-600">
                                <Trash2 className="w-3 h-3" />
                            </button>

                            <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                <input
                                    type="date"
                                    value={dateObj.date}
                                    onChange={e => updateDisabledDate(idx, 'date', e.target.value)}
                                    className="w-full px-2 py-1 bg-muted/50 border border-border rounded text-xs text-foreground focus:outline-none"
                                />
                                <label className="flex items-center gap-1 text-[10px] text-foreground font-medium">
                                    <input
                                        type="checkbox"
                                        checked={dateObj.fullDay}
                                        onChange={e => updateDisabledDate(idx, 'fullDay', e.target.checked)}
                                        className="w-3 h-3 rounded text-primary"
                                    />
                                    Full Day
                                </label>
                            </div>

                            {!dateObj.fullDay && (
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div>
                                        <p className="text-[9px] text-muted-foreground mb-0.5">Start Time</p>
                                        <input
                                            type="time"
                                            value={dateObj.startTime}
                                            onChange={e => updateDisabledDate(idx, 'startTime', e.target.value)}
                                            className="w-full px-2 py-1 bg-muted/50 border border-border rounded text-xs text-foreground focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-muted-foreground mb-0.5">End Time</p>
                                        <input
                                            type="time"
                                            value={dateObj.endTime}
                                            onChange={e => updateDisabledDate(idx, 'endTime', e.target.value)}
                                            className="w-full px-2 py-1 bg-muted/50 border border-border rounded text-xs text-foreground focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {!(formData.disabledDates || []).length && (
                        <p className="text-[10px] text-muted-foreground italic">No exceptions added. Item is fully available within its zone.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const UserModuleManagement = () => {
    const {
        categories, addCategory, updateCategory, deleteCategory,
        services, addService, updateService, deleteService,
        serviceTypes, bookingTypeConfig, updateBookingTypeConfig, addServiceType, updateServiceType, deleteServiceType,
        spotlights, addSpotlight, updateSpotlight, deleteSpotlight,
        gallery, addGallery, updateGallery, deleteGallery,
        testimonials, addTestimonial, updateTestimonial, deleteTestimonial
    } = useUserModuleData();

    const [activeTab, setActiveTab] = useState("parent_categories");
    const [searchTerm, setSearchTerm] = useState("");

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Form state
    const [formData, setFormData] = useState({});

    const handleOpenAdd = () => {
        setEditingItem(null);
        if (activeTab === "parent_categories") {
            setFormData({ label: "", description: "", image: "", color: "from-gray-400 to-gray-500", textColor: "text-gray-600", bgColor: "bg-gray-100", zones: [], disabledDates: [] });
        } else if (activeTab === "categories") {
            setFormData({ name: "", gender: "women", bookingType: "instant", serviceType: "skin", image: "", icon: "", advancePercentage: 0, zones: [], disabledDates: [] });
        } else if (activeTab === "spotlights") {
            setFormData({ title: "", category: "Makeup", video: "", poster: "" });
        } else if (activeTab === "gallery") {
            setFormData({ title: "", image: "" });
        } else if (activeTab === "testimonials") {
            setFormData({ name: "", rating: 5, feedback: "", image: "" });
        } else {
            setFormData({
                name: "",
                price: 0,
                category: "",
                gender: "women",
                rating: 5,
                reviews: 0,
                description: "",
                image: "",
                includes: "",
                steps: [],
                gallery: [],
                zones: [],
                disabledDates: []
            });
        }
        setIsAddModalOpen(true);
    };

    const handleOpenEdit = (item) => {
        setEditingItem(item);
        // Ensure steps and gallery are arrays, and convert includes to string for editing
        setFormData({
            ...item,
            steps: item.steps || [],
            gallery: item.gallery || [],
            includes: Array.isArray(item.includes) ? item.includes.join(', ') : (item.includes || "")
        });
        setIsAddModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this item?")) return;
        let ok = false;
        try {
            if (activeTab === "parent_categories") {
                await api.admin.deleteParent(id);
            } else if (activeTab === "categories") {
                await api.admin.deleteCategory(id);
            } else if (activeTab === "services") {
                await api.admin.deleteService(id);
            } else if (activeTab === "spotlights") {
                await api.admin.deleteSpotlight(id);
            } else if (activeTab === "gallery") {
                await api.admin.deleteGalleryItem(id);
            } else if (activeTab === "testimonials") {
                await api.admin.deleteTestimonial(id);
            }
            ok = true;
            toast.success("Deleted");
        } catch (e) {
            toast.error(e?.message || "Delete failed");
        }
        if (!ok) return;
        if (activeTab === "parent_categories") deleteServiceType(id);
        else if (activeTab === "categories") deleteCategory(id);
        else if (activeTab === "services") deleteService(id);
        else if (activeTab === "spotlights") deleteSpotlight(id);
        else if (activeTab === "gallery") deleteGallery(id);
        else if (activeTab === "testimonials") deleteTestimonial(id);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const payload = { ...formData };

        // Convert includes text back to array if it's a string
        if (typeof payload.includes === 'string') {
            payload.includes = payload.includes.split(',').map(s => s.trim()).filter(s => s !== '');
        }

        const isCreate = !payload.id;
        if (isCreate) payload.id = Date.now().toString();
        try {
            if (activeTab === "parent_categories") {
                if (isCreate) await api.admin.addParent(payload);
                else await api.admin.updateParent(payload.id, payload);
                if (isCreate) addServiceType(payload); else updateServiceType(payload.id, payload);
            } else if (activeTab === "categories") {
                if (isCreate) await api.admin.addCategory(payload);
                else await api.admin.updateCategory(payload.id, payload);
                if (isCreate) addCategory(payload); else updateCategory(payload.id, payload);
            } else if (activeTab === "services") {
                if (isCreate) await api.admin.addService(payload);
                else await api.admin.updateService(payload.id, payload);
                if (isCreate) addService(payload); else updateService(payload.id, payload);
            } else if (activeTab === "spotlights") {
                if (isCreate) await api.admin.addSpotlight(payload);
                else await api.admin.updateSpotlight(payload.id, payload);
                if (isCreate) addSpotlight(payload); else updateSpotlight(payload.id, payload);
            } else if (activeTab === "gallery") {
                if (isCreate) await api.admin.addGalleryItem(payload);
                else await api.admin.updateGalleryItem(payload.id, payload);
                if (isCreate) addGallery(payload); else updateGallery(payload.id, payload);
            } else if (activeTab === "testimonials") {
                if (isCreate) await api.admin.addTestimonial(payload);
                else await api.admin.updateTestimonial(payload.id, payload);
                if (isCreate) addTestimonial(payload); else updateTestimonial(payload.id, payload);
            }
            toast.success(isCreate ? "Created" : "Updated");
        } catch (e) {
            toast.error(e?.message || "Server action failed");
        } finally {
            setIsAddModalOpen(false);
        }
    };

    const getDataForTab = () => {
        if (activeTab === "parent_categories") return serviceTypes || [];
        if (activeTab === "categories") return categories || [];
        if (activeTab === "spotlights") return spotlights || [];
        if (activeTab === "gallery") return gallery || [];
        if (activeTab === "testimonials") return testimonials || [];
        return services || [];
    };

    const filteredData = getDataForTab().filter(item =>
        (item.name || item.label || item.title || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleGalleryUpload = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({
                    ...prev,
                    gallery: [...(prev.gallery || []), reader.result]
                }));
            };
            reader.readAsDataURL(file);
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">App Data Management</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage user module categories, services, and banners directly here.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex bg-muted p-1 rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar text-foreground border border-border">
                    {["parent_categories", "categories", "services", "spotlights", "gallery", "testimonials", "booking_rules", "system_settings"].map(tab => (
                        <button key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 sm:px-6 py-2 px-3 whitespace-nowrap rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                            {tab === "parent_categories" ? "Parent Categories" : tab === "categories" ? "Subcategories" : tab === "booking_rules" ? "Booking Rules" : tab === "system_settings" ? "System Core" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {activeTab !== "booking_rules" && activeTab !== "system_settings" && (
                    <div className="flex w-full sm:w-auto gap-3">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input type="text" placeholder={`Search ${activeTab}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                        </div>
                        <Button onClick={handleOpenAdd} className="bg-primary text-primary-foreground rounded-xl">
                            <Plus className="h-4 w-4 mr-2" /> Add New
                        </Button>
                    </div>
                )}
            </div>

            {activeTab !== "booking_rules" && activeTab !== "system_settings" ? (
                <div className="bg-background rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-3 md:px-4 text-left font-semibold w-20">Image/Icon</th>
                                    <th className="px-3 py-3 md:px-4 text-left font-semibold">Name/Title</th>
                                    {activeTab !== "parent_categories" && activeTab !== "spotlights" && activeTab !== "gallery" && activeTab !== "testimonials" && <th className="px-3 py-3 md:px-4 text-left font-semibold hidden md:table-cell">Details</th>}
                                    {activeTab === "parent_categories" && <th className="px-3 py-3 md:px-4 text-left font-semibold hidden md:table-cell">Description</th>}
                                    {activeTab === "testimonials" && <th className="px-3 py-3 md:px-4 text-left font-semibold hidden md:table-cell">Feedback</th>}
                                    {activeTab === "services" && <th className="px-3 py-3 md:px-4 text-left font-semibold hidden sm:table-cell">Price</th>}
                                    {(activeTab !== "spotlights" && activeTab !== "gallery" && activeTab !== "testimonials") && <th className="px-3 py-3 md:px-4 text-left font-semibold">Availability</th>}
                                    <th className="px-3 py-3 md:px-4 text-right font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredData.map((item, i) => (
                                    <motion.tr key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                        className="hover:bg-accent/5 transition-colors">
                                        <td className="px-3 py-3 md:px-4">
                                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
                                                {(item.image || item.poster) ? (
                                                    <img src={item.image || item.poster} alt={item.name || item.label || item.title} className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className="text-xl">{item.icon || "📄"}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 md:px-4">
                                            <p className="font-semibold text-sm text-foreground line-clamp-1">{item.name || item.label || item.title}</p>
                                            {(activeTab !== "parent_categories" && activeTab !== "spotlights" && activeTab !== "gallery" && activeTab !== "testimonials") && (
                                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-1 ${item.gender === 'women' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {item.gender}
                                                </span>
                                            )}
                                            {activeTab === "spotlights" && (
                                                 <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-1 bg-purple-100 text-purple-700">
                                                    {item.category}
                                                </span>
                                            )}
                                        </td>
                                        {(activeTab !== "parent_categories" && activeTab !== "spotlights" && activeTab !== "gallery" && activeTab !== "testimonials") && (
                                            <td className="px-3 py-3 md:px-4 hidden md:table-cell">
                                                {activeTab === "categories" ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs text-muted-foreground">Parent: <span className="font-medium text-foreground capitalize">{serviceTypes?.find(st => st.id === item.serviceType)?.label || item.serviceType || 'Unknown'}</span></span>
                                                        <span className="text-xs text-muted-foreground">Type: <span className="font-medium text-foreground">{bookingTypeConfig?.find(bt => bt.id === item.bookingType)?.label || item.bookingType || 'Unknown'}</span></span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-muted-foreground capitalize">{item.category}</span>
                                                )}
                                            </td>
                                        )}
                                        {activeTab === "parent_categories" && (
                                            <td className="px-3 py-3 md:px-4 hidden md:table-cell text-xs text-muted-foreground">
                                                <div className="line-clamp-2 max-w-[250px]">{item.description}</div>
                                            </td>
                                        )}
                                        {activeTab === "testimonials" && (
                                            <td className="px-3 py-3 md:px-4 hidden md:table-cell text-xs text-muted-foreground">
                                                <div className="line-clamp-2 max-w-[250px]">{item.feedback}</div>
                                            </td>
                                        )}
                                        {activeTab === "services" && (
                                            <td className="px-3 py-3 md:px-4 hidden sm:table-cell font-medium text-sm text-foreground">
                                                ₹{item.price}
                                            </td>
                                        )}
                                        {(activeTab !== "spotlights" && activeTab !== "gallery" && activeTab !== "testimonials") && (
                                            <td className="px-3 py-3 md:px-4">
                                            <div className="flex flex-col gap-1">
                                                {item.zones && item.zones.length > 0 ? (
                                                    <span className="inline-flex w-fit px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold uppercase tracking-tight">
                                                        {item.zones.length} Zones
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex w-fit px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-tight">Global</span>
                                                )}
                                                {item.disabledDates && item.disabledDates.length > 0 && (
                                                    <span className="inline-flex w-fit px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold uppercase tracking-tight">
                                                        {item.disabledDates.length} Exceptions
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        )}
                                        <td className="px-3 py-3 md:px-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleOpenEdit(item)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="h-4 w-4" /></button>
                                                <button onClick={() => handleDelete(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                                {filteredData.length === 0 && (
                                    <tr><td colSpan={10} className="px-6 py-12 text-center text-muted-foreground text-sm">No {activeTab} found matching your search.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === "system_settings" ? (
                <SystemSettingsConfig />
            ) : (
                <BookingRulesConfig config={bookingTypeConfig} onUpdate={updateBookingTypeConfig} />
            )}

            {/* Modal for Add/Edit */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-background w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                            <h3 className="font-bold text-lg text-foreground">{editingItem ? `Edit ${activeTab.replace("_", " ")}` : `Add ${activeTab.replace("_", " ")}`}</h3>
                            <button type="button" onClick={() => setIsAddModalOpen(false)} className="p-2 text-muted-foreground hover:bg-muted rounded-full"><X className="h-5 w-5" /></button>
                        </div>

                        <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
                            {activeTab === "spotlights" || activeTab === "gallery" || activeTab === "testimonials" ? (
                                <div className="space-y-4">
                                     <div className="space-y-4 text-foreground">
                                        {(activeTab === "spotlights" || activeTab === "gallery") && (
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Title</label>
                                                <input required type="text" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                            </div>
                                        )}
                                        {activeTab === "testimonials" && (
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Customer Name</label>
                                                <input required type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                            </div>
                                        )}
                                        {activeTab === "spotlights" && (
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Category</label>
                                                <input required type="text" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                            </div>
                                        )}
                                        {activeTab === "testimonials" && (
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Rating (Out of 5)</label>
                                                <input required type="number" min="1" max="5" value={formData.rating || ''} onChange={e => setFormData({ ...formData, rating: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                            </div>
                                        )}
                                        {activeTab === "testimonials" && (
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Feedback</label>
                                                <textarea required rows={4} value={formData.feedback || ''} onChange={e => setFormData({ ...formData, feedback: e.target.value })}
                                                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                            </div>
                                        )}
                                        {activeTab === "spotlights" && (
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Video URL (mp4)</label>
                                                <input required type="text" value={formData.video || ''} onChange={e => setFormData({ ...formData, video: e.target.value })}
                                                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                            </div>
                                        )}
                                        <ImageUpload
                                            label={activeTab === "spotlights" ? "Video Poster Image" : activeTab === "gallery" ? "Gallery Image" : "Customer Image"}
                                            value={activeTab === "spotlights" ? formData.poster : formData.image}
                                            onChange={(val) => {
                                                if (activeTab === "spotlights") {
                                                    setFormData({ ...formData, poster: val });
                                                } else {
                                                    setFormData({ ...formData, image: val });
                                                }
                                            }}
                                        />
                                     </div>
                                </div>
                            ) : activeTab === "parent_categories" ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Label / Name</label>
                                        <input required type="text" value={formData.label || ''} onChange={e => setFormData({ ...formData, label: e.target.value })}
                                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                    </div>
                                    <ImageUpload
                                        label="Category Image"
                                        value={formData.image}
                                        onChange={(val) => setFormData({ ...formData, image: val })}
                                    />
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Description</label>
                                        <input required type="text" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 text-foreground">
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Name</label>
                                        <input required type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                    </div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Gender</label>
                                    <select value={formData.gender || 'women'} onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground">
                                        <option value="women">Women</option>
                                        <option value="men">Men</option>
                                    </select>
                                    <ImageUpload
                                        label="Main Image"
                                        value={formData.image}
                                        onChange={(val) => setFormData({ ...formData, image: val })}
                                    />
                                </div>
                            )}

                            {activeTab === "categories" && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Parent Category</label>
                                            <select value={formData.serviceType || 'skin'} onChange={e => setFormData({ ...formData, serviceType: e.target.value })}
                                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground">
                                                {serviceTypes?.map(st => (
                                                    <option key={st.id} value={st.id}>{st.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Booking Type</label>
                                            <select value={formData.bookingType || 'instant'} onChange={e => setFormData({ ...formData, bookingType: e.target.value })}
                                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground">
                                                {bookingTypeConfig?.map(bt => (
                                                    <option key={bt.id} value={bt.id}>{bt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <ImageUpload
                                        label="Icon (Image)"
                                        value={formData.icon}
                                        onChange={(val) => setFormData({ ...formData, icon: val })}
                                    />
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Advance Payment Required (%)</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={formData.advancePercentage || 0}
                                                onChange={e => setFormData({ ...formData, advancePercentage: Number(e.target.value) })}
                                                className="w-24 px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                                            />
                                            <span className="text-xs text-muted-foreground">Percentage of total amount (0-100) to be paid during booking.</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "services" && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Price (₹)</label>
                                            <input required type="number" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Subcategory</label>
                                            <select required value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground">
                                                <option value="">Select Subcategory</option>
                                                {categories?.filter(c => c.gender === formData.gender).map(c => (
                                                    <option key={c.id + '-' + c.bookingType} value={c.id}>{c.name} ({c.bookingType})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Original Price (₹)</label>
                                            <input type="number" value={formData.originalPrice || ''} onChange={e => setFormData({ ...formData, originalPrice: Number(e.target.value) })}
                                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Duration</label>
                                            <input type="text" value={formData.duration || ''} onChange={e => setFormData({ ...formData, duration: e.target.value })} placeholder="60 min"
                                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Rating</label>
                                            <input type="number" step="0.1" value={formData.rating || ''} onChange={e => setFormData({ ...formData, rating: Number(e.target.value) })}
                                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Reviews</label>
                                            <input type="number" value={formData.reviews || ''} onChange={e => setFormData({ ...formData, reviews: Number(e.target.value) })}
                                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Description</label>
                                        <textarea rows={2} value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/50" />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Includes (Comma separated)</label>
                                        <input type="text" value={formData.includes || ''}
                                            onChange={e => setFormData({ ...formData, includes: e.target.value })}
                                            placeholder="e.g. Cleansing, Scrub, Mask"
                                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground shadow-sm" />
                                    </div>

                                    {/* Work Gallery Section */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase">Work Gallery (Before/After)</label>
                                            <label className="bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded cursor-pointer hover:opacity-90 transition-opacity">
                                                + Upload Photos
                                                <input type="file" multiple accept="image/*" onChange={handleGalleryUpload} className="hidden" />
                                            </label>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {formData.gallery?.map((img, idx) => (
                                                <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                                                    <img src={img} alt="Gallery" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, gallery: prev.gallery.filter((_, i) => i !== idx) }))}
                                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {(!formData.gallery || formData.gallery.length === 0) && (
                                                <div className="col-span-4 py-4 text-center text-[10px] text-muted-foreground border-2 border-dashed border-border rounded-xl">
                                                    No photos uploaded. Click upload to add before/after work photos.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase">Service Steps</label>
                                            <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px] text-primary"
                                                onClick={() => setFormData({ ...formData, steps: [...(formData.steps || []), { name: '', description: '', image: '' }] })}>
                                                + Add Step
                                            </Button>
                                        </div>
                                        <div className="space-y-4">
                                            {formData.steps?.map((step, idx) => (
                                                <div key={idx} className="p-3 bg-muted/30 rounded-xl border border-border relative space-y-3">
                                                    <button type="button" onClick={() => setFormData({ ...formData, steps: formData.steps.filter((_, i) => i !== idx) })}
                                                        className="absolute top-2 right-2 text-red-500 hover:text-red-600 transition-colors z-10">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>

                                                    <div className="space-y-3">
                                                        <div className="flex flex-col gap-2">
                                                            <input placeholder="Step Name (e.g. Cleansing)" value={step.name || ''} onChange={e => {
                                                                const newSteps = [...formData.steps];
                                                                newSteps[idx] = { ...newSteps[idx], name: e.target.value };
                                                                setFormData({ ...formData, steps: newSteps });
                                                            }} className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none" />

                                                            <textarea placeholder="Step Description..." rows={2} value={step.description || ''} onChange={e => {
                                                                const newSteps = [...formData.steps];
                                                                newSteps[idx] = { ...newSteps[idx], description: e.target.value };
                                                                setFormData({ ...formData, steps: newSteps });
                                                            }} className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none" />
                                                        </div>

                                                        <ImageUpload
                                                            label={`Step ${idx + 1} Image`}
                                                            value={step.image}
                                                            onChange={(val) => {
                                                                const newSteps = [...formData.steps];
                                                                newSteps[idx] = { ...newSteps[idx], image: val };
                                                                setFormData({ ...formData, steps: newSteps });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            {(!formData.steps || formData.steps.length === 0) && (
                                                <div className="py-4 text-center text-[10px] text-muted-foreground border-2 border-dashed border-border rounded-xl">
                                                    No steps added yet.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(activeTab !== "spotlights" && activeTab !== "gallery" && activeTab !== "testimonials") && (
                                <div className="pt-2">
                                    <AvailabilityEditor formData={formData} setFormData={setFormData} />
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3 shrink-0">
                                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">{editingItem ? "Save Changes" : "Create"}</Button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default UserModuleManagement;
