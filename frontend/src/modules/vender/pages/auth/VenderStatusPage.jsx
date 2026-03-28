import React from "react";
import { useNavigate } from "react-router-dom";
import {
    ShieldCheck,
    Clock,
    XCircle,
    AlertTriangle,
    MessageCircle,
    ChevronLeft
} from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";
import { toast } from "sonner";

export default function VenderStatusPage() {
    const navigate = useNavigate();
    const { vendor, isLoggedIn } = useVenderAuth();
    const status = vendor?.status || "pending"; // pending, approved, rejected, blocked

    React.useEffect(() => {
        if (status === "approved") {
            toast.success("Congratulations! Your vendor account has been approved.");
            const timer = setTimeout(() => {
                navigate("/vender/dashboard", { replace: true });
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [status, navigate]);

    const statusConfigs = {
        pending: {
            icon: Clock,
            iconClass: "bg-emerald-50 text-emerald-600",
            title: "Verification in Progress",
            description: "Thanks for joining SWM! Our admin team is currently reviewing your registration request. You'll be able to access your dashboard once approved.",
            badge: "Under Review",
            badgeClass: "bg-emerald-100 text-emerald-700",
            buttonText: "Wait for Approval",
            onButtonClick: () => { }
        },
        approved: {
            icon: ShieldCheck,
            iconClass: "bg-green-50 text-green-600",
            title: "Account Approved!",
            description: "Congratulations! Your vendor account is now active. You can start managing your zone and service providers.",
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
            description: "Your vendor account has been temporarily blocked by admin. Please reach out to support for assistance.",
            badge: "Blocked",
            badgeClass: "bg-amber-100 text-amber-900",
            buttonText: "Contact Support",
            onButtonClick: () => { }
        }
    };

    const config = statusConfigs[status] || statusConfigs.pending;
    const Icon = config.icon;

    if (!isLoggedIn && status !== "approved") {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <p className="text-gray-500 font-bold">Please login to check your status.</p>
                <Button onClick={() => navigate("/vender/login")} className="ml-4 bg-emerald-600">Login</Button>
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
                        {status === 'approved' && (
                            <Button
                                className="w-full h-14 rounded-2xl font-black text-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-100"
                                onClick={() => navigate("/vender/dashboard")}
                            >
                                Go to Dashboard
                            </Button>
                        )}
                        {(status === 'rejected' || status === 'blocked') && (
                            <Button
                                variant="outline"
                                className="w-full h-14 rounded-2xl border-gray-200 font-black text-gray-600 flex items-center gap-2"
                            >
                                <MessageCircle className="h-5 w-5" />
                                Talk to Support
                            </Button>
                        )}
                        {status === 'pending' && (
                             <Button
                             variant="outline"
                             className="w-full h-14 rounded-2xl border-gray-200 font-black text-gray-600"
                             onClick={() => window.location.reload()}
                         >
                             Check Again
                         </Button>
                        )}
                    </div>

                    <div className="mt-10 pt-8 border-t border-gray-50 w-full">
                        <img src="/logo1.png" alt="SWM" className="h-12 w-12 rounded-full object-cover mx-auto opacity-50 grayscale hover:opacity-100 transition-all shadow-sm" />
                        <p className="text-[10px] font-black uppercase text-gray-300 mt-2 tracking-widest lowercase">stylingwithmuskan</p>
                    </div>
                </CardContent>
            </Card>

            {/* Background Decorative Circles */}
            <div className="fixed top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-emerald-100 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
            <div className="fixed bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-teal-100 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
        </div>
    );
}
