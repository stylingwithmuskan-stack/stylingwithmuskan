import SubscriptionPortal from "@/modules/subscriptions/components/SubscriptionPortal";
import { useProviderAuth } from "@/modules/serviceprovider/contexts/ProviderAuthContext";

export default function ProviderSubscriptionPage() {
  const { provider, setProvider } = useProviderAuth();

  const handleActivated = (snapshot) => {
    if (!provider) return;
    setProvider({
      ...provider,
      subscription: snapshot,
      isPro: snapshot?.isPro,
      proExpiry: snapshot?.currentPeriodEnd,
      proPlan: snapshot?.planId,
    });
  };

  return (
    <SubscriptionPortal
      role="provider"
      entity={provider}
      title="SWM Pro Partner"
      subtitle="Lower commission, early leads, badge visibility, and premium training in one backend-controlled plan."
      onActivated={handleActivated}
    />
  );
}
