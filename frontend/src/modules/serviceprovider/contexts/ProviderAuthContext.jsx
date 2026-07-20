import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/modules/user/lib/api";
import { safeStorage } from "@/modules/user/lib/safeStorage";
import { initPushNotifications, unregisterPush } from "@/services/pushNotificationService";

export const ProviderAuthContext = createContext(undefined);

export const useProviderAuth = () => {
    const context = useContext(ProviderAuthContext);
    if (!context) throw new Error("useProviderAuth must be used within ProviderAuthProvider");
    return context;
};

const STORAGE_KEY = "swm_provider";
const TOKEN_KEY = "swm_provider_token";

export const ProviderAuthProvider = ({ children }) => {
    const [provider, setProviderState] = useState(() => {
        try {
            // Priority 1: sessionStorage (Tab-specific, survives refresh)
            const sessionRaw = sessionStorage.getItem(STORAGE_KEY);
            if (sessionRaw) return JSON.parse(sessionRaw);
            
            // Priority 2: localStorage (Cross-tab persistence, for new tabs)
            const localRaw = safeStorage.getItem(STORAGE_KEY);
            if (localRaw) {
                const parsed = JSON.parse(localRaw);
                // Copy to sessionStorage to "lock" it to this tab
                sessionStorage.setItem(STORAGE_KEY, localRaw);
                return parsed;
            }
            return null;
        } catch { return null; }
    });
    const [hydrated, setHydrated] = useState(true); // Set to true immediately since we read in initializer
    const setProvider = (p) => {
        setProviderState(p);
        try {
            if (p) {
                const raw = JSON.stringify(p);
                sessionStorage.setItem(STORAGE_KEY, raw);
                safeStorage.setItem(STORAGE_KEY, raw);
            } else {
                sessionStorage.removeItem(STORAGE_KEY);
                safeStorage.removeItem(STORAGE_KEY);
            }
        } catch {}
    };
    const [providerToken, setProviderTokenState] = useState(() => {
        return sessionStorage.getItem(TOKEN_KEY) || safeStorage.getItem(TOKEN_KEY) || "";
    });
    const setProviderToken = (token) => {
        setProviderTokenState(token || "");
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
    useEffect(() => {
        // Hydration now handled synchronously in initializer
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
                cityId: String(payload.cityId || "").trim(),
                zones: Array.isArray(payload.zones)
                    ? payload.zones
                    : (payload.zone ? [payload.zone] : []),
                zoneIds: Array.isArray(payload.zoneIds) ? payload.zoneIds : [],
                customZone: String(payload.customZone || "").trim(),
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
            if (!regProvider || (!regProvider._id && !regProvider.id)) {
                throw new Error("Registration failed - no provider data received");
            }
            
            if (providerToken) {
                setProviderToken(providerToken);
            }
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
            const compressImage = (val) => {
                return new Promise((resolve) => {
                    if (!val) return resolve(val);
                    const isFile = val instanceof File;
                    const isDataUrl = typeof val === "string" && val.startsWith("data:");
                    if (!isFile && !isDataUrl) return resolve(val);
                    
                    const img = new Image();
                    img.onload = () => {
                        let width = img.width;
                        let height = img.height;
                        const maxWidth = 1200;
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                        const canvas = document.createElement("canvas");
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(img, 0, 0, width, height);
                        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
                        resolve(compressedDataUrl);
                    };
                    img.onerror = () => resolve(val);
                    img.src = isFile ? URL.createObjectURL(val) : val;
                });
            };

            const appendIf = async (key, val) => {
                const compressed = await compressImage(val);
                if (compressed) {
                    if (compressed instanceof File) {
                        form.append(key, compressed, compressed.name || `${key}.png`);
                    } else if (typeof compressed === "string" && compressed.startsWith("data:")) {
                        // Convert data URL to Blob for multer
                        const arr = compressed.split(',');
                        const mime = arr[0].match(/:(.*?);/)[1];
                        const bstr = atob(arr[1]);
                        let n = bstr.length;
                        const u8arr = new Uint8Array(n);
                        while(n--){
                            u8arr[n] = bstr.charCodeAt(n);
                        }
                        const blob = new Blob([u8arr], {type:mime});
                        form.append(key, blob, `${key}.jpg`);
                    }
                }
            };

            await appendIf("profilePhoto", payload.profilePhoto);
            await appendIf("aadharFront", payload.aadharFront);
            await appendIf("aadharBack", payload.aadharBack);
            await appendIf("panCard", payload.panCard);

            if (Array.isArray(payload.certifications)) {
                for (let idx = 0; idx < payload.certifications.length; idx++) {
                    const cert = payload.certifications[idx];
                    if (cert.data?.startsWith("data:")) {
                        const compressedCert = await compressImage(cert.data);
                        if (compressedCert) {
                            form.append("certifications", compressedCert);
                        }
                    }
                }
            }
            try {
                const { provider: upProvider } = await api.provider.uploadDocs(form, providerToken);
                nextProvider = upProvider || nextProvider;
            } catch (uploadError) {
                console.error('[Provider] Document upload failed:', uploadError);
                // Continue with registration even if upload fails
            }
        }
        
        // Only save to localStorage after successful registration
        setProvider(nextProvider);
        if (providerToken) {
            initPushNotifications(providerToken, "provider").catch((err) => {
                console.error("[ProviderAuth] Push registration failed after register:", err);
                // Retry after 5s — service worker may need time
                setTimeout(() => initPushNotifications(providerToken, "provider").catch(e => console.error("[ProviderAuth] Push retry also failed:", e)), 5000);
            });
        }
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
            
            // Validate response - check for both _id and id
            if (!provider || (!provider._id && !provider.id)) {
                throw new Error("OTP verification failed - invalid response from server");
            }
            
            setProvider(provider);
            if (providerToken) {
                setProviderToken(providerToken);
                initPushNotifications(providerToken, "provider").catch((err) => {
                    console.error("[ProviderAuth] Push registration failed after OTP login:", err);
                    // Retry after 5s — service worker may need time
                    setTimeout(() => initPushNotifications(providerToken, "provider").catch(e => console.error("[ProviderAuth] Push retry also failed:", e)), 5000);
                });
            }
            return { success: true, registered: provider.registrationComplete };
        } catch (error) {
            // Clear any stale data on error
            logout();
            throw error;
        }
    };

    const logout = () => {
        try {
            const token = safeStorage.getItem("swm_provider_token") || "";
            unregisterPush(token, "provider").catch(() => {});
            setProvider(null);
            setProviderToken("");
            api.provider.logout();
            
            // Critical: Clear everything and redirect to login to reset all contexts/sockets
            safeStorage.removeItem(STORAGE_KEY);
            safeStorage.removeItem(TOKEN_KEY);
            
            window.location.href = "/provider/login";
            // Optional: window.location.reload(); 
        } catch (e) {
            console.error("Logout error:", e);
            window.location.href = "/provider/login";
        }
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
            providerToken,
            setProviderToken,
        }}>
            {children}
        </ProviderAuthContext.Provider>
    );
};
