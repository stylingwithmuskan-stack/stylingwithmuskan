import { useLocation, useNavigate } from "react-router-dom";
import { Home, Search, Calendar, User, ShoppingBag } from "lucide-react";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";

const leftTabs = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: Search, label: "Explore", path: "/explore/facial" },
];

const rightTabs = [
  { icon: Calendar, label: "Bookings", path: "/bookings" },
  { icon: User, label: "Profile", path: "/profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { totalItems, isFloatingSummaryOpen, setIsFloatingSummaryOpen, setIsCartOpen, setActiveCheckoutType } = useCart();
  const { isLoggedIn } = useAuth();
  // Only show on user-facing pages (hide on admin/provider/vender/splash/gender-select)
  const nonUserPrefixes = ["/admin", "/provider", "/vender", "/select-gender"];
  const isSplash = location.pathname === "/";
  if (isSplash || nonUserPrefixes.some(p => location.pathname.startsWith(p))) return null;

  const isActive = (path) => {
    if (path === "/profile") {
      const profilePaths = ["/profile", "/edit-profile", "/wallet", "/addresses", "/referral", "/coupons", "/support"];
      return profilePaths.some(p => location.pathname.startsWith(p));
    }
    if (path.startsWith("/explore")) return location.pathname.startsWith("/explore");
    return location.pathname === path;
  };

  const handleCartClick = () => {
    if (!isLoggedIn || totalItems === 0) return;
    // Toggle the floating summary bar
    setIsFloatingSummaryOpen(prev => !prev);
  };

  const renderTab = (tab) => {
    const active = isActive(tab.path);
    return (
      <button key={tab.label} onClick={() => navigate(tab.path)} className="flex flex-col items-center gap-1 relative flex-1">
        <tab.icon className={`w-5 h-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`} />
        <span className={`text-[10px] ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>{tab.label}</span>
      </button>
    );
  };

  return (<nav className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border z-40 lg:hidden">
    <div className="flex items-center justify-around h-16 px-2">
      {/* Left tabs */}
      {leftTabs.map(renderTab)}

      {/* Center Cart Button */}
      <button
        onClick={handleCartClick}
        className={`flex flex-col items-center gap-0.5 relative flex-1 -mt-5 group`}
      >
        <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
          isFloatingSummaryOpen
            ? "bg-primary text-white scale-110 shadow-primary/40"
            : totalItems > 0
              ? "bg-primary text-white shadow-primary/30"
              : "bg-accent text-muted-foreground shadow-md"
        }`}>
          <ShoppingBag className="w-6 h-6" />
          {totalItems > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-white text-primary text-[10px] font-black flex items-center justify-center border-2 border-primary shadow-md animate-in zoom-in">
              {totalItems}
            </span>
          )}
        </div>
        <span className={`text-[9px] font-bold ${isFloatingSummaryOpen ? "text-primary" : totalItems > 0 ? "text-primary" : "text-muted-foreground"}`}>Cart</span>
      </button>

      {/* Right tabs */}
      {rightTabs.map(renderTab)}
    </div>
  </nav>);
};

export default BottomNav;
