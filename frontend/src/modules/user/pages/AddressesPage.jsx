import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { ArrowLeft, MapPin, Home, Briefcase, Plus, MoreVertical, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import AddressModal from "@/modules/user/components/salon/AddressModal";

const AddressesPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { gender } = useGenderTheme();
    const { user, deleteAddress } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editAddress, setEditAddress] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);

    const savedAddresses = (user?.addresses || []).map(a => ({
        id: a._id || a.id,
        type: a.type,
        houseNo: a.houseNo,
        area: a.area,
        landmark: a.landmark,
        city: a.city,
        cityId: a.cityId,
        zone: a.zone,
        zoneId: a.zoneId,
        lat: a.lat,
        lng: a.lng
    }));

    const getIcon = (type) => {
        switch (type) {
            case "home": return Home;
            case "work": return Briefcase;
            default: return MapPin;
        }
    };

    return (
        <div className="min-h-screen bg-background pb-8" onClick={() => setOpenMenuId(null)}>
            {/* Header */}
            <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
                <button 
                    onClick={() => {
                        if (window.history.length > 1 && location.key !== "default") {
                            navigate(-1);
                        } else {
                            navigate("/home");
                        }
                    }} 
                    className="w-9 h-9 rounded-full bg-accent flex items-center justify-center active:scale-90 transition-transform"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>Saved Addresses</h1>
            </div>

            <div className="px-4 max-w-2xl mx-auto mt-6 space-y-6">
                <div className="space-y-4">
                    {savedAddresses.map((addr, i) => {
                        const Icon = getIcon(addr.type);
                        return (
                            <motion.div
                                key={addr.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="glass-strong rounded-[24px] p-5 border border-border/50 relative group"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <Icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-sm uppercase tracking-wider">{addr.type}</h3>
                                            <div className="relative">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === addr.id ? null : addr.id);
                                                    }}
                                                    className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors"
                                                >
                                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                </button>
                                                
                                                <AnimatePresence>
                                                    {openMenuId === addr.id && (
                                                        <motion.div 
                                                            initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                                            className="absolute right-0 top-10 w-32 bg-white rounded-xl shadow-xl border border-border z-20 py-1 overflow-hidden"
                                                        >
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditAddress({ 
                                                                        _id: addr.id, 
                                                                        type: addr.type, 
                                                                        houseNo: addr.houseNo, 
                                                                        area: addr.area, 
                                                                        landmark: addr.landmark,
                                                                        city: addr.city,
                                                                        cityId: addr.cityId,
                                                                        zone: addr.zone,
                                                                        zoneId: addr.zoneId,
                                                                        lat: addr.lat,
                                                                        lng: addr.lng
                                                                    }); 
                                                                    setIsModalOpen(true);
                                                                    setOpenMenuId(null);
                                                                }}
                                                                className="w-full px-3 py-2 text-xs font-bold flex items-center gap-2 hover:bg-primary/10 text-foreground transition-colors"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5 text-primary" /> Edit
                                                            </button>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    deleteAddress(addr.id);
                                                                    setOpenMenuId(null);
                                                                }}
                                                                className="w-full px-3 py-2 text-xs font-bold flex items-center gap-2 hover:bg-destructive/10 text-destructive transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" /> Remove
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                        <p className="text-sm font-semibold mt-1">{addr.houseNo}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{addr.area}</p>
                                        {addr.landmark && (
                                            <p className="text-[10px] text-primary mt-2 font-medium bg-primary/5 px-2 py-1 rounded-lg inline-block">
                                                Near {addr.landmark}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <Button
                    onClick={() => { setEditAddress(null); setIsModalOpen(true); }}
                    className="w-full h-14 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50 shadow-none gap-2"
                >
                    <Plus className="w-5 h-5" /> Add New Address
                </Button>
            </div>

            <AddressModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={() => {}}
                initialAddress={editAddress}
            />
        </div>
    );
};

export default AddressesPage;
