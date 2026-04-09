import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import SubscriptionPortal from "@/modules/subscriptions/components/SubscriptionPortal";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { api } from "@/modules/user/lib/api";

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { gender } = useGenderTheme();

  const handleActivated = async () => {
    try {
      const { user: freshUser } = await api.me();
      setUser(freshUser);
    } catch {
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>SWM Plus</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto mt-6">
        <SubscriptionPortal
          role="user"
          entity={user}
          title="Plus Benefits"
          subtitle="Real subscription status, pricing, and benefits driven by the backend."
          onActivated={handleActivated}
        />
      </div>
    </div>
  );
}
