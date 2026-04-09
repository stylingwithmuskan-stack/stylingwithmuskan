import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from "@/modules/user/lib/api";
import { safeStorage } from "@/modules/user/lib/safeStorage";
import { initPushNotifications, unregisterPush } from "@/services/pushNotificationService";

export const AuthContext = createContext();
const STORAGE_KEY = "swm_user_auth_state";

export const AuthProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [hasAddress, setHasAddress] = useState(false);

    const clearUserSession = () => {
        setIsLoggedIn(false);
        setUser(null);
        setHasAddress(false);
        safeStorage.removeItem(STORAGE_KEY);
    };

    // Initial hydration from localStorage
    useEffect(() => {
        try {
            const raw = safeStorage.getItem(STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                if (data.isLoggedIn && data.user) {
                    setIsLoggedIn(true);
                    setUser(data.user);
                    setHasAddress((data.user.addresses || []).length > 0);
                }
            }
        } catch (err) {
            console.error("[Auth] Hydration failed", err);
        }
    }, []);

    // Persist state to localStorage whenever it changes
    useEffect(() => {
        try {
            if (isLoggedIn && user) {
                safeStorage.setItem(STORAGE_KEY, JSON.stringify({ isLoggedIn, user }));
            } else if (!isLoggedIn && !loading) {
                safeStorage.removeItem(STORAGE_KEY);
            }
        } catch (err) {
            console.error("[Auth] Persistence failed", err);
        }
    }, [isLoggedIn, user, loading]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { user: serverUser } = await api.me();
                if (cancelled) return;
                setUser(serverUser);
                setIsLoggedIn(true);
                setHasAddress((serverUser.addresses || []).length > 0);
            } catch (error) {
                // Clear only on definite unauthorized states; keep hydrated state for transient failures.
                if (!cancelled && error?.status === 401) {
                    clearUserSession();
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const handle401 = (e) => {
            if (e.detail?.status !== 401) return;
            if (e.detail?.role === "user") {
                clearUserSession();
                setIsLoginModalOpen(true);
            }
        };
        window.addEventListener("swm-api-401", handle401);
        return () => window.removeEventListener("swm-api-401", handle401);
    }, []);

    const loginWithOtp = async ({ phone, otp, name, referralCode, intent = "login" }) => {
        try {
            const res = await api.verifyOtp(phone, otp, intent);
            console.log("[Auth] verifyOtp response", res);
            
            // Validate response
            if (!res || !res.user || !res.user._id) {
                throw new Error("Login failed - invalid response from server");
            }
            
            const { user: u } = res;
            const isNewUser = !!u?.isNew;
            
            // If new user and profile fields provided, update
            if ((name && name.trim()) || (referralCode && referralCode.trim())) {
                const profileRes = await api.updateProfile({
                    name: name?.trim(),
                    referralCode: (referralCode || "").trim()
                });
                console.log("[Auth] updateProfile response", profileRes);
                const { user: updated } = profileRes;
                setUser(updated);
                setHasAddress((updated.addresses || []).length > 0);
                setIsLoggedIn(true);
                // Register FCM token after login
                const token = safeStorage.getItem("swm_token") || "";
                if (token) initPushNotifications(token, "user").catch(() => {});
                return profileRes;
            }
            
            setUser(u);
            setHasAddress((u.addresses || []).length > 0);
            setIsLoggedIn(true);
            // Register FCM token after login
            const token = safeStorage.getItem("swm_token") || "";
            if (token) initPushNotifications(token, "user").catch(() => {});
            return res;
        } catch (error) {
            // Clear any stale data on error
            clearUserSession();
            throw error;
        }
    };

    const logout = () => {
        const token = safeStorage.getItem("swm_token") || "";
        unregisterPush(token, "user").catch(() => {});
        api.logout().then((res) => {
            console.log("[Auth] logout response", res);
        }).finally(() => {
            clearUserSession();
            window.location.href = "/home";
        });
    };

    const updateAddress = (address) => {
        return api.addAddress(address).then(({ addresses }) => {
            const updatedUser = { ...user, addresses };
            setUser(updatedUser);
            setHasAddress((addresses || []).length > 0);
        });
    };

    const updateExistingAddress = (id, payload) => {
        return api.updateAddress(id, payload).then(({ addresses }) => {
            const updatedUser = { ...user, addresses };
            setUser(updatedUser);
            setHasAddress((addresses || []).length > 0);
        });
    };

    const deleteAddress = (id) => {
        return api.deleteAddress(id).then(({ addresses }) => {
            const updatedUser = { ...user, addresses };
            setUser(updatedUser);
            setHasAddress((addresses || []).length > 0);
        });
    };

    const updateProfile = async (payload) => {
        const { user: updated } = await api.updateProfile(payload);
        setUser(updated);
    };

    const joinPlus = async () => {
        if (!user) return null;
        try {
            const { user: freshUser } = await api.me();
            if (freshUser) {
                setUser(freshUser);
                safeStorage.setItem('smd_user', JSON.stringify(freshUser));
                return freshUser;
            }
        } catch {}
        return user;
    };

    return (
        <AuthContext.Provider value={{
            isLoggedIn,
            user,
            setUser,
            loginWithOtp,
            logout,
            loading,
            isLoginModalOpen,
            setIsLoginModalOpen,
            isAddressModalOpen,
            setIsAddressModalOpen,
            hasAddress,
            setHasAddress,
            updateAddress,
            updateExistingAddress,
            deleteAddress,
            updateProfile
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
