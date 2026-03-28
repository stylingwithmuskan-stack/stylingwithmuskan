import SubscriptionPortal from "@/modules/subscriptions/components/SubscriptionPortal";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";

export default function VendorSubscriptionPage() {
  const { vendor, setVendor } = useVenderAuth();

  const handleActivated = (snapshot) => {
    if (!vendor) return;
    setVendor({
      ...vendor,
      subscription: snapshot,
    });
  };

  return (
    <SubscriptionPortal
      role="vendor"
      entity={vendor}
      title="SWM City Manager Enterprise"
      subtitle="Enterprise analytics, sub-accounts, support priority, marketing credits, and performance billing from one real backend flow."
      onActivated={handleActivated}
    />
  );
}
