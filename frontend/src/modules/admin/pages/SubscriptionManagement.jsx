import { useEffect, useState } from "react";
import { BarChart3, Crown, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";

export default function SubscriptionManagement() {
  const {
    getSubscriptionSettings,
    updateSubscriptionSettings,
    getSubscriptionPlans,
    createSubscriptionPlan,
    updateSubscriptionPlan,
    getSubscriptionReport,
  } = useAdminAuth();
  const [settings, setSettings] = useState(null);
  const [plans, setPlans] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPlan, setNewPlan] = useState({
    planId: "",
    name: "",
    userType: "customer",
    price: 0,
    durationDays: 30,
    billingCycle: "monthly",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [settingsRes, plansRes, reportRes] = await Promise.all([
        getSubscriptionSettings(),
        getSubscriptionPlans(),
        getSubscriptionReport(),
      ]);
      setSettings(settingsRes || null);
      setPlans(Array.isArray(plansRes) ? plansRes : []);
      setReport(reportRes || null);
    } catch (error) {
      toast.error(error?.message || "Failed to load subscription controls");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const saved = await updateSubscriptionSettings(settings);
      setSettings(saved);
      toast.success("Subscription settings saved.");
    } catch (error) {
      toast.error(error?.message || "Unable to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handlePlanChange = (planId, field, value) => {
    setPlans((prev) => prev.map((plan) => {
      if (plan.planId !== planId) return plan;
      if (field.startsWith("meta.")) {
        const key = field.replace("meta.", "");
        return { ...plan, meta: { ...(plan.meta || {}), [key]: value } };
      }
      return { ...plan, [field]: value };
    }));
  };

  const handleSavePlan = async (plan) => {
    try {
      await updateSubscriptionPlan(plan.planId, plan);
      toast.success(`${plan.name} updated.`);
      await load();
    } catch (error) {
      toast.error(error?.message || "Unable to update plan");
    }
  };

  const handleCreatePlan = async () => {
    try {
      if (!newPlan.planId || !newPlan.name) {
        toast.error("Plan ID and plan name are required.");
        return;
      }
      await createSubscriptionPlan({
        ...newPlan,
        benefits: [],
        meta: {},
      });
      toast.success("Subscription plan created.");
      setNewPlan({
        planId: "",
        name: "",
        userType: "customer",
        price: 0,
        durationDays: 30,
        billingCycle: "monthly",
      });
      await load();
    } catch (error) {
      toast.error(error?.message || "Unable to create plan");
    }
  };

  if (loading) {
    return <div className="p-8 text-sm font-semibold text-muted-foreground">Loading subscription controls...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
            <Crown className="h-7 w-7 text-primary" /> Subscription Controls
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Manage pricing, discount burden, lead priority, elite thresholds, and enterprise billing in one place.
          </p>
        </div>
        <Button onClick={load} variant="outline" className="rounded-xl font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 border-border/60">
          <CardHeader>
            <CardTitle>Global Subscription Settings</CardTitle>
            <CardDescription>Default controls that support dynamic discount and billing rules.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <label className="space-y-2 text-sm font-semibold">
              <span>User Quarterly Discount %</span>
              <Input type="number" value={settings?.userQuarterlyDiscountDefault ?? 0} onChange={(e) => setSettings((prev) => ({ ...prev, userQuarterlyDiscountDefault: Number(e.target.value || 0) }))} />
            </label>
            <label className="space-y-2 text-sm font-semibold">
              <span>User Annual Discount %</span>
              <Input type="number" value={settings?.userAnnualDiscountDefault ?? 0} onChange={(e) => setSettings((prev) => ({ ...prev, userAnnualDiscountDefault: Number(e.target.value || 0) }))} />
            </label>
            <label className="space-y-2 text-sm font-semibold">
              <span>Discount Funded By</span>
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={settings?.defaultDiscountFundedBy || "platform"} onChange={(e) => setSettings((prev) => ({ ...prev, defaultDiscountFundedBy: e.target.value }))}>
                <option value="platform">Platform</option>
                <option value="provider">Provider</option>
                <option value="vendor">Vendor</option>
              </select>
            </label>
            <label className="space-y-2 text-sm font-semibold">
              <span>Elite Min Rating</span>
              <Input type="number" step="0.1" value={settings?.eliteMinRating ?? 0} onChange={(e) => setSettings((prev) => ({ ...prev, eliteMinRating: Number(e.target.value || 0) }))} />
            </label>
            <label className="space-y-2 text-sm font-semibold">
              <span>Elite Min Jobs</span>
              <Input type="number" value={settings?.eliteMinJobs ?? 0} onChange={(e) => setSettings((prev) => ({ ...prev, eliteMinJobs: Number(e.target.value || 0) }))} />
            </label>
            <label className="space-y-2 text-sm font-semibold">
              <span>Default Provider Commission %</span>
              <Input type="number" value={settings?.providerDefaultCommissionRate ?? 0} onChange={(e) => setSettings((prev) => ({ ...prev, providerDefaultCommissionRate: Number(e.target.value || 0) }))} />
            </label>
            <label className="space-y-2 text-sm font-semibold">
              <span>Provider Lead Window (mins)</span>
              <Input type="number" value={settings?.providerLeadPriorityWindowMinutes ?? 0} onChange={(e) => setSettings((prev) => ({ ...prev, providerLeadPriorityWindowMinutes: Number(e.target.value || 0) }))} />
            </label>
            <label className="space-y-2 text-sm font-semibold">
              <span>Vendor Monthly Fee</span>
              <Input type="number" value={settings?.vendorMonthlyFee ?? 0} onChange={(e) => setSettings((prev) => ({ ...prev, vendorMonthlyFee: Number(e.target.value || 0) }))} />
            </label>
            <label className="space-y-2 text-sm font-semibold">
              <span>Vendor Commission Type</span>
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={settings?.vendorPerformanceCommissionType || "percentage"} onChange={(e) => setSettings((prev) => ({ ...prev, vendorPerformanceCommissionType: e.target.value }))}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
              </select>
            </label>
            <label className="space-y-2 text-sm font-semibold">
              <span>Vendor Commission Value</span>
              <Input type="number" value={settings?.vendorPerformanceCommissionValue ?? 0} onChange={(e) => setSettings((prev) => ({ ...prev, vendorPerformanceCommissionValue: Number(e.target.value || 0) }))} />
            </label>
            <label className="space-y-2 text-sm font-semibold">
              <span>Vendor Marketing Credits</span>
              <Input type="number" value={settings?.vendorMarketingCreditsMonthly ?? 0} onChange={(e) => setSettings((prev) => ({ ...prev, vendorMarketingCreditsMonthly: Number(e.target.value || 0) }))} />
            </label>
            <div className="md:col-span-2">
              <Button onClick={handleSaveSettings} disabled={saving} className="rounded-xl font-bold">
                <Save className="h-4 w-4 mr-2" /> Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Live Report
            </CardTitle>
            <CardDescription>Active adoption and billing summary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-border/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Customer Subs</p>
              <p className="text-2xl font-black mt-1">{report?.activeByType?.customer || 0}</p>
            </div>
            <div className="rounded-2xl border border-border/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Provider Subs</p>
              <p className="text-2xl font-black mt-1">{report?.activeByType?.provider || 0}</p>
            </div>
            <div className="rounded-2xl border border-border/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vendor Subs</p>
              <p className="text-2xl font-black mt-1">{report?.activeByType?.vendor || 0}</p>
            </div>
            <div className="rounded-2xl border border-border/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Renewal Revenue</p>
              <p className="text-2xl font-black mt-1">INR {Number(report?.renewalRevenue || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vendor Commission</p>
              <p className="text-2xl font-black mt-1">INR {Number(report?.vendorPerformanceCommission || 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Create Plan</CardTitle>
          <CardDescription>Add new subscription plans without touching code.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-6 gap-3">
          <label className="space-y-2 text-sm font-semibold md:col-span-2">
            <span>Plan ID</span>
            <Input value={newPlan.planId} onChange={(e) => setNewPlan((prev) => ({ ...prev, planId: e.target.value.trim() }))} placeholder="swm_plus_weekend" />
          </label>
          <label className="space-y-2 text-sm font-semibold md:col-span-2">
            <span>Name</span>
            <Input value={newPlan.name} onChange={(e) => setNewPlan((prev) => ({ ...prev, name: e.target.value }))} placeholder="SWM Plus Weekend" />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>User Type</span>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={newPlan.userType} onChange={(e) => setNewPlan((prev) => ({ ...prev, userType: e.target.value }))}>
              <option value="customer">Customer</option>
              <option value="provider">Provider</option>
              <option value="vendor">Vendor</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>Billing Cycle</span>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={newPlan.billingCycle} onChange={(e) => setNewPlan((prev) => ({ ...prev, billingCycle: e.target.value }))}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>Price</span>
            <Input type="number" value={newPlan.price} onChange={(e) => setNewPlan((prev) => ({ ...prev, price: Number(e.target.value || 0) }))} />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>Duration Days</span>
            <Input type="number" value={newPlan.durationDays} onChange={(e) => setNewPlan((prev) => ({ ...prev, durationDays: Number(e.target.value || 0) }))} />
          </label>
          <div className="md:col-span-6">
            <Button onClick={handleCreatePlan} className="rounded-xl font-bold">
              <Save className="h-4 w-4 mr-2" /> Create Plan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Plan Metadata</CardTitle>
          <CardDescription>Edit plan prices, discounts, burden source, provider commission, and enterprise benefits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.planId} className="rounded-2xl border border-border/50 p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h3 className="font-black text-lg">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">{plan.planId} • {plan.userType}</p>
                </div>
                <Button onClick={() => handleSavePlan(plan)} className="rounded-xl font-bold md:w-auto w-full">
                  <Save className="h-4 w-4 mr-2" /> Save Plan
                </Button>
              </div>
              <div className="grid md:grid-cols-4 gap-3">
                <label className="space-y-2 text-sm font-semibold">
                  <span>Status</span>
                  <Button
                    variant={plan.isActive ? "default" : "outline"}
                    className={`h-10 w-full rounded-md font-bold text-[10px] uppercase tracking-wider ${plan.isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                    onClick={() => handlePlanChange(plan.planId, "isActive", !plan.isActive)}
                  >
                    {plan.isActive ? "Enabled" : "Disabled"}
                  </Button>
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  <span>Price</span>
                  <Input type="number" value={plan.price ?? 0} onChange={(e) => handlePlanChange(plan.planId, "price", Number(e.target.value || 0))} />
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  <span>Duration Days</span>
                  <Input type="number" value={plan.durationDays ?? 0} onChange={(e) => handlePlanChange(plan.planId, "durationDays", Number(e.target.value || 0))} />
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  <span>Discount %</span>
                  <Input type="number" value={plan.meta?.discountPercentage ?? 0} onChange={(e) => handlePlanChange(plan.planId, "meta.discountPercentage", Number(e.target.value || 0))} />
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  <span>Discount Funded By</span>
                  <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={plan.meta?.discountFundedBy || "platform"} onChange={(e) => handlePlanChange(plan.planId, "meta.discountFundedBy", e.target.value)}>
                    <option value="platform">Platform</option>
                    <option value="provider">Provider</option>
                    <option value="vendor">Vendor</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  <span>Min Cart</span>
                  <Input type="number" value={plan.meta?.minCartValueForDiscount ?? 0} onChange={(e) => handlePlanChange(plan.planId, "meta.minCartValueForDiscount", Number(e.target.value || 0))} />
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  <span>Provider Commission %</span>
                  <Input type="number" value={plan.meta?.providerCommissionRate ?? plan.meta?.commissionRate ?? 0} onChange={(e) => handlePlanChange(plan.planId, "meta.providerCommissionRate", Number(e.target.value || 0))} />
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  <span>Lead Window</span>
                  <Input type="number" value={plan.meta?.leadPriorityWindowMinutes ?? 0} onChange={(e) => handlePlanChange(plan.planId, "meta.leadPriorityWindowMinutes", Number(e.target.value || 0))} />
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  <span>Vendor Marketing Credits</span>
                  <Input type="number" value={plan.meta?.marketingCreditsMonthly ?? plan.meta?.marketingCredits ?? 0} onChange={(e) => handlePlanChange(plan.planId, "meta.marketingCreditsMonthly", Number(e.target.value || 0))} />
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
