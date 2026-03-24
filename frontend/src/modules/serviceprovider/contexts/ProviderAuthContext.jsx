import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/modules/user/lib/api";

const ProviderAuthContext = createContext(undefined);

export const useProviderAuth = () => {
    const context = useContext(ProviderAuthContext);
    if (!context) throw new Error("useProviderAuth must be used within ProviderAuthProvider");
    return context;
};

const STORAGE_KEY = "swm_provider";
const TOKEN_KEY = "swm_provider_token";

export const ProviderAuthProvider = ({ children }) => {
    const [provider, setProviderState] = useState(null);
    const [hydrated, setHydrated] = useState(false);
    const setProvider = (p) => {
        setProviderState(p);
        try {
            if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
            else localStorage.removeItem(STORAGE_KEY);
        } catch {}
    };
    const setProviderToken = (token) => {
        try {
            if (token) localStorage.setItem(TOKEN_KEY, token);
            else localStorage.removeItem(TOKEN_KEY);
        } catch {}
    };
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const p = JSON.parse(raw);
                setProviderState(p);
            }
        } catch {}
        setHydrated(true);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const phone = provider?.phone || "";
                if (phone) {
                    const { provider: rec } = await api.provider.me(phone);
                    if (!cancelled && rec) {
                        // Check if status changed or data needs update
                        const hasChanged = JSON.stringify(rec) !== JSON.stringify(provider);
                        if (hasChanged) {
                            setProvider(rec);
                        }
                    }
                }
            } catch {}
        })();
        return () => { cancelled = true; };
    }, [provider?.phone, provider?.approvalStatus]);

    const isLoggedIn = !!provider;
    const isApproved = provider?.approvalStatus === "approved";
    const isPending = provider?.approvalStatus === "pending";
    const isRejected = provider?.approvalStatus === "rejected";
    const isRegistered = provider?.registrationComplete === true;

    const register = async (data) => {
        const payload = { ...data };
        if (!payload.phone && provider?.phone) payload.phone = provider.phone;
        const safe = {
            phone: payload.phone,
            name: payload.name,
            email: payload.email,
            address: payload.address || [payload.addressLine1, payload.area].filter(Boolean).join(", ").trim(),
            city: payload.city,
            gender: payload.gender,
            dob: payload.dob,
            experience: payload.experience,
            profilePhoto: typeof payload.profilePhoto === "string" && !payload.profilePhoto?.startsWith("data:") ? payload.profilePhoto : "",
            aadharFront: typeof payload.aadharFront === "string" && !payload.aadharFront?.startsWith("data:") ? payload.aadharFront : "",
            aadharBack: typeof payload.aadharBack === "string" && !payload.aadharBack?.startsWith("data:") ? payload.aadharBack : "",
            panCard: typeof payload.panCard === "string" && !payload.panCard?.startsWith("data:") ? payload.panCard : "",
            primaryCategory: payload.primaryCategory,
            specializations: payload.specializations,
        };
        const { provider: regProvider } = await api.provider.register(safe);
        let nextProvider = regProvider;
        const hasFiles =
            payload.profilePhoto instanceof File ||
            payload.aadharFront instanceof File ||
            payload.aadharBack instanceof File ||
            payload.panCard instanceof File ||
            (typeof payload.profilePhoto === "string" && payload.profilePhoto.startsWith("data:")) ||
            (typeof payload.aadharFront === "string" && payload.aadharFront.startsWith("data:")) ||
            (typeof payload.aadharBack === "string" && payload.aadharBack.startsWith("data:")) ||
            (typeof payload.panCard === "string" && payload.panCard.startsWith("data:"));
        if (hasFiles && safe.phone) {
            const form = new FormData();
            form.append("phone", safe.phone);
            const toBlob = (dataUrl) => {
                try {
                    const arr = dataUrl.split(",");
                    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) u8arr[n] = bstr.charCodeAt(n);
                    return new Blob([u8arr], { type: mime });
                } catch { return null; }
            };
            const appendIf = (key, val) => {
                if (val instanceof File) form.append(key, val, val.name || `${key}.png`);
                else if (typeof val === "string" && val.startsWith("data:")) {
                    const blob = toBlob(val);
                    if (blob) form.append(key, blob, `${key}.png`);
                }
            };
            appendIf("profilePhoto", payload.profilePhoto);
            appendIf("aadharFront", payload.aadharFront);
            appendIf("aadharBack", payload.aadharBack);
            appendIf("panCard", payload.panCard);
            try {
                const { provider: upProvider } = await api.provider.uploadDocs(form);
                nextProvider = upProvider || nextProvider;
            } catch {}
        }
        setProvider(nextProvider);
    };

    const requestOtp = async (phone) => { await api.provider.requestOtp(phone); };
    const verifyOtp = async (phone, otp) => {
        const { provider, providerToken } = await api.provider.verifyOtp(phone, otp);
        setProvider(provider);
        if (providerToken) setProviderToken(providerToken);
        return { success: true, registered: provider.registrationComplete };
    };

    const logout = () => { setProvider(null); setProviderToken(""); api.provider.logout(); };

    const adminApprove = () => {
        setProvider(prev => ({ ...prev, approvalStatus: "approved" }));
    };

    const adminReject = () => {
        setProvider(prev => ({ ...prev, approvalStatus: "rejected" }));
    };

    const upgradeToPro = () => {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 Month duration for Pro

        const updatedProvider = { 
            ...provider, 
            isPro: true,
            proExpiry: expiresAt.toISOString(),
            proPlan: "monthly"
        };
        setProvider(updatedProvider);
    };

    return (
        <ProviderAuthContext.Provider value={{
            provider,
            hydrated,
            isLoggedIn,
            isApproved,
            isPending,
            isRejected,
            isRegistered,
            register,
            requestOtp,
            verifyOtp,
            logout,
            adminApprove,
            adminReject,
            upgradeToPro
        }}>
            {children}
        </ProviderAuthContext.Provider>
    );
};
