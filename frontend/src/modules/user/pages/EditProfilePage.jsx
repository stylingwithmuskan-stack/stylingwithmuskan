import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { ArrowLeft, Camera, User, Mail, Phone, MapPin, Check } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";

const EditProfilePage = () => {
    const navigate = useNavigate();
    const { gender } = useGenderTheme();
    const { user, updateProfile } = useAuth();

    const [formData, setFormData] = useState({
        name: user?.name || "Muskan",
        email: user?.email || "muskan@example.com",
        phone: user?.phone || "+91 98765 43210",
        image: user?.image || null
    });

    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, image: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = () => {
        setIsSaving(true);
        updateProfile({ name: formData.name })
            .then(() => navigate(-1))
            .finally(() => setIsSaving(false));
    };

    return (
        <div className="min-h-screen bg-background pb-8">
            {/* Header */}
            <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>Edit Profile</h1>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="text-primary font-bold text-sm px-4 py-2 hover:bg-primary/5 rounded-xl transition-all"
                >
                    {isSaving ? "Saving..." : "Done"}
                </button>
            </div>

            <div className="px-4 max-w-2xl mx-auto mt-4 space-y-4">
                {/* Photo Upload */}
                <div className="flex flex-col items-center">
                    <div className="relative group">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            accept="image/*"
                            className="hidden"
                        />
                        <div className="w-24 h-24 rounded-full bg-gradient-theme flex items-center justify-center shadow-xl p-1">
                            <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                                {formData.image ? (
                                    <img src={formData.image} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-10 h-10 text-primary/40" />
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => fileInputRef.current.click()}
                            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-2 border-background active:scale-95 transition-all"
                        >
                            <Camera className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Form Elements */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full h-12 pl-12 pr-4 rounded-xl bg-accent border-none text-base font-medium focus:ring-2 focus:ring-primary/20 transition-all font-body"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full h-12 pl-12 pr-4 rounded-xl bg-accent border-none text-base font-medium focus:ring-2 focus:ring-primary/20 transition-all font-body"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Phone Number</label>
                        <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="tel"
                                value={formData.phone}
                                readOnly
                                className="w-full h-12 pl-12 pr-4 rounded-xl bg-accent/50 border-none text-base font-medium opacity-60 cursor-not-allowed font-body"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground ml-1">Phone number cannot be changed once verified.</p>
                    </div>
                </div>

                <div className="pt-2">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20"
                    >
                        {isSaving ? "UPDATING..." : "SAVE CHANGES"}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EditProfilePage;
