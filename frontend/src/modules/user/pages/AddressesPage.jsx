import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { ArrowLeft, MapPin, Home, Briefcase, Plus, MoreVertical, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import AddressModal from "@/modules/user/components/salon/AddressModal";

const AddressesPage = () => {
    const navigate = useNavigate();
    const { gender } = useGenderTheme();
    const { user, deleteAddress } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editAddress, setEditAddress] = useState(null);

    const savedAddresses = (user?.addresses || []).map(a => ({
        id: a._id || a.id,
        type: a.type,
        houseNo: a.houseNo,
        area: a.area,
        landmark: a.landmark
    }));

    const getIcon = (type) => {
        switch (type) {
            case "home": return Home;
            case "work": return Briefcase;
            default: return MapPin;
        }
    };

    return (
        <div className="min-h-screen bg-background pb-8">
            {/* Header */}
            <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
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
                                    <button className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center">
                                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                            </button>
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

                                {/* Quick Actions */}
                                <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                                    <button
                                        onClick={() => { setEditAddress(a => ({ _id: addr.id, type: addr.type, houseNo: addr.houseNo, area: addr.area, landmark: addr.landmark })); setIsModalOpen(true); }}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </button>
                                    <div className="w-px h-4 bg-border self-center" />
                                    <button
                                        onClick={() => deleteAddress(addr.id)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-destructive hover:opacity-80 transition-opacity">
                                        <Trash2 className="w-3.5 h-3.5" /> Remove
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <Button
                    onClick={() => setIsModalOpen(true)}
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
