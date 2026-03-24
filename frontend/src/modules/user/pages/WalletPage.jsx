import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { ArrowLeft, Wallet, Plus, History, ChevronRight, TrendingUp } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { api } from "@/modules/user/lib/api";

const formatDate = (d) => {
    try { return new Date(d).toLocaleDateString(); } catch { return d; }
};

const WalletPage = () => {
    const navigate = useNavigate();
    const { gender } = useGenderTheme();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [processing, setProcessing] = useState(false);

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

    const handleAddMoney = async () => {
        const amt = Number(prompt("Enter amount to add (INR):", "500"));
        if (!Number.isFinite(amt) || amt <= 0) return;
        try {
            if (processing) return;
            setProcessing(true);
            const rzpKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
            if (!rzpKey) {
                setProcessing(false);
                alert("Razorpay key is not configured.");
                return;
            }
            await loadRazorpay();
            const { order } = await api.payments.createOrder({
                amount: Math.round(amt * 100),
                currency: "INR",
                purpose: "user_wallet_topup"
            });
            if (!order || !order.id) throw new Error("Unable to create order");
            if (String(order.id).startsWith("order_mock_") || order.mock) {
                throw new Error("Unable to create payment order");
            }
            const rzp = new window.Razorpay({
                key: rzpKey,
                amount: order.amount,
                currency: order.currency,
                name: "stylingwithmuskan",
                description: "Wallet Topup",
                order_id: order.id,
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
                    } catch (e) {
                        // ignore; error banner handled in PaymentPage
                    } finally {
                        setProcessing(false);
                    }
                },
                modal: { ondismiss: () => setProcessing(false) }
            });
            rzp.open();
        } catch {
            setProcessing(false);
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
                        <Button className="bg-white text-primary hover:bg-white/90 rounded-2xl px-6 h-12 font-bold gap-2" onClick={handleAddMoney} disabled={processing}>
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
                        {transactions.map((t, i) => (
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
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WalletPage;
