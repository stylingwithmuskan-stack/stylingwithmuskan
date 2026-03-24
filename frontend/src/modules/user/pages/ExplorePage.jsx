import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Search, Filter, RefreshCcw, Heart, Share2, Plus, Star, MapPin, Menu, X
} from "lucide-react";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { useCart } from "@/modules/user/contexts/CartContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { useWishlist } from "@/modules/user/contexts/WishlistContext";
import { Button } from "@/modules/user/components/ui/button";
import { shareContent } from "@/modules/user/lib/utils";
import FilterModal from "@/modules/user/components/salon/FilterModal";

const ExplorePage = () => {
    const { categoryId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { gender } = useGenderTheme();
    const { totalItems, cartItems, addToCart, bookingType: contextBookingType, setBookingType, isFloatingSummaryOpen, setIsFloatingSummaryOpen } = useCart();
    const { isLoggedIn, setIsLoginModalOpen, user } = useAuth();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const { services, categories, serviceTypes: SERVICE_TYPES, checkAvailability } = useUserModuleData();

    const userCity = user?.address?.city || null;

    const availableServiceTypes = useMemo(() =>
        SERVICE_TYPES.filter(t => checkAvailability(t, userCity)),
        [SERVICE_TYPES, userCity, checkAvailability]
    );

    const searchParams = new URLSearchParams(location.search);
    const queryParam = searchParams.get('q') || "";
    const typeParam = searchParams.get('type') || "skin";
    const bookingParam = searchParams.get('booking') || contextBookingType;

    const [searchQuery, setSearchQuery] = useState(queryParam);
    const [activeType, setActiveType] = useState(typeParam);
    const [activeBooking, setActiveBooking] = useState(bookingParam);
    const [activeCategory, setActiveCategory] = useState(categoryId);
    const [activeFilter, setActiveFilter] = useState("Top Selling");
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [preferences, setPreferences] = useState({
        concern: null,
        skinType: null,
        other: null,
        priceRange: null
    });

    // Sync active state with URL
    useEffect(() => {
        if (categoryId) setActiveCategory(categoryId);
    }, [categoryId]);

    useEffect(() => {
        if (typeParam) setActiveType(typeParam);
        if (bookingParam) {
            setActiveBooking(bookingParam);
            setBookingType(bookingParam);
        }
    }, [typeParam, bookingParam, setBookingType]);

    useEffect(() => {
        if (contextBookingType && contextBookingType !== activeBooking) {
            setActiveBooking(contextBookingType);
            navigate(`/explore/${activeCategory}?type=${activeType}&booking=${contextBookingType}`, { replace: true });
        }
    }, [contextBookingType, activeBooking, activeCategory, activeType, navigate]);

    const activeTypeData = useMemo(() => SERVICE_TYPES.find(t => t.id === activeType), [activeType]);

    const filteredCategories = useMemo(() =>
        categories.filter(c =>
            c.gender === gender &&
            c.serviceType === activeType &&
            c.bookingType === activeBooking &&
            checkAvailability(c, userCity)
        ),
        [gender, activeType, activeBooking, categories, checkAvailability, userCity]
    );

    // If activeCategory is not in the filtered list (e.g. after type change), reset it
    useEffect(() => {
        if (filteredCategories.length > 0) {
            const isCurrentValid = filteredCategories.some(c => c.id === activeCategory);
            if (!isCurrentValid) {
                const firstCat = filteredCategories[0];
                setActiveCategory(firstCat.id);
                navigate(`/explore/${firstCat.id}?type=${activeType}&booking=${activeBooking}`, { replace: true });
            }
        }
    }, [filteredCategories, activeCategory, activeType, activeBooking, navigate]);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesGender = s.gender === gender;
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = searchQuery.length > 0 ? true : s.category === activeCategory;
            const isAvailable = checkAvailability(s, userCity);

            let matchesFilter = true;
            if (activeFilter === "Top Selling") matchesFilter = s.rating >= 4.7;
            else if (activeFilter === "Premium") matchesFilter = s.price > 2000;

            return matchesCategory && matchesGender && matchesSearch && matchesFilter && isAvailable;
        });
    }, [activeCategory, gender, searchQuery, activeFilter, services, checkAvailability, userCity]);

    const handleTypeChange = (typeId) => {
        const firstCat = categories.find(c =>
            c.serviceType === typeId &&
            c.gender === gender &&
            c.bookingType === activeBooking
        );
        setActiveType(typeId);
        if (firstCat) {
            setActiveCategory(firstCat.id);
            navigate(`/explore/${firstCat.id}?type=${typeId}&booking=${activeBooking}`, { replace: true });
        }
    };

    const handleCategoryChange = (catId) => {
        setActiveCategory(catId);
        navigate(`/explore/${catId}?type=${activeType}&booking=${activeBooking}`, { replace: true });
    };
    return (
        <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
            {/* Header */}
            <header className="glass-strong border-b border-border z-50 flex-shrink-0">
                <div className="px-4 py-3 flex items-center gap-3">
                    <button onClick={() => navigate("/home")} className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search for services..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-10 pl-10 bg-accent/50 rounded-xl border-none text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>
                    <button onClick={() => setIsFilterModalOpen(true)} className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center transition-all hover:bg-primary/10">
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <div className="relative flex flex-1 overflow-hidden">
                {/* Vertical Sidebar Button (Mobile View) */}
                <div className="lg:hidden absolute left-0 top-1/2 -translate-y-1/2 z-[45]">
                    <button
                        onClick={() => setIsMobileSidebarOpen(prev => !prev)}
                        className="w-8 h-12 bg-primary rounded-r-2xl flex items-center justify-center text-white shadow-lg border border-l-0 border-white/20 animate-in slide-in-from-left duration-300"
                    >
                        {isMobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                    </button>
                </div>

                {/* Vertical Sidebar (Hover Expandable on Desktop, Toggleable on Mobile) */}
                <aside
                    onMouseEnter={() => !isMobileSidebarOpen && setIsSidebarHovered(true)}
                    onMouseLeave={() => !isMobileSidebarOpen && setIsSidebarHovered(false)}
                    className={`absolute left-0 top-0 bottom-0 z-40 bg-background/95 backdrop-blur-xl border-r border-border flex flex-col items-center py-6 gap-6 transition-all duration-300 ease-in-out shadow-2xl w-[90px] 
                        ${isMobileSidebarOpen
                            ? 'translate-x-0'
                            : (isSidebarHovered ? 'translate-x-0' : '-translate-x-full lg:-translate-x-[75px]')
                        }`}
                >
                    {/* Visual cue to hover when closed (Desktop Only) */}
                    {!isSidebarHovered && !isMobileSidebarOpen && (
                        <div className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-16 bg-muted/60 rounded-l-md items-center justify-center cursor-pointer pointer-events-none border border-r-0 border-border">
                            <div className="w-1 h-6 rounded-full bg-border" />
                        </div>
                    )}

                    {availableServiceTypes.map((type) => (
                        <button
                            key={type.id}
                            onClick={() => {
                                handleTypeChange(type.id);
                                setIsSidebarHovered(false);
                                setIsMobileSidebarOpen(false);
                            }}
                            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeType === type.id ? "opacity-100" : "opacity-40 grayscale hover:grayscale-0 hover:opacity-80"}`}
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all overflow-hidden border-2 ${activeType === type.id ? "border-primary shadow-lg shadow-primary/20 scale-110" : "border-border/50"}`}>
                                <img src={type.image} alt={type.label} className="w-full h-full object-cover" />
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-tight text-center leading-tight ${activeType === type.id ? "text-primary" : "text-muted-foreground"}`}>
                                {type.label}
                            </span>
                        </button>
                    ))}
                </aside>

                {/* Main Content Area */}
                <main
                    className={`flex-1 flex flex-col overflow-hidden bg-accent/10 transition-all duration-300 
                        ${isSidebarHovered || isMobileSidebarOpen ? 'pl-[90px]' : 'pl-[15px] lg:pl-[15px]'}`}
                    onClick={() => setIsMobileSidebarOpen(false)}
                >
                    {/* Category Tabs (Sub-Subcategories) */}
                    <div className="px-4 py-4 flex gap-2 overflow-x-auto hide-scrollbar flex-shrink-0">
                        {filteredCategories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setActiveCategory(cat.id);
                                    navigate(`/explore/${cat.id}?type=${activeType}`, { replace: true });
                                }}
                                className={`px-5 py-2.5 rounded-2xl text-[11px] font-bold whitespace-nowrap transition-all border-2 ${activeCategory === cat.id
                                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105"
                                    : "bg-white text-muted-foreground border-border/50 hover:border-primary/30"}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    {/* Services List */}
                    <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-4 pt-2">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                                {categories.find(c => c.id === activeCategory)?.name || "Services"}
                            </h2>
                            <span className="text-[10px] font-bold text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                                {filteredServices.length} Results
                            </span>
                        </div>

                        {filteredServices.map((service, idx) => (
                            <motion.div
                                key={service.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="glass-strong rounded-[28px] p-4 border border-border/40 shadow-soft hover:shadow-elevated transition-all flex gap-4"
                                onClick={() => navigate(`/service/${service.id}`)}
                            >
                                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-accent flex-shrink-0 relative border border-border/50">
                                    <img src={service.image} alt={service.name} className="w-full h-full object-cover" />
                                    <div className="absolute top-1.5 right-1.5 flex flex-col gap-1.5">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleWishlist(service); }}
                                            className="w-7 h-7 rounded-full glass-strong border border-white/20 flex items-center justify-center shadow-lg"
                                        >
                                            <Heart className={`w-3.5 h-3.5 ${isInWishlist(service.id) ? "fill-primary text-primary" : "text-white"}`} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <div className="flex items-center gap-0.5 bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-lg text-[9px] font-bold border border-green-500/20">
                                                <Star className="w-2.5 h-2.5 fill-green-600" />
                                                {service.rating}
                                            </div>
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">• {service.reviews} Reviews</span>
                                        </div>
                                        <h3 className="text-sm font-bold leading-snug line-clamp-2">{service.name}</h3>
                                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{service.description}</p>
                                    </div>

                                    <div className="flex items-center justify-between mt-auto pt-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-base font-black text-primary">₹{service.price}</span>
                                            {service.originalPrice && (
                                                <span className="text-[10px] text-muted-foreground line-through opacity-60 font-bold">₹{service.originalPrice}</span>
                                            )}
                                        </div>
                                        <Button
                                            onClick={(e) => { e.stopPropagation(); if (!isLoggedIn) setIsLoginModalOpen(true); else addToCart(service); }}
                                            className={`h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm ${(() => {
                                                const inCart = cartItems.find(item => item.id === service.id);
                                                return inCart ? 'bg-primary text-white border-2 border-primary hover:bg-primary/90' : 'bg-white text-primary border-2 border-primary/20 hover:bg-primary hover:text-white';
                                            })()}`}
                                        >
                                            {(() => {
                                                const inCart = cartItems.find(item => item.id === service.id);
                                                return inCart ? `${inCart.quantity} Added` : 'Add';
                                            })()}
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </main>
            </div>

            <FilterModal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} />
        </div >
    );
};

export default ExplorePage;
