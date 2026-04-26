import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, Crown, ShieldCheck, Sparkles, Users, Wallet, Zap, Trash2, Plus, Package, Frown, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/modules/user/lib/api";
import { Button } from "@/modules/user/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Input } from "@/modules/user/components/ui/input";
import { useNavigate } from "react-router-dom";

const ROLE_TO_USER_TYPE = {
  user: "customer",
  provider: "provider",
  vendor: "vendor",
};

const ROLE_TO_ICON = {
  user: Sparkles,
  provider: Crown,
  vendor: ShieldCheck,
};

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Razorpay SDK failed to load"));
    document.body.appendChild(script);
  });
}

export default function SubscriptionPortal({
  role = "user",
  title,
  subtitle,
  entity,
  onActivated,
}) {
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [subAccountForm, setSubAccountForm] = useState({ name: "", email: "", phone: "", role: "operations" });
  const navigate = useNavigate();
  const Icon = ROLE_TO_ICON[role] || Sparkles;
  const userType = ROLE_TO_USER_TYPE[role] || "customer";

  const activeSubscription = current?.subscription || null;
  const activePlan = current?.plan || null;
  const subAccounts = current?.subAccounts || [];

  const summaryRows = useMemo(() => {
    if (!activeSubscription?.isActive) return [];
    if (role === "user") {
      return [
        { label: "Discount", value: `${activeSubscription.discountPercentage || 0}%` },
        { label: "Cart Threshold", value: `INR ${activeSubscription.minCartValueForDiscount || 0}` },
        { label: "Free Cancellation", value: `${activeSubscription.freeCancellationWindowHours || 0} hrs` },
      ];
    }
    if (role === "provider") {
      return [
        { label: "Commission Rate", value: `${activeSubscription.providerCommissionRate || 0}%` },
        { label: "Lead Window", value: `${activeSubscription.leadPriorityWindowMinutes || 0} mins` },
        { label: "Training Access", value: activeSubscription.premiumTrainingAccess ? "Unlocked" : "Locked" },
      ];
    }
    return [
      { label: "Marketing Credits", value: `INR ${activeSubscription.marketingCreditsBalance || 0}` },
      { label: "Priority Support", value: activeSubscription.prioritySupport ? "Enabled" : "Disabled" },
      { label: "Performance Commission", value: `${activeSubscription.vendorPerformanceCommissionValue || 0}${activeSubscription.vendorPerformanceCommissionType === "percentage" ? "%" : " fixed"}` },
    ];
  }, [activeSubscription, role]);

  const refresh = async () => {
    setIsLoading(true);
    try {
      console.log('🔥 [SubscriptionPortal] Fetching plans for userType:', userType);
      const plansRes = await api.subscriptions.getPlans(userType);
      console.log('🔥 [SubscriptionPortal] Plans response:', plansRes);
      console.log('🔥 [SubscriptionPortal] Plans array:', plansRes?.plans);
      console.log('🔥 [SubscriptionPortal] Plans length:', plansRes?.plans?.length);
      
      setPlans(Array.isArray(plansRes?.plans) ? plansRes.plans : []);
      
      try {
        const currentRes = await api.subscriptions.getCurrent(role);
        setCurrent(currentRes || null);
      } catch (err) {
        // 401 is expected if user is not logged in - don't show error
        if (err?.status !== 401) {
          console.error("Failed to fetch current subscription:", err);
        }
        setCurrent(null);
      }
    } catch (error) {
      console.error('🔥 [SubscriptionPortal] Error fetching plans:', error);
      // Only show error toast if it's not a 401 (unauthorized)
      if (error?.status !== 401) {
        toast.error(error?.message || "Failed to load subscription details");
      }
    } finally {
      setIsLoading(false);
      console.log('🔥 [SubscriptionPortal] Loading complete');
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    refresh();
  }, [role]);

  const handlePay = async (plan) => {
    try {
      const key = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!key) {
        toast.error("Razorpay key is not configured.");
        return;
      }
      setIsPaying(true);
      await loadRazorpay();
      const { order } = await api.subscriptions.createOrder({ planId: plan.planId }, role);
      const rzp = new window.Razorpay({
        key,
        amount: order.amount,
        currency: order.currency,
        name: "Styling With Muskan",
        description: `${plan.name} subscription`,
        order_id: order.id,
        prefill: {
          name: entity?.name || "",
          email: entity?.email || "",
          contact: entity?.phone || "",
        },
        theme: { color: "#7c3aed" },
        webview_intent: true,
        config: {
          display: {
            blocks: {
              upi: {
                name: "Pay via UPI",
                instruments: [
                  {
                    method: "upi",
                    flows: ["qr", "intent"],
                  },
                ],
              },
            },
            sequence: ["block.upi"],
            preferences: {
              show_default_blocks: true,
            },
          },
        },
        handler: async (response) => {
          try {
            const verified = await api.subscriptions.verify({
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              planId: plan.planId,
            }, role);
            await refresh();
            if (onActivated) await onActivated(verified?.snapshot);
            toast.success(`${plan.name} is now active.`);
          } catch (error) {
            toast.error(error?.message || "Subscription verification failed");
          } finally {
            setIsPaying(false);
          }
        },
        modal: {
          ondismiss: () => setIsPaying(false),
        },
      });
      rzp.open();
    } catch (error) {
      toast.error(error?.message || "Unable to start subscription payment");
      setIsPaying(false);
    }
  };

  const handleCreateSubAccount = async () => {
    try {
      await api.vendor.createSubAccount(subAccountForm);
      setSubAccountForm({ name: "", email: "", phone: "", role: "operations" });
      await refresh();
      toast.success("Sub-account added.");
    } catch (error) {
      toast.error(error?.message || "Unable to add sub-account");
    }
  };

  const handleDeleteSubAccount = async (id) => {
    try {
      await api.vendor.deleteSubAccount(id);
      await refresh();
      toast.success("Sub-account removed.");
    } catch (error) {
      toast.error(error?.message || "Unable to remove sub-account");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Title section - only show if not in user role (who has its own header) */}
      {role !== "user" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground font-medium">{subtitle}</p>
            </div>
          </div>
        </div>
      )}

      {/* Current Status - Only show when plans are available */}
      {!isLoading && plans.length > 0 && (
      <Card className="border-border/60 shadow-xl shadow-primary/5 rounded-[24px] overflow-hidden">
        <div className="bg-primary/5 px-4 sm:px-6 py-3 sm:py-4 border-b border-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs sm:text-sm font-black tracking-tight">Current Status</span>
          </div>
          {activeSubscription?.isActive && (
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </div>
        <CardContent className="p-4 sm:p-6">
          {activeSubscription?.isActive ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-emerald-600">Active Plan</p>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">{activeSubscription.planName}</h2>
                  <p className="text-[11px] sm:text-sm text-slate-600 mt-0.5">
                    Until {activeSubscription.currentPeriodEnd ? new Date(activeSubscription.currentPeriodEnd).toLocaleDateString("en-IN") : "N/A"}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-3 sm:px-4 py-2 sm:py-3 border border-emerald-200 self-start sm:self-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Days Left</p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-600">{activeSubscription.daysLeft || 0}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {summaryRows.map((row) => (
                  <div key={row.label} className="rounded-xl sm:rounded-2xl border border-border/50 bg-background p-2.5 sm:p-4">
                    <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground line-clamp-1">{row.label}</p>
                    <p className="mt-1 text-sm sm:text-lg font-black">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 p-4 sm:p-5 text-center sm:text-left">
              <p className="text-[13px] font-semibold text-muted-foreground">No active subscription yet. Choose a plan below.</p>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Empty State - No Plans Available */}
      {!isLoading && plans.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 px-4"
        >
          <div className="relative mb-8">
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.05, 1]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1
              }}
              className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center shadow-lg"
            >
              <Package className="w-12 h-12 text-slate-400" />
            </motion.div>
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity
              }}
              className="absolute -top-2 -right-2 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center"
            >
              <Frown className="w-5 h-5 text-amber-600" />
            </motion.div>
          </div>

          <h3 className="text-2xl font-black text-foreground mb-3 text-center">
            No Plans Available Yet
          </h3>
          
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6 leading-relaxed">
            We sincerely apologize! Our subscription plans are currently being set up by the admin team. 
            Please check back soon for exciting {role === 'provider' ? 'Pro Partner' : role === 'vendor' ? 'Enterprise' : 'Premium'} benefits.
          </p>

          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 max-w-md w-full">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-amber-900 text-sm mb-1">What's Coming?</h4>
                <ul className="text-xs text-amber-800 space-y-1 font-medium">
                  {role === 'provider' && (
                    <>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Lower commission rates
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Priority job leads
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Premium training access
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Exclusive Pro badge
                      </li>
                    </>
                  )}
                  {role === 'vendor' && (
                    <>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Marketing credits
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Priority support
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Sub-account management
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Performance bonuses
                      </li>
                    </>
                  )}
                  {role === 'user' && (
                    <>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Exclusive discounts
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Free cancellations
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Priority booking
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Special rewards
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="px-6 py-3 rounded-xl font-bold"
            >
              Go Back
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Page
            </Button>
          </div>
        </motion.div>
      )}

      {/* Plans Grid - Only show when plans are available */}
      {!isLoading && plans.length > 0 && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrentPlan = activePlan?.planId === plan.planId && activeSubscription?.isActive;
          const isDisabled = !plan.isActive;
          return (
            <motion.div key={plan.planId} whileHover={{ y: -4 }} className="h-full">
              <Card className={`h-full flex flex-col border-2 transition-all duration-300 relative overflow-hidden rounded-[28px] ${isCurrentPlan ? "border-primary bg-primary/[0.03] shadow-2xl shadow-primary/10" : isDisabled ? "border-border/20 bg-muted/30 opacity-75" : "border-border/40 hover:border-primary/30"}`}>
                {isCurrentPlan && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-primary text-white text-[10px] font-black px-4 py-1 rounded-bl-xl uppercase tracking-widest shadow-lg">
                      CURRENT
                    </div>
                  </div>
                )}
                
                <CardHeader className="pb-3 sm:pb-4 pt-6 sm:pt-8 px-4 sm:px-6">
                  <div className="flex flex-col gap-0.5 sm:gap-1">
                    <CardTitle className="text-lg sm:text-xl font-black">{plan.name}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm font-medium text-primary/70">{plan.tagline || "Unlock Plus Benefits"}</CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 sm:space-y-6 flex-1 flex flex-col pt-0 px-4 sm:px-6">
                  <div className="bg-accent/30 rounded-[18px] sm:rounded-[20px] p-3 sm:p-4 border border-border/10">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-black italic tracking-tighter text-foreground">₹{Number(plan.price || 0).toLocaleString()}</span>
                      <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase opacity-60">/ {plan.durationDays || 0} days</span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-black text-primary/60 uppercase tracking-widest mt-0.5">
                      {plan.billingCycle || "Standard Access"}
                    </p>
                  </div>

                  <ul className="space-y-2.5 sm:space-y-3 flex-1 px-0.5">
                    {(plan.benefits || []).slice(0, 5).map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 sm:gap-3">
                        <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-600" />
                        </div>
                        <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground leading-relaxed line-clamp-2">{benefit}</span>
                      </li>
                    ))}
                    {(plan.benefits || []).length > 5 && (
                      <li className="text-[9px] sm:text-[10px] text-primary font-black uppercase tracking-widest pl-7 sm:pl-8 mt-1.5 cursor-help">
                        +{(plan.benefits || []).length - 5} More features
                      </li>
                    )}
                  </ul>

                  <Button
                    onClick={() => handlePay(plan)}
                    disabled={isPaying || !plan.isActive || isCurrentPlan}
                    variant={isCurrentPlan ? "outline" : "default"}
                    className={`w-full rounded-[16px] sm:rounded-[18px] h-11 sm:h-12 font-black text-xs sm:text-sm transition-all active:scale-95 mt-2 ${isCurrentPlan ? "border-primary/20 opacity-50 grayscale pointer-events-none" : "bg-black text-white hover:bg-slate-800 shadow-lg shadow-black/10"}`}
                  >
                    {!plan.isActive ? "Coming Soon" : isCurrentPlan ? "Renew Membership" : "Get SWM Plus"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      )}

      {role === "vendor" && activeSubscription?.subAccountsEnabled && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Enterprise Sub-Accounts
            </CardTitle>
            <CardDescription>Add local support, finance, or operations teammates for your city panel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-4 gap-3">
              <Input placeholder="Name" value={subAccountForm.name} onChange={(e) => setSubAccountForm((prev) => ({ ...prev, name: e.target.value }))} />
              <Input placeholder="Email" value={subAccountForm.email} onChange={(e) => setSubAccountForm((prev) => ({ ...prev, email: e.target.value }))} />
              <Input placeholder="Phone" value={subAccountForm.phone} onChange={(e) => setSubAccountForm((prev) => ({ ...prev, phone: e.target.value }))} />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={subAccountForm.role}
                onChange={(e) => setSubAccountForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="operations">Operations</option>
                <option value="support">Support</option>
                <option value="finance">Finance</option>
              </select>
            </div>
            <Button onClick={handleCreateSubAccount} className="rounded-xl font-bold">
              <Plus className="h-4 w-4 mr-2" /> Add Sub-Account
            </Button>
            <div className="space-y-3">
              {subAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sub-accounts added yet.</p>
              ) : (
                subAccounts.map((sub) => (
                  <div key={sub._id} className="rounded-2xl border border-border/50 p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{sub.name}</p>
                      <p className="text-xs text-muted-foreground">{sub.role} • {sub.email || sub.phone || "No contact added"}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteSubAccount(sub._id)} className="rounded-lg">
                      <Trash2 className="h-4 w-4 mr-2" /> Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {role === "provider" && activeSubscription?.premiumTrainingAccess && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5 flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-600">Premium Training Unlocked</p>
              <p className="text-sm text-slate-600 mt-1">
                Your active Pro subscription unlocks premium training content and boosted profile visibility.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {role === "vendor" && activeSubscription?.isActive && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5 flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-blue-600">Billing Summary</p>
              <p className="text-sm text-slate-600 mt-1">
                Base fee: INR {Number(activePlan?.price || 0).toLocaleString()} • Marketing credits balance: INR {Number(activeSubscription.marketingCreditsBalance || 0).toLocaleString()} • Next billing: {activeSubscription.currentPeriodEnd ? new Date(activeSubscription.currentPeriodEnd).toLocaleDateString("en-IN") : "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
