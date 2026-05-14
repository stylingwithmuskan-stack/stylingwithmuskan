import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Share2, Copy, Trophy, Users, Star, Smartphone } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { api } from "@/modules/user/lib/api";
import { useProviderAuth } from "../contexts/ProviderAuthContext";
import { toast } from "sonner";

export default function ProviderReferralPage() {
    const navigate = useNavigate();
    const { provider } = useProviderAuth();
    const [settings, setSettings] = useState({ referrerBonus: 100, refereeBonus: 50, isActive: true });
    
    // For now, since providers don't have a specific referral code in the schema,
    // we use a generic share link or their phone-based identifier if needed.
    const shareLink = "https://play.google.com/store/apps/details?id=com.company.stylewithmuskan";
    
    useEffect(() => {
        window.scrollTo(0, 0);
        
        // Fetch global referral settings to show accurate amounts
        api.referralInfo().then(({ settings }) => {
            if (settings) setSettings(settings);
        }).catch(() => {
            // Fallback to defaults already in state
        });
    }, []);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareLink);
        toast.success("Download link copied!");
    };

    const handleShare = () => {
        const message = `Hey! Join me on Styling With Muskan - the best platform for beauty and wellness services. 💇‍♀️💅\n\nDownload the app now: ${shareLink}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    return (
        <div className="min-h-screen bg-white pb-32">
            {/* Premium Header - Recent Activity Style */}
            <div className="bg-white px-4 py-3 border-b border-slate-100 sticky top-0 z-30 transition-all">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2.5 bg-violet-100 hover:bg-violet-200 rounded-full transition-all active:scale-95 group">
                        <ArrowLeft className="h-5 w-5 text-violet-700" />
                    </button>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none">Invite Friends</h2>
                </div>
            </div>

            <div className="px-6 max-w-2xl mx-auto mt-8 space-y-8">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[40px] p-8 text-center bg-violet-600 text-white shadow-2xl shadow-violet-200"
                >
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-violet-400/20 rounded-full blur-3xl" />
                    
                    <div className="relative z-10">
                        <div className="w-24 h-24 rounded-[32px] bg-white/20 backdrop-blur-xl mx-auto mb-6 flex items-center justify-center shadow-xl rotate-12 border border-white/30">
                            <Gift className="w-12 h-12 text-white -rotate-12" />
                        </div>
                        <h2 className="text-3xl font-black tracking-tighter leading-none mb-3">
                            Spread the Glow!
                        </h2>
                        <p className="text-violet-100 text-sm font-medium px-4 leading-relaxed opacity-90">
                            Invite your friends and colleagues to join <span className="font-bold text-white">Styling With Muskan</span> and grow our community together.
                        </p>

                        <div className="mt-8 flex flex-col gap-3">
                            <Button
                                onClick={handleShare}
                                className="w-full h-14 rounded-2xl text-base font-black shadow-xl shadow-black/10 gap-3 bg-white text-violet-600 hover:bg-violet-50 border-none transition-all active:scale-[0.98]"
                            >
                                <Share2 className="w-5 h-5" /> SHARE ON WHATSAPP
                            </Button>
                            <button
                                onClick={handleCopyLink}
                                className="text-xs font-bold text-violet-200 hover:text-white transition-colors underline underline-offset-4 decoration-violet-400"
                            >
                                Copy Download Link
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* How it works */}
                <div className="space-y-5">
                    <div className="flex items-center gap-2 px-2">
                        <Smartphone className="w-5 h-5 text-violet-600" />
                        <h3 className="text-base font-black text-gray-900 uppercase tracking-wider">How to Invite</h3>
                    </div>
                    
                    <div className="space-y-3">
                        {[
                            { 
                                icon: Share2, 
                                title: "Share Link", 
                                desc: "Send the app link to your friends and network.",
                                color: "bg-blue-50 text-blue-600"
                            },
                            { 
                                icon: Users, 
                                title: "They Join SWM", 
                                desc: "Your friends sign up as users or partners.",
                                color: "bg-green-50 text-green-600"
                            },
                            { 
                                icon: Trophy, 
                                title: "Grow Together", 
                                desc: "Earn rewards and help expand our reach.",
                                color: "bg-amber-50 text-amber-600"
                            },
                        ].map((step, i) => (
                            <motion.div 
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex gap-5 p-5 rounded-3xl bg-gray-50 border border-gray-100 hover:bg-white hover:border-violet-100 hover:shadow-lg hover:shadow-violet-50 transition-all group"
                            >
                                <div className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>
                                    <step.icon className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col justify-center">
                                    <p className="text-[17px] font-black text-gray-900 tracking-tight leading-tight mb-1">{step.title}</p>
                                    <p className="text-sm text-gray-500 font-medium leading-tight">{step.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Benefits Banner */}
                <div className="bg-violet-50 rounded-3xl p-6 border border-violet-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Star className="w-16 h-16 text-violet-600 fill-violet-600" />
                    </div>
                    <p className="text-xs font-black text-violet-700 uppercase tracking-[0.2em] mb-2">Pro Tip</p>
                    <p className="text-sm font-bold text-violet-900 leading-relaxed">
                        Referring other high-quality service providers helps improve our platform's reputation and brings more customers for everyone!
                    </p>
                </div>
            </div>
        </div>
    );
}
