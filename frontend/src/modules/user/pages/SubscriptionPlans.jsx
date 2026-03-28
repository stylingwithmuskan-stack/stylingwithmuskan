import SubscriptionPortal from "@/modules/subscriptions/components/SubscriptionPortal";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { api } from "@/modules/user/lib/api";

export default function SubscriptionPlans() {
  const { user, setUser } = useAuth();

  const handleActivated = async () => {
    try {
      const { user: freshUser } = await api.me();
      setUser(freshUser);
    } catch {
    }
  };

  return (
    <SubscriptionPortal
      role="user"
      entity={user}
      title="SWM Plus"
      subtitle="Real subscription status, pricing, and benefits driven by the backend."
      onActivated={handleActivated}
    />
  );
}
