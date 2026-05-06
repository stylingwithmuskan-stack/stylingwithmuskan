import React, { createContext, useContext, useState, useEffect } from "react";
import { useUserModuleData } from "./UserModuleDataContext.jsx";
import { api } from "@/modules/user/lib/api";

const CartContext = createContext(undefined);

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        // Return a fallback to prevent crash, though this shouldn't happen if provider is correctly placed
        return {
            cart: [],
            addToCart: () => {},
            removeItem: () => {},
            updateQuantity: () => {},
            clearCart: () => {},
            total: 0,
            itemCount: 0
        };
    }
    return context;
};

export const CartProvider = ({ children }) => {
    const { categories: categoriesData, serviceTypes } = useUserModuleData();

    const getCategories = () => categoriesData || [];

    const [cartItems, setCartItems] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [bookingType, setBookingType] = useState("instant");
    const [customAdvance, setCustomAdvance] = useState(null);

    // Persistence: load from localStorage on init
    useEffect(() => {
        const savedCart = localStorage.getItem("swm_cart");
        if (savedCart) {
            try {
                const parsed = JSON.parse(savedCart);
                if (Array.isArray(parsed)) setCartItems(parsed);
            } catch (e) {
                console.error("Failed to load cart from local storage", e);
            }
        }
    }, []);

    // Persistence: save to localStorage on change
    useEffect(() => {
        localStorage.setItem("swm_cart", JSON.stringify(cartItems));
    }, [cartItems]);


    const totalItems = cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
    const totalPrice = cartItems.reduce((total, item) => total + (item.price * (item.quantity || 1)), 0);
    const totalSavings = Math.abs(cartItems.reduce((total, item) => {
        if (item.originalPrice) {
            return total + ((item.originalPrice - item.price) * (item.quantity || 1));
        }
        return total;
    }, 0));
    const [serverTotals, setServerTotals] = useState({ total: 0, discount: 0, finalTotal: 0, couponApplied: null });

    const getGroupedItems = () => {
        const groups = {};
        const groupLabels = { skin: "🧴 Skin Care", hair: "💇 Hair Services", makeup: "💄 Makeup & More" };
        const groupImages = {
            skin: "/skin_service_banner_1772177557335.png",
            hair: "/hair_service_banner_1772177572229.png",
            makeup: "/makeup_service_banner_1772177590551.png"
        };

        cartItems.forEach(item => {
            const cats = getCategories();
            const cat = item.category ? cats.find(c => c.id === item.category) : null;
            const type = (cat?.serviceType || item.serviceType || "other").toLowerCase();
            
            if (!groups[type]) {
                const typeInfo = serviceTypes?.find(t => t.id.toLowerCase() === type || t.label.toLowerCase() === type);
                const fallbackLabel = cat?.name || (type !== 'other' ? (type.charAt(0).toUpperCase() + type.slice(1)) : "Other Services");
                
                groups[type] = {
                    id: type,
                    label: groupLabels[type] || typeInfo?.label || fallbackLabel,
                    image: groupImages[type] || typeInfo?.image || (cat?.image || "/logo1.png"),
                    items: [],
                    subtotal: 0,
                    itemCount: 0
                };
            }
            groups[type].items.push(item);
            groups[type].subtotal += item.price * (item.quantity || 1);
            groups[type].itemCount += (item.quantity || 1);
        });
        return groups;
    };


    const addToCart = (service, quantity = 1) => {
        if (!service) return;

        // Meta Pixel Tracking
        try {
            if (window.fbq) {
                window.fbq('track', 'AddToCart', {
                    content_ids: [service.id],
                    content_name: service.name,
                    content_type: 'product',
                    value: service.price,
                    currency: 'INR'
                });
            }
        } catch (err) {
            console.error("Meta Pixel AddToCart error:", err);
        }

        setCartItems((prevItems) => {
            const existingItemIndex = prevItems.findIndex((item) => item.id === service.id);
            const serviceWithType = { ...service, serviceType: service.serviceType || "skin" };

            if (existingItemIndex > -1) {
                return prevItems.map((item, idx) =>
                    idx === existingItemIndex
                        ? { ...item, quantity: (item.quantity || 0) + quantity }
                        : item
                );
            }
            return [...prevItems, { ...serviceWithType, quantity }];
        });
    };

    const updateQuantity = (serviceId, amount) => {
        setCartItems((prevItems) => {
            return prevItems.map((item) => {
                if (item.id === serviceId) {
                    const newQuantity = (item.quantity || 1) + amount;
                    return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
                }
                return item;
            }).filter(Boolean);
        });
    };

    const clearGroup = (typeId) => {
        setCartItems(prev => prev.filter(item => item.serviceType !== typeId));
    };

    const clearCart = () => {
        setCartItems([]);
        setCustomAdvance(null);
    };

    const [activeCheckoutType, setActiveCheckoutType] = useState(null);
    const [isFloatingSummaryOpen, setIsFloatingSummaryOpen] = useState(false);

    useEffect(() => {
        if (isCartOpen) {
            setIsFloatingSummaryOpen(false);
        }
    }, [isCartOpen]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            try {
                const items = cartItems.map(it => ({ name: it.name, price: it.price, quantity: it.quantity || 1, duration: it.duration, category: it.category, serviceType: it.serviceType }));
                if (items.length > 0) {
                    const totals = await api.bookings.quote({ items, bookingType });
                    if (!cancelled) setServerTotals(totals);
                } else {
                    if (!cancelled) setServerTotals({ total: 0, discount: 0, finalTotal: 0, couponApplied: null });
                }
            } catch {
                if (!cancelled) setServerTotals({ total: totalPrice, discount: 0, finalTotal: totalPrice, couponApplied: null });
            }
        };
        run();
        return () => { cancelled = true; };
    }, [cartItems]);

    return (
        <CartContext.Provider
            value={{
                cartItems,
                totalItems,
                totalPrice,
                totalSavings,
                serverTotals,
                isCartOpen,
                setIsCartOpen,
                isFloatingSummaryOpen,
                setIsFloatingSummaryOpen,
                activeCheckoutType,
                setActiveCheckoutType,
                selectedSlot,
                setSelectedSlot,
                bookingType,
                setBookingType,
                customAdvance,
                setCustomAdvance,
                addToCart,
                updateQuantity,
                clearCart,
                clearGroup,
                getGroupedItems,
                addCustomAdvanceToCart: (enquiry, amount) => {
                    const enqId = enquiry?._id || enquiry?.id || `custom-${Date.now()}`;
                    const price = Number(amount || 0);
                    const name = `Advance for ${enquiry?.eventType || enquiry?.name || "Custom Booking"}`;
                    const item = {
                        id: `custom-advance-${enqId}`,
                        name,
                        price,
                        quantity: 1,
                        category: "custom",
                        serviceType: "custom",
                        isCustomAdvance: true,
                        enquiryId: enqId
                    };
                    setCartItems([item]);
                    setBookingType("customized");
                    const date = enquiry?.scheduledAt?.date || enquiry?.date || null;
                    const time = enquiry?.scheduledAt?.timeSlot || enquiry?.timeSlot || null;
                    if (date && time) setSelectedSlot({ date, time });
                    setCustomAdvance({ enquiryId: enqId, amount: price, label: name });
                },
            }}
        >
            {children}
        </CartContext.Provider>
    );
};
