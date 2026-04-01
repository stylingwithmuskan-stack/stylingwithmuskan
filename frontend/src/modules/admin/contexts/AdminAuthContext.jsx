import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/modules/user/lib/api";
import { ensurePushRegistration } from "@/modules/user/lib/firebasePush";

export const AdminAuthContext = createContext(null);

export const useAdminAuth = () => {
    const context = useContext(AdminAuthContext);
    if (context === null) {
        // Return a dummy object if context is missing to avoid immediate crash,
        // but this shouldn't happen if structure is correct.
        console.warn("useAdminAuth must be used within AdminAuthProvider");
        return { admin: null, isLoggedIn: false, login: () => {}, logout: () => {} };
    }
    return context;
};

const ADMIN_KEY = "swm_admin";

export const AdminAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);

    const isLoggedIn = !!admin;

    useEffect(() => {
        try {
            const raw = localStorage.getItem(ADMIN_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                if (saved && typeof saved === "object") setAdmin(saved);
            }
        } catch {}
    }, []);

    useEffect(() => {
        const handle401 = (e) => {
            if (e.detail?.status === 401 && e.detail?.isAdminPath) {
                logout();
            }
        };
        window.addEventListener("swm-api-401", handle401);
        return () => window.removeEventListener("swm-api-401", handle401);
    }, []);

    const login = async (email, password) => {
        try {
            const { admin, adminToken } = await api.admin.login(email, password);
            if (adminToken) {
                try { localStorage.setItem("swm_admin_token", adminToken); } catch {}
            }
            setAdmin(admin);
            try { localStorage.setItem(ADMIN_KEY, JSON.stringify(admin)); } catch {}
            ensurePushRegistration("admin").catch(() => {});
            return { success: true };
        } catch (e) {
            const msg = e?.message || "Login failed";
            return { success: false, error: msg };
        }
    };

    const logout = () => {
        setAdmin(null);
        try { 
            localStorage.removeItem(ADMIN_KEY);
            localStorage.removeItem("swm_admin_token");
        } catch {}
        api.admin.logout();
    };

    // ───── VENDORS ─────
    const getAllVendors = async () => (await api.admin.vendors()).vendors;
    const updateVendorStatus = async (vendorId, status) => { await api.admin.updateVendorStatus(vendorId, status); };
    const approveVendorZones = async (vendorId) => { await api.admin.approveVendorZones(vendorId); };
    const rejectVendorZones = async (vendorId) => { await api.admin.rejectVendorZones(vendorId); };

    // ───── CUSTOMERS ─────
    const getAllCustomers = async () => (await api.admin.customers()).customers;

    // ───── SERVICE PROVIDERS ─────
    const getAllServiceProviders = async () => (await api.admin.providers()).providers;
    const updateSPStatus = async (id, status) => { await api.admin.updateProviderStatus(id, status); };

    // ───── ENQUIRIES (server) ─────
    const getEnquiries = async () => (await api.admin.customEnquiries()).enquiries;
    const priceQuoteEnquiry = async (id, payload) => { await api.admin.customEnquiryPriceQuote(id, payload); };
    const finalApproveEnquiry = async (id) => { await api.admin.customEnquiryFinalApprove(id); };

    // ───── BOOKINGS ─────
    const getAllBookings = async () => (await api.admin.bookings()).bookings;
    const getUserBookings = async () => (await api.admin.bookings()).bookings;
    const assignSPToBooking = async (bookingId, spId) => { await api.admin.assignBooking(bookingId, spId); };

    const assignTeamToBooking = async (bookingId, payload) => {
        // This handles customized bookings through various stages via API
        const st = String(payload?.status || "").toLowerCase();
        if (st === "admin_approved") {
            await api.admin.customEnquiryPriceQuote(bookingId, {
                totalAmount: Number(payload.price) || 0,
                discountPrice: Number(payload.discountPrice) || 0,
                notes: "",
            });
            return;
        }
        if (st === "final_approved") {
            await api.admin.customEnquiryFinalApprove(bookingId);
            return;
        }
        throw new Error("Unsupported admin action for custom enquiry");
    };

    // ───── COUPONS ─────
    const getCoupons = async () => (await api.admin.coupons()).coupons;
    const addCoupon = async (coupon) => { await api.admin.addCoupon(coupon); };
    const deleteCoupon = async (id) => { await api.admin.deleteCoupon(id); };

    // ───── BANNERS ─────
    const getBanners = async () => {
        // Admin should see all banners (including scheduled/future). /content/banners is active-only.
        const res = await api.admin.bannersList();
        const items = res?.banners || [];
        const toDate = (v) => {
            try {
                if (!v) return "";
                const d = new Date(v);
                if (isNaN(d.getTime())) return "";
                return d.toISOString().slice(0, 10);
            } catch { return ""; }
        };
        return (items || []).map((b) => ({
            id: b.id,
            gender: b.gender || "women",
            title: b.title,
            imageUrl: b.image,
            linkTo: b.linkTo || "",
            priority: b.priority || 1,
            startDate: toDate(b.startAt),
            endDate: toDate(b.endAt),
        }));
    };
    const addBanner = async (banner) => {
        const toStartAt = (dateStr) => {
            if (!dateStr) return null;
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? null : d.toISOString();
        };
        const toEndAt = (dateStr) => {
            if (!dateStr) return null;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return null;
            d.setHours(23, 59, 59, 999);
            return d.toISOString();
        };
        const payload = {
            id: Date.now(),
            gender: "women",
            title: banner.title,
            subtitle: "Exclusive deals for you",
            gradient: "from-indigo-600/50 to-purple-600/50",
            image: banner.imageUrl || "",
            cta: "Book Now",
            linkTo: banner.linkTo || "",
            priority: Number(banner.priority || 1),
            startAt: toStartAt(banner.startDate),
            endAt: toEndAt(banner.endDate),
        };
        await api.admin.addBanner(payload);
    };
    const deleteBanner = async (id) => {
        // Try removing from both genders to be safe
        try { await api.admin.deleteBanner(id, "women"); } catch {}
        try { await api.admin.deleteBanner(id, "men"); } catch {}
    };

    // ───── REFERRAL ─────
    const getReferralSettings = async () => (await api.admin.getReferral()).settings;
    const updateReferralSettings = async (settings) => { await api.admin.updateReferral(settings); };

    // ───── SOS ─────
    const getSOSAlerts = async () => (await api.admin.sos()).alerts;
    const resolveSOSAlert = async (id) => { await api.admin.resolveSos(id); };

    // ───── COMMISSION ─────
    const getCommissionSettings = async () => (await api.admin.getCommission()).settings;
    const updateCommissionSettings = async (settings) => { await api.admin.updateCommission(settings); };

    // ───── METRICS ─────
    const getMetricsOverview = async (params = {}) => (await api.admin.metricsOverview(params)).overview;
    const getRevenueByMonth = async (params = {}) => (await api.admin.metricsRevenueByMonth(params)).series;
    const getCustomersByMonth = async (params = {}) => (await api.admin.metricsCustomersByMonth(params)).series;
    const getProvidersByMonth = async (params = {}) => (await api.admin.metricsProvidersByMonth(params)).series;
    const getBookingTrend = async (params = {}) => (await api.admin.metricsBookingTrend(params)).series;
    const getMetricsCities = async () => (await api.admin.metricsCities()).cities;

    // ───── PAYOUTS ─────
    const getPayouts = async (params = {}) => (await api.admin.getPayouts(params)).payouts;
    const updatePayoutStatus = async (id, status) => { await api.admin.updatePayoutStatus(id, status); };

    // ───── PERFORMANCE CRITERIA ─────
    const getPerformanceCriteria = async () => (await api.admin.getPerformanceCriteria()).settings;
    const updatePerformanceCriteria = async (settings) => { await api.admin.updatePerformanceCriteria(settings); };
    const getSubscriptionSettings = async () => (await api.admin.getSubscriptionSettings()).settings;
    const updateSubscriptionSettings = async (settings) => (await api.admin.updateSubscriptionSettings(settings)).settings;
    const getSubscriptionPlans = async () => (await api.admin.listSubscriptionPlans()).plans;
    const createSubscriptionPlan = async (body) => (await api.admin.createSubscriptionPlan(body)).plan;
    const updateSubscriptionPlan = async (planId, body) => (await api.admin.updateSubscriptionPlan(planId, body)).plan;
    const deleteSubscriptionPlan = async (planId) => (await api.admin.deleteSubscriptionPlan(planId));
    const getSubscriptionReport = async () => (await api.admin.getSubscriptionReport()).report;
    const pushBroadcast = async (payload) => (await api.admin.pushBroadcast(payload)).broadcast;
    const getPushBroadcastHistory = async () => (await api.admin.pushBroadcastHistory()).broadcasts || [];
    const sendPushTest = async (payload = {}) => (await api.admin.pushTest(payload));

    // ───── FEEDBACK ─────
    const getFeedback = async (params = {}) => (await api.admin.listFeedback(params)).feedback;
    const getFeedbackStats = async () => (await api.admin.getFeedbackStats()).stats;
    const deleteFeedback = async (id) => { await api.admin.deleteFeedback(id); };
    const updateFeedbackStatus = async (id, status) => { await api.admin.updateFeedbackStatus(id, status); };

    // ───── CUSTOMER COD MANAGEMENT ─────
    const toggleCustomerCOD = async (userId, codDisabled) => { await api.admin.toggleCustomerCOD(userId, codDisabled); };
    const updateCustomerStatus = async (userId, status) => { await api.admin.updateCustomerStatus(userId, status); };

    return (
        <AdminAuthContext.Provider value={{
            admin, isLoggedIn, login, logout,
            getAllVendors, updateVendorStatus,
            approveVendorZones, rejectVendorZones,
            getAllCustomers,
            getAllServiceProviders, updateSPStatus,
            getEnquiries, priceQuoteEnquiry, finalApproveEnquiry,
            getAllBookings, getUserBookings, assignSPToBooking, assignTeamToBooking,
            getCoupons, addCoupon, deleteCoupon,
            getBanners, addBanner, deleteBanner,
            getReferralSettings, updateReferralSettings,
            getSOSAlerts, resolveSOSAlert,
            getCommissionSettings, updateCommissionSettings,
            getMetricsOverview, getRevenueByMonth, getCustomersByMonth, getProvidersByMonth, getBookingTrend, getMetricsCities,
            getPayouts, updatePayoutStatus,
            getPerformanceCriteria, updatePerformanceCriteria,
            getSubscriptionSettings, updateSubscriptionSettings, getSubscriptionPlans, createSubscriptionPlan, updateSubscriptionPlan, getSubscriptionReport,
            deleteSubscriptionPlan,
            pushBroadcast, getPushBroadcastHistory, sendPushTest,
            getFeedback, getFeedbackStats, deleteFeedback, updateFeedbackStatus,
            toggleCustomerCOD, updateCustomerStatus,
        }}>
            {children}
        </AdminAuthContext.Provider>
    );
};
