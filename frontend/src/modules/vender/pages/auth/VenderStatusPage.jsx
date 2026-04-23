import React from "react";
import { useNavigate } from "react-router-dom";
import {
    ShieldCheck,
    Clock,
    XCircle,
    AlertTriangle,
    MessageCircle,
    ChevronLeft,
    RefreshCcw
} from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { toast } from "sonner";

export default function VenderStatusPage() {
    const navigate = useNavigate();
    const { vendor, isLoggedIn, isApproved, refreshVendor } = useVenderAuth();
    const status = vendor?.status || "pending"; // pending, approved, rejected, blocked

    React.useEffect(() => {
        // Auto refresh status on mount
        if (isLoggedIn && !isApproved) {
            refreshVendor().catch(() => {});
        }
    }, []);

    React.useEffect(() => {
        if (isApproved) {
            toast.success("Congratulations! Your vendor account has been approved.");
            const timer = setTimeout(() => {
                navigate("/vender/dashboard", { replace: true });
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isApproved, navigate]);

    const statusConfigs = {
        pending: {
            icon: Clock,
            iconClass: "bg-emerald-50 text-emerald-600",
            title: "Verification in Progress",
            description: "Thanks for joining SWM! Our admin team is currently reviewing your registration request. You\'ll receive a notification once approved.",
            badge: "Under Review",
            badgeClass: "bg-emerald-100 text-emerald-700",
            buttonText: "Check Again",
            onButtonClick: async () => {
                try {
                    await refreshVendor();
                    toast.success("Status updated!");
                } catch {
                    toast.error("Could not refresh status");
                }
            }
        },
        approved: {
            icon: ShieldCheck,
            iconClass: "bg-green-50 text-green-600",
            title: "Account Approved!",
            description: "Congratulations! Your vendor account is now active. You can start managing your zones and service providers.",
            badge: "Active Vendor",
            badgeClass: "bg-green-100 text-green-700",
            buttonText: "Go to Dashboard",
            onButtonClick: () => navigate("/vender/dashboard")
        },
        rejected: {
            icon: XCircle,
            iconClass: "bg-red-50 text-red-600",
            title: "Registration Rejected",
            description: "We couldn't approve your vendor registration at this time. Please contact our support team for more details.",
            badge: "Rejected",
            badgeClass: "bg-red-100 text-red-700",
            buttonText: "Contact Support",
            onButtonClick: () => { }
        },
        blocked: {
            icon: AlertTriangle,
            iconClass: "bg-amber-50 text-amber-600",
            title: "Account Blocked",
            description: "Your account is blocked by admin approve first then login again",
            badge: "Blocked",
            badgeClass: "bg-amber-100 text-amber-900",
            buttonText: "Contact Support",
            onButtonClick: () => { }
        }
    };

    const config = statusConfigs[status] || statusConfigs.pending;
    const Icon = config.icon;

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <Card className="w-full max-w-md border-none shadow-xl rounded-3xl p-8">
                    <p className="text-gray-500 font-bold mb-6">Please login to check your status.</p>
                    <Button onClick={() => navigate("/vender/login")} className="w-full h-12 bg-emerald-600 rounded-xl font-bold">Login</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <Card className="w-full max-w-md border-none shadow-2xl rounded-[32px] overflow-hidden bg-white">
                <CardContent className="p-8 sm:p-10 flex flex-col items-center text-center">
                    <div className="w-full flex justify-between items-center mb-10">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <ChevronLeft className="h-6 w-6 text-gray-400" />
                        </button>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${config.badgeClass}`}>
                            {config.badge}
                        </div>
                    </div>

                    <div className={`w-24 h-24 rounded-[32px] ${config.iconClass} flex items-center justify-center mb-8 shadow-inner`}>
                        <Icon className="h-12 w-12 stroke-[2.5px]" />
                    </div>

                    <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">{config.title}</h1>
                    <p className="text-gray-500 font-medium text-sm leading-relaxed mb-10 px-4">
                        {config.description}
                    </p>

                    <div className="w-full space-y-4">
                        <Button
                            className={`w-full h-14 rounded-2xl font-black text-lg ${status === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-100' : 'bg-gray-100 text-gray-800'}`}
                            onClick={config.onButtonClick}
                        >
                            {config.buttonText}
                        </Button>
                    </div>

                    <div className="mt-10 pt-8 border-t border-gray-50 w-full">
                        <img src="/logo1.png" alt="SWM" className="h-12 w-12 rounded-full object-cover mx-auto opacity-50 grayscale hover:opacity-100 transition-all shadow-sm" />
                        <p className="text-[10px] font-black uppercase text-gray-300 mt-2 tracking-widest">stylingwithmuskan</p>
                    </div>
                </CardContent>
            </Card>

            {/* Background Decorative Circles */}
            <div className="fixed top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-emerald-100 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
            <div className="fixed bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-teal-100 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
        </div>
    );
}
