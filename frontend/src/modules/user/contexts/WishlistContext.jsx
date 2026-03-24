import React, { createContext, useContext, useState } from "react";

const WishlistContext = createContext(undefined);

export const useWishlist = () => {
    const context = useContext(WishlistContext);
    if (!context) {
        throw new Error("useWishlist must be used within a WishlistProvider");
    }
    return context;
};

export const WishlistProvider = ({ children }) => {
    const [wishlistItems, setWishlistItems] = useState([]);

    const addToWishlist = (service) => {
        setWishlistItems((prevItems) => {
            const exists = prevItems.find((item) => item.id === service.id);
            if (exists) return prevItems;
            return [...prevItems, service];
        });
    };

    const removeFromWishlist = (serviceId) => {
        setWishlistItems((prevItems) => prevItems.filter((item) => item.id !== serviceId));
    };

    const isInWishlist = (serviceId) => {
        return wishlistItems.some((item) => item.id === serviceId);
    };

    const toggleWishlist = (service) => {
        if (isInWishlist(service.id)) {
            removeFromWishlist(service.id);
        } else {
            addToWishlist(service);
        }
    };

    const clearWishlist = () => {
        setWishlistItems([]);
    };

    return (
        <WishlistContext.Provider
            value={{
                wishlistItems,
                wishlistCount: wishlistItems.length,
                addToWishlist,
                removeFromWishlist,
                isInWishlist,
                toggleWishlist,
                clearWishlist,
            }}
        >
            {children}
        </WishlistContext.Provider>
    );
};
