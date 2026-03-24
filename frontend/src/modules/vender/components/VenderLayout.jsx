import React, { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    Users,
    CalendarRange,
    Wallet,
    ShieldAlert,
    User,
    LogOut,
    Bell,
    Menu,
    X,
    ChevronRight,
    Store,
    MessageSquare,
    CreditCard
} from "lucide-react";
import { cn } from "@/modules/user/lib/utils";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";

const VenderLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { vendor, logout, hydrated, isLoggedIn } = useVenderAuth();
    const [sidebarOpen, setSidebarOpen] = React.useState(false);

    useEffect(() => {
        document.documentElement.classList.remove("theme-women", "theme-men", "theme-beautician", "theme-admin");
        document.documentElement.classList.add("theme-vendor");
        return () => document.documentElement.classList.remove("theme-vendor");
    }, []);

    if (!hydrated) {
        return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
    }
    if (!isLoggedIn) {
        navigate("/vender/login", { replace: true });
        return null;
    }

    const navLinks = [
        { name: "Dashboard", path: "/vender/dashboard", icon: LayoutDashboard },
        { name: "SP Management", path: "/vender/service-providers", icon: Users },
        { name: "Bookings", path: "/vender/bookings", icon: CalendarRange },
        { name: "Payouts", path: "/vender/payouts", icon: Wallet },
        { name: "Subscription", path: "/vender/subscription", icon: CreditCard },
        { name: "SOS Monitor", path: "/vender/sos", icon: ShieldAlert },
        { name: "Feedback", path: "/vender/feedback", icon: MessageSquare },
        { name: "Profile", path: "/vender/profile", icon: User },
    ];

    const isActive = (path) => location.pathname === path;

    const handleLogout = () => {
        logout();
        navigate("/vender/login");
    };

    return (
        <div className="flex min-h-screen w-full bg-background">
            {/* Desktop Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col bg-sidebar md:flex">
                {/* Logo */}
                <div className="flex h-[70px] items-center gap-3 border-b border-sidebar-border px-5">
                    <motion.div
                        whileHover={{ scale: 1.05, rotate: 3 }}
                        className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-green-500 flex items-center justify-center shadow-lg"
                    >
                        <Store className="h-5 w-5 text-white" />
                        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-400 rounded-full border-2 border-sidebar animate-pulse" />
                    </motion.div>
                    <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-sidebar-foreground tracking-tight">
                            SWM Vendor
                        </span>
                        <span className="text-[9px] font-black uppercase text-primary tracking-[0.2em]">
                            {vendor?.city || "City Panel"}
                        </span>
                    </div>
                </div>

                {/* Nav Links */}
                <div className="flex-1 overflow-auto py-4 px-3">
                    <nav className="space-y-1">
                        {navLinks.map((link) => {
                            const Icon = link.icon;
                            const active = isActive(link.path);
                            return (
                                <motion.div key={link.path} whileHover={{ x: 4 }} whileTap={{ scale: 0.97 }}>
                                    <Link
                                        to={link.path}
                                        className={cn(
                                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200",
                                            active
                                                ? "bg-emerald-800/60 text-white shadow-sm ring-1 ring-emerald-700/30"
                                                : "text-emerald-100/70 hover:text-white hover:bg-emerald-800/30"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                                            active ? "bg-emerald-500 text-white shadow-md" : "bg-black/20 text-emerald-200/70"
                                        )}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        {link.name}
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </nav>
                </div>

                {/* Bottom */}
                <div className="border-t border-sidebar-border p-4">
                    <motion.button
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-[13px] font-semibold text-emerald-100/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                        <div className="h-8 w-8 rounded-lg bg-black/20 text-emerald-200/70 flex items-center justify-center">
                            <LogOut className="h-4 w-4" />
                        </div>
                        Logout
                    </motion.button>
                </div>
            </aside>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                            onClick={() => setSidebarOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="fixed inset-y-0 left-0 z-50 w-[280px] bg-sidebar flex flex-col md:hidden shadow-2xl"
                        >
                            <div className="flex h-[70px] items-center justify-between border-b border-sidebar-border px-5">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-green-500 flex items-center justify-center">
                                        <Store className="h-5 w-5 text-white" />
                                    </div>
                                    <span className="text-[14px] font-bold text-sidebar-foreground">SWM Vendor</span>
                                </div>
                                <button onClick={() => setSidebarOpen(false)} className="p-2 text-sidebar-foreground/50 hover:text-sidebar-foreground">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto py-4 px-3">
                                <nav className="space-y-1">
                                    {navLinks.map((link) => {
                                        const Icon = link.icon;
                                        const active = isActive(link.path);
                                        return (
                                            <Link
                                                key={link.path}
                                                to={link.path}
                                                onClick={() => setSidebarOpen(false)}
                                                className={cn(
                                                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all",
                                                    active
                                                        ? "bg-emerald-800/60 text-white shadow-sm ring-1 ring-emerald-700/30"
                                                        : "text-emerald-100/70 hover:text-white hover:bg-emerald-800/30"
                                                )}
                                            >
                                                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", active ? "bg-emerald-500 text-white shadow-md" : "bg-black/20 text-emerald-200/70")}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                {link.name}
                                            </Link>
                                        );
                                    })}
                                </nav>
                            </div>
                            <div className="p-4 border-t border-sidebar-border">
                                <button onClick={handleLogout} className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-[13px] font-semibold text-emerald-100/70 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                    <div className="h-8 w-8 rounded-lg bg-black/20 text-emerald-200/70 flex items-center justify-center">
                                        <LogOut className="h-4 w-4" />
                                    </div>
                                    Logout
                                </button>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex flex-col flex-1 md:pl-[260px]">
                {/* Top Bar */}
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4 md:px-8">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors">
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="hidden md:block">
                            <h2 className="text-sm font-bold text-foreground">
                                Welcome, {vendor?.name || "Vendor"}
                            </h2>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {vendor?.city || "City"} • Vendor Panel
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="relative p-2.5 bg-muted hover:bg-primary/10 rounded-xl transition-colors"
                        >
                            <Bell className="h-5 w-5 text-muted-foreground" />
                            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-background animate-pulse" />
                        </motion.button>
                    </div>
                </header>

                <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
                    <div className="mx-auto w-full max-w-7xl">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={location.pathname}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Outlet />
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>

            {/* Mobile Bottom Nav */}
            <nav className="fixed bottom-0 z-50 w-full border-t border-border bg-background/95 backdrop-blur-xl px-2 pb-safe pt-1 md:hidden">
                <div className="flex items-center justify-between">
                    {navLinks.slice(0, 5).map((link) => {
                        const Icon = link.icon;
                        const active = isActive(link.path);
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                className="flex flex-col items-center justify-center py-1.5 px-2 flex-1"
                            >
                                <motion.div
                                    whileTap={{ scale: 0.85 }}
                                    className={cn(
                                        "p-1.5 rounded-xl transition-all duration-200",
                                        active ? "bg-primary/15" : ""
                                    )}
                                >
                                    <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                                </motion.div>
                                <span className={cn(
                                    "text-[9px] font-bold mt-0.5",
                                    active ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {link.name}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default VenderLayout;
