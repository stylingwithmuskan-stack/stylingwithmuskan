import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, RefreshCw, Plus, Users, Briefcase, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import CreatePlanModal from "@/modules/admin/components/CreatePlanModal";
import PlanCard from "@/modules/admin/components/PlanCard";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function SubscriptionManagement() {
  const {
    getSubscriptionPlans,
    createSubscriptionPlan,
    updateSubscriptionPlan,
    deleteSubscriptionPlan,
  } = useAdminAuth();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const plansRes = await getSubscriptionPlans();
      setPlans(Array.isArray(plansRes) ? plansRes : []);
    } catch (error) {
      toast.error(error?.message || "Failed to load subscription plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreatePlan = async (planData) => {
    try {
      await createSubscriptionPlan(planData);
      toast.success("Plan created successfully!");
      await load();
    } catch (error) {
      toast.error(error?.message || "Failed to create plan");
    }
  };

  const handleToggleStatus = async (plan) => {
    try {
      await updateSubscriptionPlan(plan.planId, {
        isActive: !plan.isActive,
      });
      toast.success(`Plan ${!plan.isActive ? "enabled" : "disabled"} successfully!`);
      await load();
    } catch (error) {
      toast.error(error?.message || "Failed to update plan status");
    }
  };

  const handleEdit = async (plan) => {
    setSelectedPlan(plan);
    setShowEditModal(true);
  };

  const handleUpdatePlan = async (planData) => {
    try {
      await updateSubscriptionPlan(selectedPlan.planId, planData);
      toast.success("Plan updated successfully!");
      setShowEditModal(false);
      setSelectedPlan(null);
      await load();
    } catch (error) {
      toast.error(error?.message || "Failed to update plan");
    }
  };

  const handleDelete = async (plan) => {
    if (!confirm(`Are you sure you want to delete "${plan.name}"? This action cannot be undone.`)) return;
    
    try {
      await deleteSubscriptionPlan(plan.planId);
      toast.success("Plan deleted successfully!");
      await load();
    } catch (error) {
      toast.error(error?.message || "Failed to delete plan");
    }
  };

  // Group plans by userType
  const customerPlans = plans.filter((p) => p.userType === "customer");
  const providerPlans = plans.filter((p) => p.userType === "provider");
  const vendorPlans = plans.filter((p) => p.userType === "vendor");

  if (loading) {
    return (
      <div className="p-8 text-sm font-semibold text-muted-foreground">
        Loading subscription plans...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
            <Crown className="h-7 w-7 text-primary" /> Subscription Management
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Create and manage subscription plans for customers, providers, and vendors
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={load}
            variant="outline"
            className="rounded-xl font-bold gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl font-bold gap-2"
          >
            <Plus className="h-4 w-4" /> Create Plan
          </Button>
        </div>
      </motion.div>

      {/* Customer Plans Section */}
      <motion.div variants={container} initial="hidden" animate="show">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-blue-500" />
              Customer Plans
              <Badge variant="outline" className="ml-2 text-[10px] font-black">
                {customerPlans.length} {customerPlans.length === 1 ? "Plan" : "Plans"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Subscription plans for end users booking services
            </CardDescription>
          </CardHeader>
          <CardContent>
            {customerPlans.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground">No customer plans yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Create your first customer subscription plan
                </p>
              </div>
            ) : (
              <motion.div
                variants={container}
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              >
                {customerPlans.map((plan) => (
                  <motion.div key={plan.planId} variants={item}>
                    <PlanCard
                      plan={plan}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleStatus={handleToggleStatus}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Provider Plans Section */}
      <motion.div variants={container} initial="hidden" animate="show">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5 text-purple-500" />
              Provider Plans
              <Badge variant="outline" className="ml-2 text-[10px] font-black">
                {providerPlans.length} {providerPlans.length === 1 ? "Plan" : "Plans"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Subscription plans for service professionals
            </CardDescription>
          </CardHeader>
          <CardContent>
            {providerPlans.length === 0 ? (
              <div className="py-12 text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground">No provider plans yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Create your first provider subscription plan
                </p>
              </div>
            ) : (
              <motion.div
                variants={container}
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              >
                {providerPlans.map((plan) => (
                  <motion.div key={plan.planId} variants={item}>
                    <PlanCard
                      plan={plan}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleStatus={handleToggleStatus}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Vendor Plans Section */}
      <motion.div variants={container} initial="hidden" animate="show">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-emerald-500" />
              Vendor Plans
              <Badge variant="outline" className="ml-2 text-[10px] font-black">
                {vendorPlans.length} {vendorPlans.length === 1 ? "Plan" : "Plans"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Subscription plans for city managers and enterprise vendors
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vendorPlans.length === 0 ? (
              <div className="py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground">No vendor plans yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Create your first vendor subscription plan
                </p>
              </div>
            ) : (
              <motion.div
                variants={container}
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              >
                {vendorPlans.map((plan) => (
                  <motion.div key={plan.planId} variants={item}>
                    <PlanCard
                      plan={plan}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleStatus={handleToggleStatus}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Plan Modal */}
      <CreatePlanModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePlan}
      />

      {/* Edit Plan Modal */}
      <CreatePlanModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPlan(null);
        }}
        onSubmit={handleUpdatePlan}
        editMode={true}
        initialData={selectedPlan}
      />
    </div>
  );
}
