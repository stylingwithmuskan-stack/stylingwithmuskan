import { useState } from "react";
import { Search, Bell, MapPin, ChevronDown, Home, Compass, Calendar, User, Heart, MessageSquare } from "lucide-react";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useWishlist } from "@/modules/user/contexts/WishlistContext";
import AddressModal from "@/modules/user/components/salon/AddressModal";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/modules/user/lib/api";
import { motion } from "framer-motion";

const desktopNavItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: Compass, label: "Explore", path: "/explore/facial" },
  { icon: Calendar, label: "Bookings", path: "/bookings" },
  { icon: User, label: "Profile", path: "/profile" },
];

const Header = () => {
  const { gender } = useGenderTheme();
  const { user, isAddressModalOpen, setIsAddressModalOpen } = useAuth();
  const { totalItems } = useCart();
  const { wishlistCount } = useWishlist();
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to explore page with the search query
      navigate(`/explore/facial?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (<header className="sticky top-0 z-30 glass-strong border-b border-border">
    <div className="max-w-6xl mx-auto px-4 py-3">
      {/* Top Row: Address + Desktop Nav + Notification */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <img src="/logo1.png" alt="Muskan" className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover border-2 border-primary/20 shadow-md transition-transform hover:scale-105" />
          <div className="h-6 w-px bg-border hidden sm:block"></div>
          <button
            onClick={() => setIsAddressModalOpen(true)}
            className="flex items-center gap-1.5 text-xs sm:text-sm hover:bg-accent px-2 py-1.5 rounded-lg transition-colors group max-w-[140px] sm:max-w-xs"
          >
            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary group-hover:scale-110 transition-transform flex-shrink-0" />
            <span className="font-medium truncate">
              {user?.address?.city || user?.address?.area || "Location"}
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </button>
        </div>

        {/* Desktop Navigation - visible only on lg+ */}
        <nav className="hidden lg:flex items-center gap-1">
          {desktopNavItems.map((item) => {
            const isActive = (path) => {
              if (path === "/profile") {
                const profilePaths = ["/profile", "/edit-profile", "/wallet", "/addresses", "/referral", "/coupons", "/support"];
                return profilePaths.some(p => location.pathname.startsWith(p));
              }
              if (path.startsWith("/explore")) return location.pathname.startsWith("/explore");
              return location.pathname === path;
            };
            const active = isActive(item.path);
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/wishlist")}
            className="w-9 h-9 rounded-full bg-accent flex items-center justify-center relative hover:bg-primary/10 hover:text-primary transition-all active:scale-90"
          >
            <Heart className="w-4 h-4" />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-white flex items-center justify-center border-2 border-background animate-in zoom-in">
                {wishlistCount}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate("/support")}
            className="w-9 h-9 rounded-full bg-accent flex items-center justify-center relative hover:bg-primary/10 hover:text-primary transition-all active:scale-90"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <motion.form
        onSubmit={handleSearch}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={gender === "women" ? "Search facials, makeup, waxing..." : "Search haircut, grooming, beard..."}
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-white border border-border/50 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-medium"
        />
      </motion.form>
    </div>

    {/* Address Modal */}
    <AddressModal
      isOpen={isAddressModalOpen}
      onClose={() => setIsAddressModalOpen(false)}
    />
  </header>);
};
export default Header;
