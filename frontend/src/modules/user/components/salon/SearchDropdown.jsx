import { motion, AnimatePresence } from "framer-motion";
import { Star, Plus, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { toast } from "sonner";

const SearchDropdown = ({ isOpen, services, searchQuery, onClose }) => {
  const navigate = useNavigate();
  const { addToCart, cartItems } = useCart();
  const { isLoggedIn } = useAuth();

  if (!isOpen || services.length === 0) return null;

  const displayServices = services.slice(0, 5);
  const hasMore = services.length > 5;

  const handleServiceClick = (serviceId) => {
    navigate(`/service/${serviceId}`);
    onClose();
  };

  const handleAddToCart = (e, service) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    addToCart(service);
    toast.success(`${service.name} added to cart`);
  };

  const handleViewAll = () => {
    navigate(`/explore?q=${encodeURIComponent(searchQuery)}`);
    onClose();
  };

  const isInCart = (serviceId) => {
    return cartItems.some(item => item.id === serviceId);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl overflow-hidden z-50 max-h-[400px] overflow-y-auto"
      >
        {/* Results Header */}
        <div className="px-4 py-2 border-b border-border/30 bg-accent/30">
          <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Found {services.length} {services.length === 1 ? 'service' : 'services'}
          </p>
        </div>

        {/* Service Results */}
        <div className="divide-y divide-border/30">
          {displayServices.map((service, idx) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => handleServiceClick(service.id)}
              className="px-4 py-3 hover:bg-accent/50 cursor-pointer transition-all flex items-center gap-3 group"
            >
              {/* Service Image */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-accent flex-shrink-0 border border-border/30">
                <img 
                  src={service.image} 
                  alt={service.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                />
              </div>

              {/* Service Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold line-clamp-1 group-hover:text-primary transition-colors">
                  {service.name}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-0.5 bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-green-500/20">
                    <Star className="w-2.5 h-2.5 fill-green-600" />
                    {service.rating}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {service.duration || "45 min"}
                  </span>
                </div>
              </div>

              {/* Price & Add Button */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-black text-primary">₹{service.price}</span>
                <button
                  onClick={(e) => handleAddToCart(e, service)}
                  disabled={isInCart(service.id)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    isInCart(service.id)
                      ? 'bg-green-500/20 text-green-600 border border-green-500/30'
                      : 'bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20'
                  }`}
                  title={isInCart(service.id) ? 'In Cart' : 'Add to Cart'}
                >
                  {isInCart(service.id) ? (
                    <span className="text-xs font-bold">✓</span>
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* View All Button */}
        {hasMore && (
          <div className="px-4 py-3 border-t border-border/30 bg-accent/20">
            <button
              onClick={handleViewAll}
              className="w-full py-2.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white font-bold text-sm transition-all border border-primary/20"
            >
              View All Results ({services.length})
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default SearchDropdown;
