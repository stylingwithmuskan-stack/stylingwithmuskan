import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

import { shareToFlutter, isFlutterWebView } from "@/utils/flutterBridge";

export async function shareContent(data) {
    const shareData = {
        title: data.title || "Styling with Muskan",
        text: data.text || "Check out these services!",
        url: data.url || window.location.href,
    };

    // 0. Try Flutter native share if in app
    if (isFlutterWebView()) {
        const success = await shareToFlutter(shareData);
        if (success) return;
    }

    // 1. Try Web Share API
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            return;
        } catch (err) {
            if (err.name === "AbortError") return;
            console.error("Share failed:", err);
        }
    }

    // Fallback 1: Try copying to clipboard first
    const copyText = shareData.url || shareData.text;
    let copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(copyText);
            copied = true;
        } catch (err) {
            console.error("Clipboard failed:", err);
        }
    }

    // Fallback 1b: Secondary copy method
    if (!copied) {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = copyText;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            copied = document.execCommand("copy");
            document.body.removeChild(textArea);
        } catch (err) {
            console.error("Insecure copy failed:", err);
        }
    }

    // If in App (WebView) or Mobile device and Web Share failed, redirect to WhatsApp
    if (isFlutterWebView() || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const message = `${shareData.text || shareData.title}\n\nLink: ${shareData.url}`;
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        toast.success(copied ? "Link copied & opening WhatsApp!" : "Opening WhatsApp...");
        return;
    }

    if (copied) {
        toast.success("Link copied to clipboard!");
        return;
    }

    // Last resort: Show toast with manual copy button (guarantees user gesture works)
    toast("Copy this link to share", {
        description: copyText,
        action: {
            label: "Copy Link",
            onClick: () => {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(copyText)
                        .then(() => toast.success("Copied!"))
                        .catch(() => alert("Please copy manually: " + copyText));
                } else {
                    window.prompt("Copy this link:", copyText);
                }
            }
        },
        duration: 8000
    });
}

export function getServicePlaceholder(serviceName = "", categoryName = "") {
    const combined = `${serviceName} ${categoryName}`.toLowerCase();
    
    if (combined.includes("hair")) return "https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=800&auto=format&fit=crop";
    if (combined.includes("makeup") || combined.includes("bridal") || combined.includes("groom")) return "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=800&auto=format&fit=crop";
    if (combined.includes("skin") || combined.includes("facial") || combined.includes("clean") || combined.includes("detan")) return "https://images.unsplash.com/photo-1570172619996-23b241402120?q=80&w=800&auto=format&fit=crop";
    if (combined.includes("nail") || combined.includes("pedicure") || combined.includes("manicure")) return "https://images.unsplash.com/photo-1604654894610-df490668f606?q=80&w=800&auto=format&fit=crop";
    if (combined.includes("massage") || combined.includes("message") || combined.includes("spa") || combined.includes("wax") || combined.includes("threading")) return "https://images.unsplash.com/photo-1544161515-4af6b1d46ad5?q=80&w=800&auto=format&fit=crop";
    if (combined.includes("mehndi") || combined.includes("henna")) return "https://images.unsplash.com/photo-1590487988256-9ed24133863e?q=80&w=800&auto=format&fit=crop";

    return "/placeholder.svg";
}

export function resolveImageUrl(imagePath) {
    if (!imagePath) return "";
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://") || imagePath.startsWith("data:")) {
        return imagePath;
    }
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    
    // If the image is a local upload (/images/...), fetch it through the /api route 
    // so that Nginx on the live server automatically proxies it to the backend.
    if (imagePath.startsWith("/images/")) {
        const cleanApiBase = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
        return `${cleanApiBase}${imagePath}`;
    }

    const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
    const cleanPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
    return `${baseUrl}${cleanPath}`;
}
