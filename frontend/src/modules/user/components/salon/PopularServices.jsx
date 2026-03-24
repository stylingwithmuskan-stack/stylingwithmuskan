import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Star, Clock, ChevronRight, Plus } from "lucide-react";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { useWishlist } from "@/modules/user/contexts/WishlistContext";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { Button } from "@/modules/user/components/ui/button";
import { Heart } from "lucide-react";

const PopularServices = () => {
  const { gender } = useGenderTheme();
  const { addToCart } = useCart();
  const { isLoggedIn, setIsLoginModalOpen, user } = useAuth();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const navigate = useNavigate();
  const { services, checkAvailability } = useUserModuleData();

  const userCity = user?.address?.city || null;
  const filtered = services.filter((s) => s.gender === gender && checkAvailability(s, userCity));

  const handleAddToCart = (service) => {
    if (!isLoggedIn) {
      setIsLoginModalOpen(true);
      return;
    }
    addToCart(service);
  };

  return (
    <div className="mt-4">
      <div className="px-4 flex items-center justify-between mb-4">
        <h2 className={`text-lg font-bold ${gender === "women" ? "font-display" : "font-heading-men"}`}>
          Popular Services
        </h2>
        <button
          onClick={() => navigate("/explore/facial")}
          className="text-xs text-primary font-medium flex items-center gap-0.5"
        >
          View All <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto hide-scrollbar px-4 pb-2">
        {filtered.map((service, i) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ y: -4 }}
            className="flex-shrink-0 w-48 md:w-56 glass-strong rounded-lg overflow-hidden shadow-soft hover:shadow-elevated transition-all duration-300 cursor-default"
          >
            <div className="relative h-32 overflow-hidden cursor-pointer">
              <img
                src={service.image}
                alt={service.name}
                onClick={() => navigate(`/service/${service.id}`)}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                loading="lazy"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWishlist(service);
                }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full glass-strong flex items-center justify-center backdrop-blur-md z-10 active:scale-90 transition-transform"
              >
                <Heart className={`w-3.5 h-3.5 transition-colors ${isInWishlist(service.id) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            </div>
            <div className="p-3">
              <h3 className="font-semibold text-sm truncate cursor-pointer" onClick={() => navigate(`/service/${service.id}`)}>{service.name}</h3>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-primary text-primary" />{service.rating}</span>
                <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{service.duration}</span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-primary text-sm">₹{service.price.toLocaleString()}</span>
                    {service.originalPrice && (
                      <span className="text-[10px] text-muted-foreground line-through opacity-60">
                        ₹{service.originalPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {service.originalPrice && (
                    <span className="text-[9px] font-bold text-green-600 bg-green-600/5 w-fit px-1 rounded">
                      {Math.round(((service.originalPrice - service.price) / service.originalPrice) * 100)}% OFF
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  className="h-7 text-[10px] px-4 font-bold uppercase tracking-wider bg-primary hover:bg-primary/90"
                  onClick={() => navigate(`/service/${service.id}`)}
                >
                  View
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PopularServices;

