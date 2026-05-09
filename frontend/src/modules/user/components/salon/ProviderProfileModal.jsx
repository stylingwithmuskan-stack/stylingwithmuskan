import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, MapPin, Award, CheckCircle, ShieldCheck, Phone, Briefcase } from 'lucide-react';
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";

export default function ProviderProfileModal({ isOpen, onClose, provider }) {
    const { gender } = useGenderTheme();
    const isWomen = gender === 'women';

    if (!isOpen || !provider) return null;

    // Resolve dynamic values - use actual data, show "N/A" or hide if missing
    const providerRating = Number(provider.rating) || 0;
    const providerExperience = provider.experience || '';
    const providerCity = provider.city || '';
    const providerPhone = provider.phone || '';
    const providerCompletedJobs = provider.completedJobs || provider.totalJobs || 0;
    const providerZones = Array.isArray(provider.zones) ? provider.zones : [];

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-sm bg-background rounded-[32px] overflow-hidden shadow-2xl relative border border-border"
                >
                    {/* Header Image / Cover */}
                    <div className="h-28 bg-gradient-to-tr from-primary/30 to-primary/10 relative">
                        <button 
                            onClick={onClose}
                            className="absolute top-4 right-4 w-8 h-8 bg-black/10 hover:bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center transition-colors"
                        >
                            <X className="w-5 h-5 text-foreground" />
                        </button>
                    </div>

                    <div className="px-6 pb-6 relative">
                        {/* Avatar */}
                        <div className="absolute -top-12 left-6 w-24 h-24 rounded-3xl border-4 border-background bg-accent overflow-hidden shadow-xl flex items-center justify-center">
                            {provider.image ? (
                                <img 
                                    src={provider.image}
                                    alt={provider.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-3xl font-black text-primary">{provider.name?.charAt(0)}</span>
                            )}
                        </div>

                        <div className="pt-14">
                            <h2 className={`text-2xl font-black flex items-center gap-2 tracking-tight ${isWomen ? "font-display" : "font-heading-men"}`}>
                                {provider.name}
                                <ShieldCheck className="w-5 h-5 text-blue-500" />
                            </h2>
                            
                            {/* Phone number */}
                            {providerPhone && (
                                <p className="text-[13px] font-bold text-primary mt-1 tracking-widest">
                                    {providerPhone}
                                </p>
                            )}

                            {/* Specialties / Service Type */}
                            {provider.specialties?.length > 0 && (
                                <p className="text-[11px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">
                                    {provider.specialties.join(", ")}
                                </p>
                            )}
                            
                            <div className="flex items-center gap-3 mt-4 pb-5 border-b border-border/60">
                                {/* Rating - show actual value or "New" if 0 */}
                                <span className="flex items-center gap-1.5 text-[13px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-xl">
                                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                                    {providerRating > 0 ? `${providerRating} Rating` : 'New'}
                                </span>
                                
                                {/* Experience - show only if available */}
                                {providerExperience && (
                                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground bg-muted hover:bg-muted/80 px-2.5 py-1.5 rounded-xl transition-colors">
                                        <Award className="w-4 h-4 text-primary" />
                                        {providerExperience} Exp.
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-5">
                                {/* Primary City - show only if available */}
                                {providerCity && (
                                    <div className="bg-muted/30 p-3 rounded-2xl border border-border/50">
                                        <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground mb-1 block">Primary City</p>
                                        <p className="text-sm font-bold leading-tight flex items-center gap-1.5 truncate">
                                            <MapPin className="w-4 h-4 text-primary" />
                                            {providerCity}
                                        </p>
                                    </div>
                                )}
                                
                                {/* Completed Jobs - always show */}
                                <div className="bg-muted/30 p-3 rounded-2xl border border-border/50">
                                    <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground mb-1 block">Completed Jobs</p>
                                    <p className="text-sm font-black leading-tight flex items-center gap-1.5">
                                        <Briefcase className="w-4 h-4 text-primary" />
                                        {Number(providerCompletedJobs) > 0 ? `${providerCompletedJobs} Services` : 'New Provider'}
                                    </p>
                                </div>
                            </div>

                            {/* Covered Zones */}
                            {providerZones.length > 0 && (
                                <div className="mt-4 bg-primary/5 p-3 rounded-2xl border border-primary/10">
                                    <p className="text-[9px] uppercase font-black tracking-widest text-primary mb-2 block">Covered Zones</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {providerZones.map((zone, idx) => (
                                            <span key={idx} className="text-[10px] font-bold px-2 py-0.5 bg-white border border-primary/20 text-primary rounded-lg shadow-sm">
                                                {zone}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
