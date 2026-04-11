import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/modules/user/contexts/AuthContext";

/**
 * ProtectedRoute — wraps user-panel routes that require authentication.
 * 
 * Behaviour:
 *  1. While AuthContext is still loading (hydrating from localStorage / API),
 *     show a minimal loading state so the page doesn't flash.
 *  2. If the user is NOT logged in after hydration → redirect to /login,
 *     passing the current path in `state.from` so UserLoginPage can
 *     redirect back after a successful login.
 *  3. If the user IS logged in → render children normally.
 */
const ProtectedRoute = ({ children }) => {
    const { isLoggedIn, loading } = useAuth();
    const location = useLocation();

    // Wait for auth hydration to complete before making a decision
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
                Loading…
            </div>
        );
    }

    // Not authenticated → redirect to /login with return path
    if (!isLoggedIn) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    // Authenticated → render page
    return children;
};

export default ProtectedRoute;
