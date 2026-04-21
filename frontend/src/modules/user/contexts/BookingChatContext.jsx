import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { useBookings } from "./BookingContext";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

const BookingChatContext = createContext();

export const BookingChatProvider = ({ children }) => {
    const { isLoggedIn } = useAuth();
    const { bookings } = useBookings();
    const [unreadCounts, setUnreadCounts] = useState({});
    const [activeChatId, setActiveChatId] = useState(null);
    const socketRef = useRef(null);

    // Filter for bookings where chat is relevant (e.g., accepted, ongoing)
    const activeBookingIds = bookings
        .filter(b => ["accepted", "travelling", "arrived", "in_progress"].includes(b.status?.toLowerCase()))
        .map(b => b._id || b.id);

    const playSound = useCallback(() => {
        try {
            const audio = new Audio("/sounds/massege_ting.mp3");
            audio.volume = 1.0;
            audio.play().catch(err => {
                console.log("[ChatContext] Audio play blocked. User must interact with the page first.", err);
            });
        } catch (err) {
            console.error("[ChatContext] Failed to play sound:", err);
        }
    }, []);

    useEffect(() => {
        if (!isLoggedIn) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        const token = localStorage.getItem("swm_token");
        if (!token) return;

        // Initialize Global Chat Socket
        socketRef.current = io(`${SOCKET_URL}/booking-chat`, {
            auth: { token },
            transports: ["polling", "websocket"]
        });

        socketRef.current.on("connect", () => {
            console.log("[ChatContext] Connected globally");
            // Join rooms for all active bookings
            activeBookingIds.forEach(id => {
                socketRef.current.emit("join:chat", { bookingId: id });
            });
        });

        socketRef.current.on("receive:message", (newMessage) => {
            console.log("[ChatContext] New message received:", newMessage);
            
            // Only notify if message is from provider AND the chat modal for that booking is NOT active
            const isFromProvider = newMessage.senderRole === "provider";
            const bId = newMessage.bookingId;
            const isNotCurrentChat = activeChatId !== bId;

            if (isFromProvider && isNotCurrentChat) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [bId]: (prev[bId] || 0) + 1
                }));

                // Play notification sound
                playSound();

                // Show Toast Notification
                // ...
                toast("New message from your Beautician", {
                    description: newMessage.message,
                    action: {
                        label: "Reply",
                        onClick: () => {
                            // Logic to open chat if needed, but for now just toast is good
                        }
                    }
                });
            }
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [isLoggedIn, activeChatId, activeBookingIds.join(",")]); // Join on IDs change

    const clearUnread = useCallback((bookingId) => {
        setUnreadCounts(prev => {
            if (!prev[bookingId]) return prev;
            const next = { ...prev };
            delete next[bookingId];
            return next;
        });
    }, []);

    const getTotalUnread = useCallback(() => {
        return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
    }, [unreadCounts]);

    return (
        <BookingChatContext.Provider value={{ 
            unreadCounts, 
            clearUnread, 
            setActiveChatId, 
            activeChatId,
            totalUnreadCount: getTotalUnread(),
            socket: socketRef.current 
        }}>
            {children}
        </BookingChatContext.Provider>
    );
};

export const useBookingChat = () => {
    const context = useContext(BookingChatContext);
    if (!context) throw new Error("useBookingChat must be used within a BookingChatProvider");
    return context;
};
