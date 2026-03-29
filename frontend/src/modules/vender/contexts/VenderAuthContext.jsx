import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/modules/user/lib/api";
import { revokePushRegistration } from "@/modules/user/lib/firebasePush";

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
        const { vendor, vendorToken } = await api.vendor.login(email, password);
        if (vendorToken) {
            try { localStorage.setItem("swm_vendor_token", vendorToken); } catch {}
        }
        syncVendor(vendor);
        
        if (vendor?.status !== "approved") {
            return { success: true, redirect: "/vender/status" };
        }
        return { success: true, redirect: "/vender/dashboard" };
    };

    const requestOtp = async (phone) => {
        return await api.vendor.requestOtp(phone);
    };
    const verifyOtp = async (phone, otp) => {
        const { vendor, vendorToken } = await api.vendor.verifyOtp(phone, otp);
        if (vendorToken) {
            try { localStorage.setItem("swm_vendor_token", vendorToken); } catch {}
        }
        syncVendor(vendor);
        
        if (vendor?.status !== "approved") {
            return { success: true, redirect: "/vender/status" };
        }
        return { success: true, redirect: "/vender/dashboard" };
    };

    const register = async (data) => {
        const { vendor, vendorToken } = await api.vendor.register(data);
        if (vendorToken) {
            try { localStorage.setItem("swm_vendor_token", vendorToken); } catch {}
        }
        syncVendor(vendor);
        return { success: true };
    };

    const registerRequest = async (phone) => {
        return await api.vendor.registerRequest(phone);
    };

    const verifyRegistrationOtp = async (payload) => {
        return await api.vendor.verifyRegistrationOtp(payload);
    };

    const logout = () => {
        revokePushRegistration("vendor").catch(() => {});
        setVendor(null);
        try { 
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem("swm_vendor_token");
        } catch {}
        api.vendor.logout();
    };

    // Get all SPs in vendor's city
    const getServiceProviders = async () => (await api.vendor.providers()).providers || [];

    // Approve / Reject / Block / Suspend SP
    const updateSPStatus = async (id, status) => { await api.vendor.updateProviderStatus(id, status); };

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

    const getProviderRankings = async (city) => await api.vendor.getProviderRankings(city);

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
            updateSPStatus,
            getAllBookings,
            assignSPToBooking,
            reassignBooking,
            expireBooking,
            assignTeamToBooking,
            getCustomEnquiries,
            getSOSAlerts,
            resolveSOSAlert,
            updatePayoutStatus,
            getProviderRankings,
        }}>
            {children}
        </VenderAuthContext.Provider>
    );
};
