import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, Crown, ShieldCheck, Sparkles, Users, Wallet, Zap, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/modules/user/lib/api";
import { Button } from "@/modules/user/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Input } from "@/modules/user/components/ui/input";

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
      const plansRes = await api.subscriptions.getPlans(userType);
      setPlans(Array.isArray(plansRes?.plans) ? plansRes.plans : []);
      try {
        const currentRes = await api.subscriptions.getCurrent(role);
        setCurrent(currentRes || null);
      } catch {
        setCurrent(null);
      }
    } catch (error) {
      toast.error(error?.message || "Failed to load subscription details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
    <div className="space-y-6">
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

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock3 className="h-5 w-5 text-primary" />
            Current Status
          </CardTitle>
          <CardDescription>Backend-driven subscription state shared across all flows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading subscription details...</p>
          ) : activeSubscription?.isActive ? (
            <>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Active Plan</p>
                  <h2 className="text-xl font-black text-slate-900 mt-1">{activeSubscription.planName}</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Ends on {activeSubscription.currentPeriodEnd ? new Date(activeSubscription.currentPeriodEnd).toLocaleDateString("en-IN") : "N/A"}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-4 py-3 border border-emerald-200">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Days Left</p>
                  <p className="text-2xl font-black text-emerald-600">{activeSubscription.daysLeft || 0}</p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {summaryRows.map((row) => (
                  <div key={row.label} className="rounded-2xl border border-border/50 bg-background p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{row.label}</p>
                    <p className="mt-2 text-lg font-black">{row.value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 p-5">
              <p className="text-sm font-semibold text-muted-foreground">No active subscription yet. Choose a plan below to activate benefits.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrentPlan = activePlan?.planId === plan.planId && activeSubscription?.isActive;
          const isDisabled = !plan.isActive;
          return (
            <motion.div key={plan.planId} whileHover={{ y: -2 }} className="h-full">
              <Card className={`h-full flex flex-col border-2 ${isCurrentPlan ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : isDisabled ? "border-border/20 bg-muted/30 opacity-75" : "border-border/30 bg-background/50"} backdrop-blur-sm`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-black truncate">{plan.name}</CardTitle>
                      <CardDescription className="text-xs line-clamp-1">{plan.tagline || "Configured by admin"}</CardDescription>
                    </div>
                    {isCurrentPlan && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white flex-shrink-0">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    )}
                    {isDisabled && !isCurrentPlan && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 flex-shrink-0">
                        <Clock3 className="h-3 w-3" /> Soon
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 flex-1 flex flex-col pt-0">
                  <div className="pb-3 border-b border-border/50">
                    <p className="text-2xl font-black text-foreground">₹{Number(plan.price || 0).toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                      {plan.billingCycle || "Custom"} • {plan.durationDays || 0} days
                    </p>
                  </div>
                  <ul className="space-y-1.5 flex-1">
                    {(plan.benefits || []).slice(0, 5).map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{benefit}</span>
                      </li>
                    ))}
                    {(plan.benefits || []).length > 5 && (
                      <li className="text-[10px] text-muted-foreground italic pl-5">
                        +{(plan.benefits || []).length - 5} more benefits
                      </li>
                    )}
                  </ul>
                  <Button
                    onClick={() => handlePay(plan)}
                    disabled={isPaying || !plan.isActive}
                    className="w-full rounded-xl h-10 font-bold text-sm mt-auto"
                  >
                    {!plan.isActive ? "Coming Soon" : isCurrentPlan ? "Renew Plan" : "Subscribe Now"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

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
