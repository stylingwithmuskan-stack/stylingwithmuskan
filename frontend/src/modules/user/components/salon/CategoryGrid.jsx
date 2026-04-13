import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import CustomizeBookingForm from "./CustomizeBookingForm";

const CategoryGrid = () => {
  const { gender } = useGenderTheme();
  const navigate = useNavigate();
  const { setBookingType } = useCart();
  const { user, isLoggedIn } = useAuth();
  const { categories, serviceTypes: SERVICE_TYPES, checkAvailability } = useUserModuleData();
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  const handleCustomizeClick = () => {
    if (!isLoggedIn) {
      // Redirect to login if not authenticated
      navigate("/login", { state: { from: "/home", openCustomize: true } });
      return;
    }
    setIsCustomizeOpen(true);
  };

  useEffect(() => {
    // Check if we just came back from registration/login and need to open the modal
    const state = window.history.state?.usr;
    if (isLoggedIn && state?.openCustomize) {
      setIsCustomizeOpen(true);
      // Clean up state
      window.history.replaceState({ ...window.history.state, usr: { ...state, openCustomize: false } }, "");
    }
  }, [isLoggedIn]);

  const userLocation = user?.addresses?.[0] || user?.address || null;

  // Group categories into Main Service Types for the home page
  const mainServiceTypes = SERVICE_TYPES.map(type => ({
    ...type,
    // Find the first category in this type to use as the entry point
    entryCategory: categories.find(c => c.serviceType === type.id && (c.gender === gender || !c.gender))?.id
  }))
    .filter(t => t.entryCategory)
    .filter(t => checkAvailability(t, userLocation));

  const handleServiceSelect = (type) => {
    // Default to instant for home page selections, but it will be overridden by explore page if needed
    setBookingType("instant");
    navigate(`/explore/${type.entryCategory}?type=${type.id}&booking=instant`);
  };

  return (
    <>
      <div className="px-3 mt-4">
        <div className="mb-4">
          <h2 className={`text-xl font-bold mb-0.5 ${gender === "women" ? "font-display" : "font-heading-men"}`}>
            What are you looking for?
          </h2>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-70">
            Professional Salon Services at home
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {mainServiceTypes.map((type) => (
            <motion.button
              key={type.id}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleServiceSelect(type)}
              className="relative group overflow-hidden rounded-[28px] border border-border/40 shadow-sm hover:shadow-md transition-all duration-300 aspect-[1/1] sm:aspect-auto sm:h-28 lg:h-36 flex flex-col bg-white"
            >
              <div className="absolute inset-0 z-0">
                <img
                  src={type.image}
                  alt={type.label}
                  className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500 bg-accent"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              </div>
              <div className="relative z-10 mt-auto p-4 text-left">
                <h3 className="text-sm lg:text-base font-bold text-white leading-tight">{type.label}</h3>
                <p className="hidden sm:block text-[9px] text-white/70 font-medium tracking-tight mt-0.5">{type.description}</p>
              </div>
            </motion.button>
          ))}

          {/* Customize / Enquiry Card */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCustomizeClick}
            className="relative group overflow-hidden rounded-[28px] border-2 border-dashed border-primary/20 shadow-sm hover:shadow-md transition-all duration-300 aspect-[1/1] sm:aspect-auto sm:h-28 lg:h-36 flex flex-col items-center justify-center bg-primary/5"
          >
            <div className="relative flex flex-col items-center gap-2">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                ✨
              </div>
              <div className="text-center">
                <h3 className="text-sm lg:text-base font-bold text-primary">Customize</h3>
                <p className="hidden sm:block text-[9px] text-muted-foreground font-bold tracking-tight">Bulk/Event Enquiry</p>
              </div>
            </div>
          </motion.button>
        </div>
      </div>

      <CustomizeBookingForm
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
      />
    </>
  );
};

export default CategoryGrid;
