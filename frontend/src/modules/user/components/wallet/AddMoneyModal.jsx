import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, IndianRupee } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";

const QUICK_AMOUNTS = [100, 500, 1000, 2000];
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 50000;

export default function AddMoneyModal({ isOpen, onClose, onAddMoney, processing }) {
    const [amount, setAmount] = useState("");
    const [error, setError] = useState("");

    const handleAmountChange = (value) => {
        setError("");
        const numValue = Number(value);
        
        if (value === "") {
            setAmount("");
            return;
        }
        
        if (isNaN(numValue) || numValue < 0) {
            setError("Please enter a valid amount");
            return;
        }
        
        setAmount(value);
    };

    const handleQuickAmount = (value) => {
        setAmount(value.toString());
        setError("");
    };

    const handleSubmit = () => {
        const numAmount = Number(amount);
        
        if (!amount || amount === "") {
            setError("Please enter an amount");
            return;
        }
        
        if (isNaN(numAmount) || numAmount <= 0) {
            setError("Please enter a valid amount");
            return;
        }
        
        if (numAmount < MIN_AMOUNT) {
            setError(`Minimum amount is ₹${MIN_AMOUNT}`);
            return;
        }
        
        if (numAmount > MAX_AMOUNT) {
            setError(`Maximum amount is ₹${MAX_AMOUNT}`);
            return;
        }
        
        onAddMoney(numAmount);
    };

    const handleClose = () => {
        if (processing) return;
        setAmount("");
        setError("");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={handleClose}>
                <motion.div
                    initial={{ opacity: 0, y: 100, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 100, scale: 0.95 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md bg-background rounded-[32px] overflow-hidden shadow-2xl border border-border"
                >
                    {/* Header */}
                    <div className="relative p-6 pb-4 border-b border-border/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <Wallet className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black">Add Money</h2>
                                    <p className="text-xs text-muted-foreground font-medium">Top up your wallet</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleClose}
                                disabled={processing}
                                className="w-10 h-10 bg-muted hover:bg-muted/80 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Amount Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground">Enter Amount</label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    <IndianRupee className="w-5 h-5" />
                                </div>
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => handleAmountChange(e.target.value)}
                                    placeholder="0"
                                    disabled={processing}
                                    className="pl-12 h-14 text-2xl font-bold rounded-2xl border-2 focus:border-primary"
                                />
                            </div>
                            {error && (
                                <p className="text-xs text-red-500 font-medium">{error}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Min: ₹{MIN_AMOUNT} • Max: ₹{MAX_AMOUNT.toLocaleString()}
                            </p>
                        </div>

                        {/* Quick Amount Buttons */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground">Quick Select</label>
                            <div className="grid grid-cols-4 gap-2">
                                {QUICK_AMOUNTS.map((quickAmount) => (
                                    <button
                                        key={quickAmount}
                                        onClick={() => handleQuickAmount(quickAmount)}
                                        disabled={processing}
                                        className={`h-12 rounded-xl font-bold text-sm transition-all border-2 ${
                                            Number(amount) === quickAmount
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-muted hover:bg-muted/80 border-border"
                                        } disabled:opacity-50`}
                                    >
                                        ₹{quickAmount}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                disabled={processing}
                                className="flex-1 h-12 rounded-2xl font-bold"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={processing || !amount}
                                className="flex-1 h-12 rounded-2xl font-bold gap-2"
                            >
                                {processing ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Wallet className="w-4 h-4" />
                                        Add Money
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
