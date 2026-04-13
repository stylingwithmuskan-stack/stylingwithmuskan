import React, { createContext, useContext, useState, useEffect } from "react";
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
        (async () => {
            try {
                const response = await api.content.init();
                if (cancelled) return;
                
                const data = response.data || {};
                
                setServiceTypes(data.serviceTypes || []);
                setBookingTypeConfig(data.bookingTypeConfig || []);
                setCategories(data.categories || []);
                setServices(data.services || []);
                setBanners(data.banners || { women: [], men: [] });
                setProviders(data.providers || []);
                if (data.officeSettings) setOfficeSettings(data.officeSettings);
                setSpotlights(data.spotlights || []);
                setGallery(data.gallery || []);
                setTestimonials(data.testimonials || []);
            } catch (e) {
                setServiceTypes(FALLBACK_SERVICE_TYPES);
                setBookingTypeConfig(FALLBACK_BOOKING_TYPES);
                setCategories(FALLBACK_CATEGORIES);
                setServices(FALLBACK_SERVICES);
                setBanners(FALLBACK_BANNERS);
                setProviders(FALLBACK_PROVIDERS);
                setSpotlights(initialSpotlights);
                setGallery(initialGallery);
                setTestimonials(initialTestimonials);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

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

    const value = {
        serviceTypes,
        bookingTypeConfig,
        categories,
        services,
        banners,
        providers,
        officeSettings,
        setOfficeSettings,
        updateOfficeSettings,
        spotlights,
        gallery,
        testimonials,
        isLoading,
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
