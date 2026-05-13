import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/modules/user/lib/api";
import { safeStorage } from "@/modules/user/lib/safeStorage";

export const VenderAuthContext = createContext(undefined);

export const useVenderAuth = () => {
    const context = useContext(VenderAuthContext);
    if (!context) throw new Error("useVenderAuth must be used within VenderAuthProvider");
    return context;
};

const STORAGE_KEY = "swm_vendor";
const TOKEN_KEY = "swm_vendor_token";

export const VenderAuthProvider = ({ children }) => {
    const [vendor, setVendorState] = useState(() => {
        try {
            const sessionRaw = sessionStorage.getItem(STORAGE_KEY);
            if (sessionRaw) return JSON.parse(sessionRaw);
            const localRaw = safeStorage.getItem(STORAGE_KEY);
            if (localRaw) {
                const parsed = JSON.parse(localRaw);
                sessionStorage.setItem(STORAGE_KEY, localRaw);
                return parsed;
            }
            return null;
        } catch { return null; }
    });
    const setVendor = (v) => {
        setVendorState(v);
        try {
            if (v) {
                const raw = JSON.stringify(v);
                sessionStorage.setItem(STORAGE_KEY, raw);
                safeStorage.setItem(STORAGE_KEY, raw);
            } else {
                sessionStorage.removeItem(STORAGE_KEY);
                safeStorage.removeItem(STORAGE_KEY);
            }
        } catch {}
    };

    const [hydrated, setHydrated] = useState(false);
    const syncVendor = setVendor;

    useEffect(() => {
        // Initial state set in useState initializer
        setHydrated(true);
        refreshVendor().catch(err => {
            if (err?.status === 401) logout();
        });
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

    const [vendorToken, setVendorTokenState] = useState(() => {
        return sessionStorage.getItem(TOKEN_KEY) || safeStorage.getItem(TOKEN_KEY) || "";
    });
    const setVendorToken = (token) => {
        setVendorTokenState(token || "");
        try {
            if (token) {
                sessionStorage.setItem(TOKEN_KEY, token);
                safeStorage.setItem(TOKEN_KEY, token);
            } else {
                sessionStorage.removeItem(TOKEN_KEY);
                safeStorage.removeItem(TOKEN_KEY);
            }
        } catch {}
    };

    const isLoggedIn = !!vendor;
    const isApproved = vendor?.status === "approved";

    const login = async (email, password) => {
        try {
            const { vendor, vendorToken } = await api.vendor.login(email, password);
            
            // Only save if we got valid vendor data back
            if (vendor && (vendor._id || vendor.id)) {
                if (vendorToken) {
                    setVendorToken(vendorToken);
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
            if (vendor && (vendor._id || vendor.id)) {
                if (vendorToken) {
                    setVendorToken(vendorToken);
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
            if (vendor && (vendor._id || vendor.id)) {
                if (vendorToken) {
                    setVendorToken(vendorToken);
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
            const { vendor, vendorToken } = await api.vendor.verifyRegistrationOtp(payload);
            
            // Only save to localStorage if we got valid vendor data back
            if (vendor && (vendor._id || vendor.id)) {
                if (vendorToken) {
                    setVendorToken(vendorToken);
                }
                syncVendor(vendor);
                return { success: true, vendor, vendorToken };
            } else {
                // If no vendor in response, clear any stale data
                logout();
                throw new Error("Registration failed - no vendor data received");
            }
        } catch (error) {
            // On error, clear any cached data
            logout();
            throw error;
        }
    };

    const logout = () => {
        setVendor(null);
        setVendorToken("");
        try { 
            safeStorage.removeItem(STORAGE_KEY);
            safeStorage.removeItem(TOKEN_KEY);
        } catch {}
        api.vendor.logout();
    };

    // Get all SPs in vendor's city
    const getServiceProviders = async (params = {}) => {
        const response = await api.vendor.providers(params);
        if (Array.isArray(response)) {
            return { providers: response, total: response.length };
        }
        return { providers: response?.providers || [], page: response?.page, limit: response?.limit, total: response?.total || 0 };
    };
    const getCityVendors = async () => (await api.vendor.vendors()).vendors || [];

    // Approve / Reject / Block / Suspend SP
    const updateSPStatus = async (id, status) => { await api.vendor.updateSPStatus(id, status); };

    const approveSPZones = async (id) => { await api.vendor.approveSPZones(id); };
    const rejectSPZones = async (id) => { await api.vendor.rejectSPZones(id); };

    // Get all bookings
    const getAllBookings = async (params = {}) => {
        const response = await api.vendor.bookings(params);
        if (Array.isArray(response)) {
            return { bookings: response, total: response.length };
        }
        return { bookings: response?.bookings || [], page: response?.page, limit: response?.limit, total: response?.total || 0 };
    };

    // Get available providers for escalated booking
    const getAvailableProviders = async (bookingId) => (await api.vendor.getAvailableProviders(bookingId)).availableProviders || [];

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

    const deleteAccount = async () => {
        await api.vendor.deleteAccount();
        logout();
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
            deleteAccount,
            getServiceProviders,
            getCityVendors,
            updateSPStatus,
            approveSPZones,
            rejectSPZones,
            getAllBookings,
            getAvailableProviders,
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
            vendorToken,
            setVendorToken,
        }}>
            {children}
        </VenderAuthContext.Provider>
    );
};
