import { motion } from "framer-motion";
import { Edit2, Trash2, Crown, Briefcase, Building2 } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";

const USER_TYPE_CONFIG = {
  customer: {
    icon: Crown,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  provider: {
    icon: Briefcase,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  vendor: {
    icon: Building2,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
};

export default function PlanCard({ plan, onEdit, onDelete, onToggleStatus }) {
  const config = USER_TYPE_CONFIG[plan.userType] || USER_TYPE_CONFIG.customer;
  const Icon = config.icon;

  const getBillingCycleLabel = (cycle) => {
    const labels = {
      monthly: "Monthly",
      quarterly: "Quarterly",
      annual: "Annual",
      custom: "Custom",
    };
    return labels[cycle] || cycle;
  };

  const getKeyBenefit = () => {
    if (plan.userType === "customer") {
      return `${plan.meta?.discountPercentage || 0}% discount`;
    } else if (plan.userType === "provider") {
      return `${plan.meta?.providerCommissionRate || plan.meta?.commissionRate || 0}% commission`;
    } else if (plan.userType === "vendor") {
      return `₹${plan.meta?.marketingCreditsMonthly || plan.meta?.marketingCredits || 0} credits`;
    }
    return "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 ${config.borderColor} ${config.bgColor} backdrop-blur-sm p-5 hover:shadow-lg transition-all h-full flex flex-col`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-12 h-12 rounded-xl ${config.bgColor} border-2 ${config.borderColor} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${config.color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-base truncate text-foreground">{plan.name}</h3>
            <p className="text-[10px] text-muted-foreground font-mono truncate">{plan.planId}</p>
          </div>
        </div>
        <Badge
          variant={plan.isActive ? "default" : "outline"}
          className={`text-[9px] font-black uppercase flex-shrink-0 ml-2 ${
            plan.isActive ? "bg-green-600 text-white" : "text-muted-foreground"
          }`}
        >
          {plan.isActive ? "Active" : "Disabled"}
        </Badge>
      </div>

      <div className="space-y-2 mb-4 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-foreground">₹{plan.price}</span>
          <span className="text-sm text-muted-foreground">• {plan.durationDays} days</span>
        </div>
        <p className="text-sm text-muted-foreground font-semibold">{getBillingCycleLabel(plan.billingCycle)}</p>
        {getKeyBenefit() && (
          <Badge variant="outline" className={`text-[10px] font-bold ${config.color} border-current`}>
            {getKeyBenefit()}
          </Badge>
        )}
        {plan.tagline && (
          <p className="text-xs text-muted-foreground italic line-clamp-2 mt-3">{plan.tagline}</p>
        )}
      </div>

      <div className="flex gap-2 mt-auto pt-4 border-t border-border/50">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onToggleStatus(plan)}
          className="flex-1 h-9 text-xs font-bold rounded-xl"
        >
          {plan.isActive ? "Disable" : "Enable"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onEdit(plan)}
          className="h-9 px-3 rounded-xl"
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDelete(plan)}
          className="h-9 px-3 rounded-xl border-red-500/30 text-red-500 hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
