import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
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

    // Fallback 1: Clipboard API (Secure contexts only)
    const copyText = shareData.url || shareData.text;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(copyText);
            alert("Link copied to clipboard!");
            return;
        } catch (err) {
            console.error("Clipboard failed:", err);
        }
    }

    // Fallback 2: Old school textarea hack (Works in most insecure contexts)
    try {
        const textArea = document.createElement("textarea");
        textArea.value = copyText;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (successful) {
            alert("Link copied to clipboard!");
        } else {
            throw new Error("execCommand failed");
        }
    } catch (err) {
        // Last resort
        window.prompt("Copy this link:", copyText);
    }
}
