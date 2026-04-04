import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/modules/user/lib/api";

export const ProviderAuthContext = createContext(undefined);

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

    useEffect(() => {
        const handle401 = (e) => {
            if (e.detail?.status === 401 && e.detail?.isProviderPath) {
                logout();
            }
        };
        window.addEventListener("swm-api-401", handle401);
        return () => window.removeEventListener("swm-api-401", handle401);
    }, []);

    const isLoggedIn = !!provider;
    const isApproved = provider?.approvalStatus === "approved";
    const isPending = ["pending", "pending_vendor", "pending_admin"].includes(provider?.approvalStatus);
    const isRejected = provider?.approvalStatus === "rejected";
    const isRegistered = provider?.registrationComplete === true;

    const register = async (data) => {
        try {
            const payload = { ...data };
            if (!payload.phone && provider?.phone) payload.phone = provider.phone;
            const safe = {
                phone: payload.phone,
                name: payload.name,
                email: payload.email,
                address: payload.address || [payload.addressLine1, payload.area].filter(Boolean).join(", ").trim(),
                city: String(payload.city || "").trim(),
                zones: Array.isArray(payload.zones)
                    ? payload.zones
                    : (payload.zone ? [payload.zone] : []),
                gender: payload.gender,
                dob: payload.dob,
                experience: payload.experience,
                profilePhoto: typeof payload.profilePhoto === "string" && !payload.profilePhoto?.startsWith("data:") ? payload.profilePhoto : "",
                aadharFront: typeof payload.aadharFront === "string" && !payload.aadharFront?.startsWith("data:") ? payload.aadharFront : "",
                aadharBack: typeof payload.aadharBack === "string" && !payload.aadharBack?.startsWith("data:") ? payload.aadharBack : "",
                panCard: typeof payload.panCard === "string" && !payload.panCard?.startsWith("data:") ? payload.panCard : "",
                primaryCategory: payload.primaryCategory,
                specializations: payload.specializations,
                services: payload.services,
                bankName: payload.bankName,
                accountNumber: payload.accountNumber,
                ifscCode: payload.ifscCode,
                upiId: payload.upiId,
                lat: payload.lat,
                lng: payload.lng,
            };
            
            const { provider: regProvider, providerToken } = await api.provider.register(safe);
            
            // Validate response
            if (!regProvider || !regProvider._id) {
                throw new Error("Registration failed - no provider data received");
            }
            
            if (providerToken) setProviderToken(providerToken);
            let nextProvider = regProvider;
        const hasFiles =
            payload.profilePhoto instanceof File ||
            payload.aadharFront instanceof File ||
            payload.aadharBack instanceof File ||
            payload.panCard instanceof File ||
            (Array.isArray(payload.certifications) && payload.certifications.length > 0) ||
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
            if (Array.isArray(payload.certifications)) {
                payload.certifications.forEach((cert, idx) => {
                    if (cert.data?.startsWith("data:")) {
                        const blob = toBlob(cert.data);
                        if (blob) form.append("certifications", blob, cert.name || `cert-${idx}.png`);
                    }
                });
            }
            try {
                const { provider: upProvider } = await api.provider.uploadDocs(form);
                nextProvider = upProvider || nextProvider;
            } catch (uploadError) {
                console.error('[Provider] Document upload failed:', uploadError);
                // Continue with registration even if upload fails
            }
        }
        
        // Only save to localStorage after successful registration
        setProvider(nextProvider);
        } catch (error) {
            // Clear any stale data on error
            logout();
            throw error;
        }
    };

    const requestRegisterOtp = async (phone) => {
        return await api.provider.registerRequest(phone);
    };

    const verifyRegisterOtp = async (phone, otp) => {
        return await api.provider.verifyRegistrationOtp(phone, otp);
    };

    const requestOtp = async (phone) => {
        return await api.provider.requestOtp(phone);
    };
    const verifyOtp = async (phone, otp) => {
        try {
            const { provider, providerToken } = await api.provider.verifyOtp(phone, otp);
            
            // Validate response
            if (!provider || !provider._id) {
                throw new Error("OTP verification failed - invalid response from server");
            }
            
            setProvider(provider);
            if (providerToken) setProviderToken(providerToken);
            return { success: true, registered: provider.registrationComplete };
        } catch (error) {
            // Clear any stale data on error
            logout();
            throw error;
        }
    };

    const logout = () => {
        setProvider(null);
        setProviderToken("");
        api.provider.logout();
    };

    const adminApprove = () => {
        setProvider(prev => ({ ...prev, approvalStatus: "approved" }));
    };

    const adminReject = () => {
        setProvider(prev => ({ ...prev, approvalStatus: "rejected" }));
    };

    const upgradeToPro = () => {
        return provider;
    };

    const refreshProvider = async () => {
        const phone = provider?.phone || "";
        if (!phone) return null;
        const { provider: latest } = await api.provider.me(phone);
        if (latest) setProvider(latest);
        return latest || null;
    };

    const requestZones = async (zones) => {
        return await api.provider.requestZones({ zones });
    };

    return (
        <ProviderAuthContext.Provider value={{
            provider,
            setProvider,
            hydrated,
            isLoggedIn,
            isApproved,
            isPending,
            isRejected,
            isRegistered,
            register,
            requestRegisterOtp,
            verifyRegisterOtp,
            requestOtp,
            verifyOtp,
            logout,
            adminApprove,
            adminReject,
            upgradeToPro,
            refreshProvider,
            requestZones,
        }}>
            {children}
        </ProviderAuthContext.Provider>
    );
};
