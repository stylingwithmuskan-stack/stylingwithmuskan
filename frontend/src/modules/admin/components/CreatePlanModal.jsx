import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ArrowLeft, Save, Users, Briefcase, Building2 } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { Switch } from "@/modules/user/components/ui/switch";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";

const USER_TYPES = [
  {
    value: "customer",
    label: "Customer",
    icon: Users,
    description: "For end users booking services",
    color: "text-blue-500",
    bgColor: "bg-blue-50 hover:bg-blue-100 border-blue-200",
  },
  {
    value: "provider",
    label: "Provider",
    icon: Briefcase,
    description: "For service professionals",
    color: "text-purple-500",
    bgColor: "bg-purple-50 hover:bg-purple-100 border-purple-200",
  },
  {
    value: "vendor",
    label: "Vendor",
    icon: Building2,
    description: "For city managers",
    color: "text-emerald-500",
    bgColor: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
  },
];

export default function CreatePlanModal({ isOpen, onClose, onSubmit, editMode = false, initialData = null }) {
  const { getParents, getCategories } = useAdminAuth();
  const [step, setStep] = useState(editMode ? 2 : 1);
  const [selectedType, setSelectedType] = useState(editMode && initialData ? initialData.userType : null);
  const [formData, setFormData] = useState({
    planId: "",
    name: "",
    price: "",
    durationDays: 30,
    billingCycle: "monthly",
    tagline: "",
    parentCategory: "",
    category: "",
    // Customer fields
    discountPercentage: "",
    minCartValueForDiscount: "",
    discountFundedBy: "platform",
    zeroConvenienceFee: false,
    zeroTravelFee: false,
    priorityBookingEnabled: false,
    eliteAccessEnabled: false,
    // Provider fields
    providerCommissionRate: "",
    leadPriorityWindowMinutes: "",
    proBadgeEnabled: false,
    boostedVisibilityEnabled: false,
    premiumTrainingAccess: false,
    // Vendor fields
    marketingCreditsMonthly: "",
    prioritySupport: false,
    subAccountsEnabled: false,
    vendorPerformanceCommissionType: "percentage",
    vendorPerformanceCommissionValue: "",
  });

  const [parents, setParents] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);

  // Fetch parents and categories
  useEffect(() => {
    if (isOpen) {
      const loadContent = async () => {
        setLoadingContent(true);
        try {
          const [p, c] = await Promise.all([getParents(), getCategories()]);
          setParents(p || []);
          setAllCategories(c || []);
        } catch (error) {
          console.error("Failed to load categories:", error);
        } finally {
          setLoadingContent(false);
        }
      };
      loadContent();
    }
  }, [isOpen]);

  // Filter subcategories when parent changes
  useEffect(() => {
    if (formData.parentCategory) {
      const filtered = allCategories.filter(c => c.serviceType === formData.parentCategory);
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories([]);
    }
  }, [formData.parentCategory, allCategories]);

  // Load initial data when in edit mode
  useEffect(() => {
    if (editMode && initialData && isOpen) {
      setStep(2);
      setSelectedType(initialData.userType);
      setFormData({
        planId: initialData.planId || "",
        name: initialData.name || "",
        price: initialData.price || "",
        durationDays: initialData.durationDays || 30,
        billingCycle: initialData.billingCycle || "monthly",
        tagline: initialData.tagline || "",
        parentCategory: initialData.parentCategory || "",
        category: initialData.category || "",
        // Customer fields
        discountPercentage: initialData.meta?.discountPercentage || "",
        minCartValueForDiscount: initialData.meta?.minCartValueForDiscount || "",
        discountFundedBy: initialData.meta?.discountFundedBy || "platform",
        zeroConvenienceFee: initialData.meta?.zeroConvenienceFee || false,
        zeroTravelFee: initialData.meta?.zeroTravelFee || false,
        priorityBookingEnabled: initialData.meta?.priorityBookingEnabled || false,
        eliteAccessEnabled: initialData.meta?.eliteAccessEnabled || false,
        // Provider fields
        providerCommissionRate: initialData.meta?.providerCommissionRate || initialData.meta?.commissionRate || "",
        leadPriorityWindowMinutes: initialData.meta?.leadPriorityWindowMinutes || "",
        proBadgeEnabled: initialData.meta?.proBadgeEnabled || false,
        boostedVisibilityEnabled: initialData.meta?.boostedVisibilityEnabled || false,
        premiumTrainingAccess: initialData.meta?.premiumTrainingAccess || false,
        // Vendor fields
        marketingCreditsMonthly: initialData.meta?.marketingCreditsMonthly || initialData.meta?.marketingCredits || "",
        prioritySupport: initialData.meta?.prioritySupport || false,
        subAccountsEnabled: initialData.meta?.subAccountsEnabled || false,
        vendorPerformanceCommissionType: initialData.meta?.vendorPerformanceCommissionType || "percentage",
        vendorPerformanceCommissionValue: initialData.meta?.vendorPerformanceCommissionValue || "",
      });
    } else if (!editMode && isOpen) {
      // Reset for create mode
      setStep(1);
      setSelectedType(null);
    }
  }, [editMode, initialData, isOpen]);

  const handleClose = () => {
    if (!editMode) {
      setStep(1);
      setSelectedType(null);
      setFormData({
        planId: "",
        name: "",
        price: "",
        durationDays: 30,
        billingCycle: "monthly",
        tagline: "",
        parentCategory: "",
        category: "",
        discountPercentage: "",
        minCartValueForDiscount: "",
        discountFundedBy: "platform",
        zeroConvenienceFee: false,
        zeroTravelFee: false,
        priorityBookingEnabled: false,
        eliteAccessEnabled: false,
        providerCommissionRate: "",
        leadPriorityWindowMinutes: "",
        proBadgeEnabled: false,
        boostedVisibilityEnabled: false,
        premiumTrainingAccess: false,
        marketingCreditsMonthly: "",
        prioritySupport: false,
        subAccountsEnabled: false,
        vendorPerformanceCommissionType: "percentage",
        vendorPerformanceCommissionValue: "",
      });
    }
    onClose();
  };

  const handleNext = () => {
    if (selectedType) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const meta = {};
    
    if (selectedType === "customer") {
      meta.discountPercentage = Number(formData.discountPercentage) || 0;
      meta.minCartValueForDiscount = Number(formData.minCartValueForDiscount) || 0;
      meta.discountFundedBy = formData.discountFundedBy;
      meta.zeroConvenienceFee = formData.zeroConvenienceFee;
      meta.zeroTravelFee = formData.zeroTravelFee;
      meta.priorityBookingEnabled = formData.priorityBookingEnabled;
      meta.eliteAccessEnabled = formData.eliteAccessEnabled;
    } else if (selectedType === "provider") {
      meta.providerCommissionRate = Number(formData.providerCommissionRate) || 0;
      meta.commissionRate = Number(formData.providerCommissionRate) || 0;
      meta.leadPriorityWindowMinutes = Number(formData.leadPriorityWindowMinutes) || 0;
      meta.proBadgeEnabled = formData.proBadgeEnabled;
      meta.boostedVisibilityEnabled = formData.boostedVisibilityEnabled;
      meta.premiumTrainingAccess = formData.premiumTrainingAccess;
    } else if (selectedType === "vendor") {
      meta.marketingCreditsMonthly = Number(formData.marketingCreditsMonthly) || 0;
      meta.marketingCredits = Number(formData.marketingCreditsMonthly) || 0;
      meta.prioritySupport = formData.prioritySupport;
      meta.subAccountsEnabled = formData.subAccountsEnabled;
      meta.vendorPerformanceCommissionType = formData.vendorPerformanceCommissionType;
      meta.vendorPerformanceCommissionValue = Number(formData.vendorPerformanceCommissionValue) || 0;
    }

    const planData = {
      planId: formData.planId.trim(),
      name: formData.name.trim(),
      userType: selectedType,
      price: Number(formData.price) || 0,
      durationDays: Number(formData.durationDays) || 30,
      billingCycle: formData.billingCycle,
      tagline: formData.tagline.trim(),
      parentCategory: formData.parentCategory || null,
      category: formData.category || null,
      benefits: [],
      isActive: true,
      meta,
    };

    await onSubmit(planData);
    handleClose();
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background w-full max-w-2xl rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30 flex-shrink-0">
          <div>
            <h3 className="text-xl font-black">
              {editMode 
                ? `Edit ${USER_TYPES.find(t => t.value === selectedType)?.label} Plan`
                : step === 1 
                  ? "Create New Plan" 
                  : `Create ${USER_TYPES.find(t => t.value === selectedType)?.label} Plan`
              }
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {editMode 
                ? "Update plan details" 
                : step === 1 
                  ? "Select user type to continue" 
                  : "Fill in plan details"
              }
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {step === 1 && !editMode ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <Label className="text-sm font-bold">Select User Type:</Label>
                <div className="space-y-3">
                  {USER_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setSelectedType(type.value)}
                        className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                          selectedType === type.value
                            ? `${type.bgColor} border-current`
                            : "bg-muted/30 border-border hover:border-border/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl ${type.bgColor} flex items-center justify-center`}>
                            <Icon className={`w-6 h-6 ${type.color}`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-sm">{type.label}</p>
                            <p className="text-xs text-muted-foreground">{type.description}</p>
                          </div>
                          {selectedType === type.value && (
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {/* Basic Info */}
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-3">Basic Info</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Plan Name *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        placeholder="SWM Plus Weekend"
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Plan ID *</Label>
                      <Input
                        value={formData.planId}
                        onChange={(e) => updateField("planId", e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                        placeholder="swm_plus_weekend"
                        required
                        disabled={editMode}
                        className="rounded-xl font-mono"
                      />
                      {editMode && (
                        <p className="text-[10px] text-muted-foreground">Plan ID cannot be changed</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Billing Cycle</Label>
                      <select
                        value={formData.billingCycle}
                        onChange={(e) => updateField("billingCycle", e.target.value)}
                        className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annual">Annual</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Price (₹) *</Label>
                      <Input
                        type="number"
                        value={formData.price}
                        onChange={(e) => updateField("price", e.target.value)}
                        placeholder="Enter price (e.g., 499)"
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Duration (days) *</Label>
                      <Input
                        type="number"
                        value={formData.durationDays}
                        onChange={(e) => updateField("durationDays", e.target.value)}
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Tagline</Label>
                      <Input
                        value={formData.tagline}
                        onChange={(e) => updateField("tagline", e.target.value)}
                        placeholder="Best value for loyal customers"
                        className="rounded-xl"
                      />
                    </div>
                    
                    {/* Category Selection for Customer Plans */}
                    {selectedType === "customer" && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Category (Parent)</Label>
                          <select
                            value={formData.parentCategory}
                            onChange={(e) => {
                                updateField("parentCategory", e.target.value);
                                updateField("category", ""); // Reset subcategory
                            }}
                            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                            disabled={loadingContent}
                          >
                            <option value="">All Categories (Global)</option>
                            {parents.map((p) => (
                              <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Subcategory</Label>
                          <select
                            value={formData.category}
                            onChange={(e) => updateField("category", e.target.value)}
                            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                            disabled={loadingContent || !formData.parentCategory}
                          >
                            <option value="">All Subcategories</option>
                            {filteredCategories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name} ({c.gender})</option>
                            ))}
                          </select>
                          {!formData.parentCategory && (
                              <p className="text-[10px] text-muted-foreground mt-1">Select a parent category first</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Role-specific fields */}
                {selectedType === "customer" && (
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-3">Customer Benefits</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Discount %</Label>
                        <Input
                          type="number"
                          value={formData.discountPercentage}
                          onChange={(e) => updateField("discountPercentage", e.target.value)}
                          placeholder="e.g., 10"
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Min Cart (₹)</Label>
                        <Input
                          type="number"
                          value={formData.minCartValueForDiscount}
                          onChange={(e) => updateField("minCartValueForDiscount", e.target.value)}
                          placeholder="e.g., 500"
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Discount Funded By</Label>
                        <select
                          value={formData.discountFundedBy}
                          onChange={(e) => updateField("discountFundedBy", e.target.value)}
                          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                        >
                          <option value="admin">Admin</option>
                          <option value="all">All</option>
                        </select>
                      </div>
                      <div className="space-y-3 md:col-span-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold">Zero Convenience Fee</Label>
                          <Switch
                            checked={formData.zeroConvenienceFee}
                            onCheckedChange={(v) => updateField("zeroConvenienceFee", v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold">Zero Travel Fee</Label>
                          <Switch
                            checked={formData.zeroTravelFee}
                            onCheckedChange={(v) => updateField("zeroTravelFee", v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold">Priority Booking</Label>
                          <Switch
                            checked={formData.priorityBookingEnabled}
                            onCheckedChange={(v) => updateField("priorityBookingEnabled", v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold">Elite Access</Label>
                          <Switch
                            checked={formData.eliteAccessEnabled}
                            onCheckedChange={(v) => updateField("eliteAccessEnabled", v)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedType === "provider" && (
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-3">Provider Benefits</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Commission %</Label>
                        <Input
                          type="number"
                          value={formData.providerCommissionRate}
                          onChange={(e) => updateField("providerCommissionRate", e.target.value)}
                          placeholder="e.g., 15"
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Lead Window (minutes)</Label>
                        <Input
                          type="number"
                          value={formData.leadPriorityWindowMinutes}
                          onChange={(e) => updateField("leadPriorityWindowMinutes", e.target.value)}
                          placeholder="e.g., 30"
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-3 md:col-span-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold">Pro Badge</Label>
                          <Switch
                            checked={formData.proBadgeEnabled}
                            onCheckedChange={(v) => updateField("proBadgeEnabled", v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold">Boosted Visibility</Label>
                          <Switch
                            checked={formData.boostedVisibilityEnabled}
                            onCheckedChange={(v) => updateField("boostedVisibilityEnabled", v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold">Premium Training</Label>
                          <Switch
                            checked={formData.premiumTrainingAccess}
                            onCheckedChange={(v) => updateField("premiumTrainingAccess", v)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedType === "vendor" && (
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-3">Vendor Benefits</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Marketing Credits (₹)</Label>
                        <Input
                          type="number"
                          value={formData.marketingCreditsMonthly}
                          onChange={(e) => updateField("marketingCreditsMonthly", e.target.value)}
                          placeholder="e.g., 5000"
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Commission Type</Label>
                        <select
                          value={formData.vendorPerformanceCommissionType}
                          onChange={(e) => updateField("vendorPerformanceCommissionType", e.target.value)}
                          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Commission Value</Label>
                        <Input
                          type="number"
                          value={formData.vendorPerformanceCommissionValue}
                          onChange={(e) => updateField("vendorPerformanceCommissionValue", e.target.value)}
                          placeholder="e.g., 20"
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-3 md:col-span-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold">Priority Support</Label>
                          <Switch
                            checked={formData.prioritySupport}
                            onCheckedChange={(v) => updateField("prioritySupport", v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold">Sub Accounts</Label>
                          <Switch
                            checked={formData.subAccountsEnabled}
                            onCheckedChange={(v) => updateField("subAccountsEnabled", v)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted/30 flex justify-between flex-shrink-0">
          {step === 1 && !editMode ? (
            <>
              <Button type="button" variant="outline" onClick={handleClose} className="rounded-xl font-bold">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={!selectedType}
                className="rounded-xl font-bold gap-2"
              >
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              {!editMode && (
                <Button type="button" variant="outline" onClick={handleBack} className="rounded-xl font-bold gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              )}
              {editMode && (
                <Button type="button" variant="outline" onClick={handleClose} className="rounded-xl font-bold">
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                onClick={handleSubmit}
                className="rounded-xl font-bold gap-2"
              >
                <Save className="w-4 h-4" /> {editMode ? "Update Plan" : "Create Plan"}
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
