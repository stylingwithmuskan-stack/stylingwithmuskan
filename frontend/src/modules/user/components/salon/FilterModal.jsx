import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";

const FilterModal = ({ isOpen, onClose, onApply, currentFilters }) => {
    const [tempFilters, setTempFilters] = useState({
        concern: null,
        skinType: null,
        other: null,
        priceRange: null
    });

    useEffect(() => {
        if (isOpen) {
            setTempFilters({
                concern: currentFilters.concern || null,
                skinType: currentFilters.skinType || null,
                other: currentFilters.other || null,
                priceRange: currentFilters.priceRange || null
            });
        }
    }, [isOpen, currentFilters]);

    const sections = [
        {
            id: "concern",
            title: "Concerns",
            options: ["Dullness", "Dark Spots/ Pigmentation", "Tanning", "Uneven Skin Tone", "Dryness", "Anti-Ageing"]
        },
        {
            id: "skinType",
            title: "Skin Type",
            options: ["Normal Skin", "Dry Skin", "Normal To Dry Skin", "Oily Skin", "All Skin Types"]
        },
        {
            id: "other",
            title: "Others",
            options: ["Korean", "Special Occassion", "Ayurvedic", "Regular Facials", "Premium Facials", "Bridal Facial", "Hydra Facial"]
        },
        {
            id: "priceRange",
            title: "Price Range",
            options: ["Under ₹999", "₹1000 - ₹1200", "₹1200 - ₹1999", "Above ₹1999"]
        }
    ];

    const handleSelect = (sectionId, option) => {
        setTempFilters(prev => ({
            ...prev,
            [sectionId]: prev[sectionId] === option ? null : option
        }));
    };

    const handleClear = () => {
        setTempFilters({
            concern: null,
            skinType: null,
            other: null,
            priceRange: null
        });
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                />

                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="relative w-full max-w-lg bg-background rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                >
                    {/* Close Button on top right outside of card in mobile, but here inside for better UI */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg z-50 sm:hidden"
                        style={{ transform: 'translateY(-150%)' }}
                    >
                        <X className="w-6 h-6 text-black" />
                    </button>

                    <div className="hidden sm:block absolute top-4 right-4 z-50">
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-accent transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Header */}
                    <div className="px-6 py-6 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                        <h2 className="text-2xl font-bold tracking-tight">Select Your Preferences</h2>
                        <p className="text-xs text-muted-foreground mt-1">You can select multiple filters as per your need</p>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8 hide-scrollbar pb-32">
                        {sections.map((section) => (
                            <div key={section.id} className="space-y-4">
                                <h3 className="text-base font-bold tracking-tight">{section.title}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {section.options.map((option) => (
                                        <button
                                            key={option}
                                            onClick={() => handleSelect(section.id, option)}
                                            className={`px-4 py-2.5 rounded-full text-xs font-medium transition-all duration-200 border ${tempFilters[section.id] === option
                                                    ? "bg-black text-white border-black shadow-md scale-105"
                                                    : "bg-accent/50 text-muted-foreground border-transparent hover:border-border"
                                                }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                                <div className="h-px bg-dashed-border w-full opacity-30 mt-6" style={{ backgroundImage: 'linear-gradient(to right, #ccc 50%, rgba(255,255,255,0) 0%)', backgroundSize: '10px 1px', backgroundRepeat: 'repeat-x' }} />
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-background border-t border-border/50 flex items-center gap-4 sticky bottom-0 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                        <button
                            onClick={handleClear}
                            className="text-sm font-bold text-rose-600 uppercase tracking-widest px-4 hover:bg-rose-50 rounded-xl py-2 transition-colors"
                        >
                            CLEAR
                        </button>
                        <Button
                            onClick={() => onApply(tempFilters)}
                            className="flex-1 h-14 rounded-2xl text-sm font-bold bg-neutral-300 text-neutral-600 hover:bg-neutral-400 transition-all uppercase tracking-widest"
                            style={Object.values(tempFilters).some(v => v !== null) ? { backgroundColor: '#000', color: '#fff' } : {}}
                        >
                            APPLY FILTER
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default FilterModal;
