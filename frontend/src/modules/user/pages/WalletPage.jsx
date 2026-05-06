import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { ArrowLeft, Wallet, Plus, History, ChevronRight, TrendingUp } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { api } from "@/modules/user/lib/api";
import AddMoneyModal from "@/modules/user/components/wallet/AddMoneyModal";
import { toast } from "sonner";

const formatDate = (d) => {
    try { return new Date(d).toLocaleDateString(); } catch { return d; }
};

const WalletPage = () => {
    const navigate = useNavigate();
    const { gender } = useGenderTheme();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.wallet().then(({ wallet }) => {
            if (cancelled) return;
            setBalance(wallet?.balance || 0);
            setTransactions((wallet?.transactions || []).map((t, i) => ({
                id: i + 1,
                title: t.title || (t.type === "credit" ? "Credit" : "Debit"),
                date: formatDate(t.at || t.date),
                amount: t.amount,
                type: t.type
            })));
        }).catch(() => {});
        return () => { cancelled = true; };
    }, []);

    const loadRazorpay = () =>
        new Promise((resolve, reject) => {
            if (window.Razorpay) return resolve(true);
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error("Razorpay SDK failed to load"));
            document.body.appendChild(script);
        });

    const refreshWallet = async () => {
        try {
            const { wallet } = await api.wallet();
            setBalance(wallet?.balance || 0);
            setTransactions((wallet?.transactions || []).map((t, i) => ({
                id: i + 1,
                title: t.title || (t.type === "credit" ? "Credit" : "Debit"),
                date: formatDate(t.at || t.date),
                amount: t.amount,
                type: t.type
            })));
        } catch {}
    };

    const handleAddMoneyClick = () => {
        setIsModalOpen(true);
    };

    const handleAddMoney = async (amt) => {
        try {
            if (processing) return;
            setProcessing(true);
            
            const rzpKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
            if (!rzpKey) {
                toast.error("Razorpay key is not configured.");
                setProcessing(false);
                return;
            }
            
            await loadRazorpay();
            
            const { order } = await api.payments.createOrder({
                amount: Math.round(amt * 100),
                currency: "INR",
                purpose: "user_wallet_topup"
            });
            
            if (!order || !order.id) {
                throw new Error("Unable to create order");
            }
            
            if (String(order.id).startsWith("order_mock_") || order.mock) {
                throw new Error("Unable to create payment order");
            }
            
            // Close modal before opening Razorpay
            setIsModalOpen(false);
            
            const rzp = new window.Razorpay({
                key: rzpKey,
                amount: order.amount,
                currency: order.currency,
                name: "stylingwithmuskan",
                description: "Wallet Topup",
                order_id: order.id,
                prefill: {
                    name: user?.name || "",
                    email: user?.email || "",
                    contact: user?.phone ? (user.phone.startsWith("+91") ? user.phone : "+91" + user.phone) : ""
                },
                theme: { color: "#7c3aed" },
                webview_intent: true,
                config: {
                    display: {
                        blocks: {
                            upi: {
                                name: "UPI",
                                instruments: [
                                    {
                                        method: "upi",
                                        flows: ["qr", "intent"],
                                    },
                                ],
                            },
                            banks: {
                                name: "Other Payment Methods",
                                instruments: [
                                    {
                                        method: "card",
                                    },
                                    {
                                        method: "netbanking",
                                    },
                                    {
                                        method: "wallet",
                                    },
                                ],
                            },
                        },
                        sequence: ["block.upi", "block.banks"],
                        preferences: {
                            show_default_blocks: true,
                        },
                    },
                },
                handler: async (response) => {
                    try {
                        await api.payments.verify({
                            order_id: response.razorpay_order_id,
                            payment_id: response.razorpay_payment_id,
                            signature: response.razorpay_signature,
                            amount: order.amount,
                            purpose: "user_wallet_topup"
                        });
                        await refreshWallet();
                        toast.success(`₹${amt} added to wallet successfully!`);
                    } catch (e) {
                        toast.error("Payment verification failed");
                    } finally {
                        setProcessing(false);
                    }
                },
                modal: { 
                    ondismiss: () => {
                        setProcessing(false);
                        toast.info("Payment cancelled");
                    }
                }
            });
            
            rzp.open();
        } catch (error) {
            toast.error(error?.message || "Failed to initiate payment");
            setProcessing(false);
            setIsModalOpen(false);
        }
    };

    return (
        <div className="min-h-screen bg-background pb-8">
            {/* Header */}
            <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>My Wallet</h1>
            </div>

            <div className="px-4 max-w-2xl mx-auto mt-6 space-y-6">
                {/* Balance Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative overflow-hidden rounded-[32px] p-8 text-white shadow-2xl"
                    style={{ background: 'linear-gradient(135deg, hsl(var(--gradient-start)), hsl(var(--gradient-end)))' }}
                >
                    <div className="relative z-10">
                        <p className="text-white/70 text-sm font-medium uppercase tracking-wider">Available Balance</p>
                        <h2 className="text-5xl font-black mt-2">₹{balance}</h2>

                        <div className="flex gap-3 mt-8">
                            <Button 
                                className="bg-white text-primary hover:bg-white/90 rounded-2xl px-6 h-12 font-bold gap-2" 
                                onClick={handleAddMoneyClick} 
                                disabled={processing}
                            >
                                <Plus className="w-5 h-5" /> Add Money
                            </Button>
                        </div>
                    </div>

                    {/* Decorative Circles */}
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -left-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                </motion.div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="glass-strong rounded-2xl p-4 border border-border/50">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Cashback</p>
                        <p className="text-xl font-bold text-green-600">₹450</p>
                    </div>
                    <div className="glass-strong rounded-2xl p-4 border border-border/50">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Points Earned</p>
                        <p className="text-xl font-bold text-primary">1,240</p>
                    </div>
                </div>

                {/* Transactions */}
                <div>
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <History className="w-4 h-4 text-primary" /> Transaction History
                    </h3>
                    <div className="space-y-3">
                        {transactions.length === 0 ? (
                            <div className="glass-strong rounded-2xl p-8 text-center border border-border/50">
                                <Wallet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-sm font-bold text-muted-foreground">No transactions yet</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Your transaction history will appear here</p>
                            </div>
                        ) : (
                            transactions.map((t, i) => (
                                <motion.div
                                    key={t.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="glass-strong rounded-2xl p-4 flex items-center justify-between border border-border/50"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                            <TrendingUp className={`w-5 h-5 ${t.type === 'debit' ? 'rotate-180' : ''}`} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">{t.title}</p>
                                            <p className="text-[10px] text-muted-foreground">{t.date}</p>
                                        </div>
                                    </div>
                                    <p className={`font-bold ${t.type === 'credit' ? 'text-green-600' : 'text-foreground'}`}>
                                        {t.type === 'credit' ? '+' : ''}₹{Math.abs(t.amount)}
                                    </p>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Add Money Modal */}
            <AddMoneyModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAddMoney={handleAddMoney}
                processing={processing}
            />
        </div>
    );
};

export default WalletPage;
