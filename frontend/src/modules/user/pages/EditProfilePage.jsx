import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { ArrowLeft, Camera, User, Mail, Phone, MapPin, Check, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { toast } from "sonner";

const EditProfilePage = () => {
    const navigate = useNavigate();
    const { gender } = useGenderTheme();
    const { user, updateProfile, updateAvatar } = useAuth();
    const [formData, setFormData] = useState({
        name: user?.name || "",
        email: user?.email || "",
        phone: user?.phone || "",
        image: user?.avatar || null
    });
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showActionSheet, setShowActionSheet] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const galleryInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            // Basic validation
            if (!file.type.startsWith('image/')) {
                toast.error("Please select a valid image file");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                toast.error("Image size should be less than 5MB");
                return;
            }

            setSelectedFile(file);
            setShowActionSheet(false);

            // Preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, image: reader.result }));
            };
            reader.readAsDataURL(file);

            // AUTO-UPDATE AVATAR (User said photo update nhi ho rahi - maybe they didn't click Save)
            // Let's update immediately for better UX
            setIsUploadingImage(true);
            try {
                await updateAvatar(file);
                toast.success("Profile photo updated successfully");
            } catch (err) {
                console.error("Avatar update failed:", err);
                toast.error("Failed to update profile photo. Please try again.");
            } finally {
                setIsUploadingImage(false);
            }
        }
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error("Name is required");
            return;
        }
        if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
            toast.error("Please enter a valid email address");
            return;
        }
        
        setIsSaving(true);
        try {
            // Update basic profile
            await updateProfile({ 
                name: formData.name.trim(), 
                email: formData.email.trim() 
            });
            
            toast.success("Profile updated successfully");
            setTimeout(() => navigate(-1), 1000);
        } catch (err) {
            toast.error(err.message || "Failed to update profile");
        } finally {
            setIsSaving(false);
        }
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
                    disabled={isSaving || isUploadingImage}
                    className="text-primary font-bold text-sm px-4 py-2 hover:bg-primary/5 rounded-xl transition-all disabled:opacity-50"
                >
                    {isSaving ? "Saving..." : "Done"}
                </button>
            </div>

            <div className="px-4 max-w-2xl mx-auto mt-4 space-y-4">
                {/* Photo Upload Section */}
                <div className="flex flex-col items-center">
                    <div className="relative">
                        <div className={`w-32 h-32 rounded-full bg-gradient-theme flex items-center justify-center shadow-xl p-1 transition-all ${isUploadingImage ? 'animate-pulse' : ''}`}>
                            <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden relative">
                                {formData.image ? (
                                    <img src={formData.image} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center opacity-40">
                                        <User className="w-10 h-10 text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-tighter mt-1">NO PHOTO</span>
                                    </div>
                                )}
                                
                                {isUploadingImage && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setShowActionSheet(true)}
                            className="absolute bottom-1 right-1 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-4 border-background active:scale-90 transition-all z-10"
                        >
                            <Camera className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="mt-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tap camera to change photo</p>
                </div>

                {/* Form Elements */}
                <div className="space-y-4 mt-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Your full name"
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
                                placeholder="your@email.com"
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
                        <p className="text-[9px] text-muted-foreground ml-1 font-medium italic">* Phone number is verified and cannot be changed.</p>
                    </div>
                </div>

                <div className="pt-6">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || isUploadingImage}
                        className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 bg-black text-white hover:bg-black/90"
                    >
                        {isSaving ? "UPDATING PROFILE..." : "SAVE CHANGES"}
                    </Button>
                </div>
            </div>

            {/* Hidden Inputs */}
            <input
                type="file"
                ref={galleryInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
            />
            <input
                type="file"
                ref={cameraInputRef}
                onChange={handleImageChange}
                accept="image/*"
                capture="user"
                className="hidden"
            />

            {/* Action Sheet for Photo Selection */}
            <AnimatePresence>
                {showActionSheet && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowActionSheet(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 bg-background rounded-t-[32px] p-6 pb-10 z-[101] shadow-2xl border-t border-border"
                        >
                            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />
                            
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold font-display uppercase tracking-tight">Update Photo</h3>
                                <button onClick={() => setShowActionSheet(false)} className="p-2 rounded-full hover:bg-accent transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => cameraInputRef.current.click()}
                                    className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-accent/50 border-2 border-transparent hover:border-primary/30 transition-all active:scale-95"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                                        <Camera className="w-7 h-7 text-primary" />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-widest">Take Photo</span>
                                </button>

                                <button
                                    onClick={() => galleryInputRef.current.click()}
                                    className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-accent/50 border-2 border-transparent hover:border-primary/30 transition-all active:scale-95"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-secondary/20 flex items-center justify-center">
                                        <ImageIcon className="w-7 h-7 text-secondary-foreground" />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-widest">Gallery</span>
                                </button>
                            </div>

                            {formData.image && (
                                <button
                                    onClick={() => {
                                        setFormData(prev => ({ ...prev, image: null }));
                                        setSelectedFile(null);
                                        setShowActionSheet(false);
                                        toast.info("Photo removed from preview");
                                    }}
                                    className="w-full mt-6 py-4 rounded-2xl text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 transition-colors border border-red-100"
                                >
                                    Remove Current Photo
                                </button>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default EditProfilePage;
