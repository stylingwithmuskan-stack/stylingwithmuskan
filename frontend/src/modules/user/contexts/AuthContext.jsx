import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from "@/modules/user/lib/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [hasAddress, setHasAddress] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { user } = await api.me();
                if (cancelled) return;
                setUser(user);
                setIsLoggedIn(true);
                setHasAddress((user.addresses || []).length > 0);
            } catch {
                // not logged in
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const loginWithOtp = async ({ phone, otp, name, referralCode, intent = "login" }) => {
        const res = await api.verifyOtp(phone, otp, intent);
        console.log("[Auth] verifyOtp response", res);
        const { user: u } = res;
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
            return;
        }
        setUser(u);
        setHasAddress((u.addresses || []).length > 0);
        setIsLoggedIn(true);
    };

    const logout = () => {
        api.logout().then((res) => {
            console.log("[Auth] logout response", res);
        }).finally(() => {
            setIsLoggedIn(false);
            setUser(null);
            setHasAddress(false);
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

    const joinPlus = () => {
        if (!user) return;
        const updatedUser = { 
            ...user, 
            isPlusMember: true,
            plusExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
        };
        setUser(updatedUser);
        localStorage.setItem('smd_user', JSON.stringify(updatedUser));
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
