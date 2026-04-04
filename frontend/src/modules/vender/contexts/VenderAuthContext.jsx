import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/modules/user/lib/api";

export const VenderAuthContext = createContext(undefined);

export const useVenderAuth = () => {
    const context = useContext(VenderAuthContext);
    if (!context) throw new Error("useVenderAuth must be used within VenderAuthProvider");
    return context;
};

const STORAGE_KEY = "swm_vendor";

export const VenderAuthProvider = ({ children }) => {
    const [vendor, setVendor] = useState(null);
    const [hydrated, setHydrated] = useState(false);
    const syncVendor = (nextVendor) => {
        setVendor(nextVendor);
        try {
            if (nextVendor) localStorage.setItem(STORAGE_KEY, JSON.stringify(nextVendor));
            else localStorage.removeItem(STORAGE_KEY);
        } catch {}
    };

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setVendor(JSON.parse(raw));
        } catch {}
        setHydrated(true);
    }, []);

    useEffect(() => {
        const handle401 = (e) => {
            if (e.detail?.status === 401 && e.detail?.isVendorPath) {
                logout();
            }
        };
        window.addEventListener("swm-api-401", handle401);
        return () => window.removeEventListener("swm-api-401", handle401);
    }, []);

    const isLoggedIn = !!vendor;
    const isApproved = vendor?.status === "approved";

    const login = async (email, password) => {
        try {
            const { vendor, vendorToken } = await api.vendor.login(email, password);
            
            // Only save if we got valid vendor data back
            if (vendor && vendor._id) {
                if (vendorToken) {
                    try { localStorage.setItem("swm_vendor_token", vendorToken); } catch {}
                }
                syncVendor(vendor);
                
                if (vendor?.status !== "approved") {
                    return { success: true, redirect: "/vender/status" };
                }
                return { success: true, redirect: "/vender/dashboard" };
            } else {
                throw new Error("Login failed - no vendor data received");
            }
        } catch (error) {
            // Clear any stale data on error
            logout();
            throw error;
        }
    };

    const requestOtp = async (phone) => {
        return await api.vendor.requestOtp(phone);
    };
    const verifyOtp = async (phone, otp) => {
        try {
            const { vendor, vendorToken } = await api.vendor.verifyOtp(phone, otp);
            
            // Only save if we got valid vendor data back
            if (vendor && vendor._id) {
                if (vendorToken) {
                    try { localStorage.setItem("swm_vendor_token", vendorToken); } catch {}
                }
                syncVendor(vendor);
                
                if (vendor?.status !== "approved") {
                    return { success: true, redirect: "/vender/status" };
                }
                return { success: true, redirect: "/vender/dashboard" };
            } else {
                throw new Error("OTP verification failed - no vendor data received");
            }
        } catch (error) {
            // Clear any stale data on error
            logout();
            throw error;
        }
    };

    const register = async (data) => {
        try {
            const { vendor, vendorToken } = await api.vendor.register(data);
            
            // Only save if we got valid vendor data back
            if (vendor && vendor._id) {
                if (vendorToken) {
                    try { localStorage.setItem("swm_vendor_token", vendorToken); } catch {}
                }
                syncVendor(vendor);
                return { success: true };
            } else {
                throw new Error("Registration failed - no vendor data received");
            }
        } catch (error) {
            // Clear any stale data on error
            logout();
            throw error;
        }
    };

    const registerRequest = async (phone) => {
        return await api.vendor.registerRequest(phone);
    };

    const verifyRegistrationOtp = async (payload) => {
        try {
            const res = await api.vendor.verifyRegistrationOtp(payload);
            
            // Only save to localStorage if API call was successful
            if (res?.success && res?.vendor) {
                if (res.vendorToken) {
                    try { localStorage.setItem("swm_vendor_token", res.vendorToken); } catch {}
                }
                syncVendor(res.vendor);
            } else {
                // If no vendor in response, clear any stale data
                logout();
                throw new Error(res?.message || "Registration failed");
            }
            
            return res;
        } catch (error) {
            // On error, clear any cached data
            logout();
            throw error;
        }
    };

    const logout = () => {
        setVendor(null);
        try { 
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem("swm_vendor_token");
        } catch {}
        api.vendor.logout();
    };

    // Get all SPs in vendor's city
    const getServiceProviders = async () => (await api.vendor.providers()).providers || [];
    const getCityVendors = async () => (await api.vendor.vendors()).vendors || [];

    // Approve / Reject / Block / Suspend SP
    const updateSPStatus = async (id, status) => { await api.vendor.updateSPStatus(id, status); };

    const approveSPZones = async (id) => { await api.vendor.approveSPZones(id); };
    const rejectSPZones = async (id) => { await api.vendor.rejectSPZones(id); };

    // Get all bookings
    const getAllBookings = async () => (await api.vendor.bookings()).bookings || [];

    // Assign SP to a booking
    const assignSPToBooking = async (bookingId, spId) => { await api.vendor.assignBooking(bookingId, spId); };

    const reassignBooking = async (bookingId, spId) => { await api.vendor.reassignBooking(bookingId, spId); };
    const expireBooking = async (bookingId) => { await api.vendor.expireBooking(bookingId); };

    const getCustomEnquiries = async () => (await api.vendor.customEnquiries()).enquiries || [];

    // For customized enquiries: vendor sets quote then assigns team.
    const assignTeamToBooking = async (bookingId, payload) => {
        const st = String(payload?.status || "").toLowerCase();
        if (st === "quote_submitted" || st === "vendor_assigned") {
            await api.vendor.customEnquiryPriceQuote(bookingId, {
                totalAmount: Number(payload.price) || 0,
                discountPrice: Number(payload.discountPrice) || 0,
                prebookAmount: Number(payload.prebookAmount) || 0,
                totalServiceTime: payload.totalServiceTime || "",
                quoteExpiryHours: Number(payload.quoteExpiryHours) || 12,
                notes: "",
            });
            return;
        }
        if (st === "assign_team" || st === "team_assigned") {
            await api.vendor.customEnquiryAssignTeam(bookingId, {
                maintainerProvider: payload.maintainerProvider,
                teamMembers: payload.teamMembers || [],
            });
            return;
        }
        throw new Error("Unsupported action");
    };

    // Get SOS alerts
    const getSOSAlerts = async () => (await api.vendor.sos()).alerts || [];

    // Resolve SOS
    const resolveSOSAlert = async (alertId) => { await api.vendor.resolveSos(alertId); };

    // Update Payout Status for a Booking (SP payout)
    const updatePayoutStatus = async (bookingId, status) => {
        await api.vendor.updatePayoutStatus(bookingId, status);
    };

    const getStats = async () => (await api.vendor.stats()).stats || {};

    const requestZones = async (zones) => {
        return await api.vendor.requestZones({ zones });
    };

    const getProviderRankings = async (city) => await api.vendor.getProviderRankings(city);

    const refreshVendor = async () => {
        const { vendor: latest } = await api.vendor.me();
        if (latest) syncVendor(latest);
        return latest || null;
    };

    return (
        <VenderAuthContext.Provider value={{
            vendor,
            setVendor: syncVendor,
            hydrated,
            isLoggedIn,
            isApproved,
            login,
            requestOtp,
            verifyOtp,
            register,
            registerRequest,
            verifyRegistrationOtp,
            logout,
            getServiceProviders,
            getCityVendors,
            updateSPStatus,
            approveSPZones,
            rejectSPZones,
            getAllBookings,
            assignSPToBooking,
            reassignBooking,
            expireBooking,
            assignTeamToBooking,
            getCustomEnquiries,
            getSOSAlerts,
            resolveSOSAlert,
            updatePayoutStatus,
            getStats,
            requestZones,
            getProviderRankings,
            refreshVendor,
        }}>
            {children}
        </VenderAuthContext.Provider>
    );
};
