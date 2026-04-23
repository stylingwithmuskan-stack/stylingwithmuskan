import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { api } from "@/modules/user/lib/api";
import { isContentAvailable } from "@/modules/user/lib/contentAvailability";
import {
    SERVICE_TYPES as FALLBACK_SERVICE_TYPES,
    BOOKING_TYPE_CONFIG as FALLBACK_BOOKING_TYPES,
    categories as FALLBACK_CATEGORIES,
    services as FALLBACK_SERVICES,
    banners as FALLBACK_BANNERS,
    mockProviders as FALLBACK_PROVIDERS,
    initialSpotlights,
    initialGallery,
    initialTestimonials
} from "@/modules/user/data/services";

const UserModuleDataContext = createContext(null);

export const UserModuleDataProvider = ({ children }) => {
    const [serviceTypes, setServiceTypes] = useState([]);
    const [bookingTypeConfig, setBookingTypeConfig] = useState([]);
    const [categories, setCategories] = useState([]);
    const [services, setServices] = useState([]);
    const [popularServices, setPopularServices] = useState([]);
    const [loadedCategories, setLoadedCategories] = useState(new Set());
    const [banners, setBanners] = useState({ women: [], men: [] });
    const [providers, setProviders] = useState([]);
    const [officeSettings, setOfficeSettings] = useState({ startTime: "09:00", endTime: "21:00", autoAssign: true, notificationMessage: "Our pros are sleeping. Service starts at 9:00 AM" });
    const [isLoading, setIsLoading] = useState(true);

    // Site Content States (server-backed; fallback only if API fails)
    const [spotlights, setSpotlights] = useState([]);
    const [gallery, setGallery] = useState([]);
    const [testimonials, setTestimonials] = useState([]);

    useEffect(() => {
        let cancelled = false;
        
        const loadHomePageData = async () => {
            try {
                // Phase 1: Critical UI Data - Fetch specifically what's needed for the Home Page viewport
                // We fetch these in parallel to maximize speed.
                const [typesRes, catsRes, bannersRes, settingsRes] = await Promise.all([
                    api.content.serviceTypes(),
                    api.content.categories(),
                    api.content.banners(),
                    api.content.officeSettings()
                ]);
                
                if (cancelled) return;
                
                const normalize = (items) => (items || []).map(item => ({ ...item, id: item.id || item._id }));

                // Apply critical data immediately
                if (typesRes.data) setServiceTypes(normalize(typesRes.data));
                if (catsRes.data) setCategories(normalize(catsRes.data));
                if (bannersRes.data) setBanners(bannersRes.data);
                if (settingsRes.data) setOfficeSettings(settingsRes.data);

                // 🔥 Trigger Phase 2: Background Loading for non-critical/below-fold content
                (async () => {
                   try {
                       const initRes = await api.content.init();
                       if (cancelled) return;
                       const d = initRes.data || {};
                       setBookingTypeConfig(d.bookingTypeConfig || []);
                       setPopularServices(normalize(d.popularServices));
                       setServices(prev => {
                           const pop = normalize(d.popularServices);
                           const existingIds = new Set(prev.map(s => s.id));
                           const uniquePop = pop.filter(s => !existingIds.has(s.id));
                           return [...prev, ...uniquePop];
                       });
                       setSpotlights(normalize(d.spotlights));
                       setGallery(normalize(d.gallery));
                       setTestimonials(normalize(d.testimonials));
                       setProviders(d.providers || []);
                   } catch {}
                })();

                setIsLoading(false); // Enable Home Page rendering
            } catch (e) {
                console.error("Critical content load failed:", e);
                // Fallback to full init if individual calls fail
                try {
                    const res = await api.content.init();
                    if (cancelled) return;
                    const d = res.data || {};
                    const normalize = (items) => (items || []).map(item => ({ ...item, id: item.id || item._id }));
                    setServiceTypes(normalize(d.serviceTypes));
                    setCategories(normalize(d.categories));
                    setBanners(d.banners);
                    setPopularServices(normalize(d.popularServices));
                    setServices(prev => {
                        const pop = normalize(d.popularServices);
                        const existingIds = new Set(prev.map(s => s.id));
                        const uniquePop = pop.filter(s => !existingIds.has(s.id));
                        return [...prev, ...uniquePop];
                    });
                    setIsLoading(false);
                } catch {
                     setServiceTypes(FALLBACK_SERVICE_TYPES);
                     setCategories(FALLBACK_CATEGORIES);
                     setIsLoading(false);
                }
            }
        };

        loadHomePageData();
        return () => { cancelled = true; };
    }, []);

    // Track in-flight requests to avoid duplicates and handle concurrent calls
    const [pendingCategories, setPendingCategories] = useState(new Set());
    const activeRequests = useRef(new Map());

    const loadCategoryServices = async (categoryId) => {
        if (!categoryId || loadedCategories.has(categoryId)) return;

        // If a request is already in flight, return that promise
        if (activeRequests.current.has(categoryId)) {
            return activeRequests.current.get(categoryId);
        }

        const requestPromise = (async () => {
            setPendingCategories(prev => new Set(prev).add(categoryId));
            try {
                const res = await api.content.services({ category: categoryId });
                const rawServices = res.data || [];
                const newServices = rawServices.map(s => ({ ...s, id: s.id || s._id }));
                
                setServices(prev => {
                    const existingIds = new Set(prev.map(s => s.id));
                    const uniqueNew = newServices.filter(s => !existingIds.has(s.id));
                    return [...prev, ...uniqueNew];
                });
                setLoadedCategories(prev => new Set(prev).add(categoryId));
            } catch (e) {
                console.error("Failed to load category services:", e);
            } finally {
                setPendingCategories(prev => {
                    const next = new Set(prev);
                    next.delete(categoryId);
                    return next;
                });
                activeRequests.current.delete(categoryId);
            }
        })();

        activeRequests.current.set(categoryId, requestPromise);
        return requestPromise;
    };

    const searchServices = async (query) => {
        if (!query || query.length < 2) return [];
        try {
            const res = await api.content.search({ q: query });
            return res.data || [];
        } catch (e) {
            console.error("Search failed:", e);
            return [];
        }
    };

    // CRUD operations
    const addCategory = (category) => setCategories(prev => [...prev, category]);
    const updateCategory = (id, updated) => setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
    const deleteCategory = (id) => setCategories(prev => prev.filter(c => c.id !== id));

    const addService = (service) => setServices(prev => [...prev, service]);
    const updateService = (id, updated) => setServices(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
    const deleteService = (id) => setServices(prev => prev.filter(s => s.id !== id));

    const addBanner = (gender, banner) => setBanners(prev => ({
        ...prev,
        [gender]: [...(prev[gender] || []), banner]
    }));
    const updateBanner = (gender, id, updated) => setBanners(prev => ({
        ...prev,
        [gender]: prev[gender].map(b => b.id === id ? { ...b, ...updated } : b)
    }));
    const deleteBanner = (gender, id) => setBanners(prev => ({
        ...prev,
        [gender]: prev[gender].filter(b => b.id !== id)
    }));

    // For Service Types
    const addServiceType = (type) => setServiceTypes(prev => [...prev, type]);
    const updateServiceType = (id, updated) => setServiceTypes(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
    const deleteServiceType = (id) => setServiceTypes(prev => prev.filter(t => t.id !== id));

    // Site Content CRUD
    const addSpotlight = (item) => setSpotlights(prev => [...prev, item]);
    const updateSpotlight = (id, updated) => setSpotlights(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
    const deleteSpotlight = (id) => setSpotlights(prev => prev.filter(s => s.id !== id));

    const addGallery = (item) => setGallery(prev => [...prev, item]);
    const updateGallery = (id, updated) => setGallery(prev => prev.map(g => g.id === id ? { ...g, ...updated } : g));
    const deleteGallery = (id) => setGallery(prev => prev.filter(g => g.id !== id));

    const addTestimonial = (item) => setTestimonials(prev => [...prev, item]);
    const updateTestimonial = (id, updated) => setTestimonials(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
    const deleteTestimonial = (id) => setTestimonials(prev => prev.filter(t => t.id !== id));

    const updateOfficeSettings = async (settings) => {
        try {
            const res = await api.admin.updateOfficeSettings(settings);
            if (res.settings) {
                setOfficeSettings(res.settings);
                return true;
            }
        } catch (e) {
            console.error("Failed to update office settings:", e);
            throw e;
        }
        return false;
    };

    // 🔥 Sequential Background Pre-fetcher for Instant Navigation
    // Once the app is ready, we slowly load all other category services in the background
    // so that when the user clicks, the data is already available.
    useEffect(() => {
        if (!isLoading && categories.length > 0) {
            const timer = setTimeout(() => {
                categories.forEach(cat => {
                    loadCategoryServices(cat.id).catch(() => {});
                });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isLoading, categories, loadCategoryServices]);

    const value = {
        serviceTypes,
        bookingTypeConfig,
        categories,
        services,
        setServices,
        banners,
        providers,
        officeSettings,
        setOfficeSettings,
        updateOfficeSettings,
        spotlights,
        popularServices,
        gallery,
        testimonials,
        isLoading,
        loadCategoryServices,
        loadedCategories,
        searchServices,
        // Category actions
        addCategory,
        updateCategory,
        deleteCategory,
        // Service actions
        addService,
        updateService,
        deleteService,
        // Banner actions
        addBanner,
        updateBanner,
        deleteBanner,
        // Service Types actions
        addServiceType,
        updateServiceType,
        deleteServiceType,
        // Site Content actions
        addSpotlight,
        updateSpotlight,
        deleteSpotlight,
        addGallery,
        updateGallery,
        deleteGallery,
        addTestimonial,
        updateTestimonial,
        deleteTestimonial,
        // Booking Type Config actions
        updateBookingTypeConfig: (updatedConfig) => setBookingTypeConfig(updatedConfig),
        checkAvailability: (item, location, selectedDate = null, selectedTime = null) =>
            isContentAvailable(item, location, selectedDate, selectedTime, {
                categories,
                serviceTypes,
            })
    };

    return (
        <UserModuleDataContext.Provider value={value}>
            {children}
        </UserModuleDataContext.Provider>
    );
};

export const useUserModuleData = () => {
    const context = useContext(UserModuleDataContext);
    if (!context) {
        throw new Error("useUserModuleData must be used within a UserModuleDataProvider");
    }
    return context;
};
