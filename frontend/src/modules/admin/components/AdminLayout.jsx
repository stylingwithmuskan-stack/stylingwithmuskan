import React, { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard, Users, Store, CalendarRange, Wallet, ShieldAlert,
    Image, Ticket, Gift, LogOut, Bell, Menu, X, ChevronRight, Shield, Layers, User, MessageSquare, LayoutGrid, Clapperboard, Images
} from "lucide-react";
import { cn } from "@/modules/user/lib/utils";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";

const AdminLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { admin, logout } = useAdminAuth();
    const [sidebarOpen, setSidebarOpen] = React.useState(false);

    useEffect(() => {
        document.documentElement.classList.remove("theme-women", "theme-men", "theme-beautician", "theme-vendor");
        document.documentElement.classList.add("theme-admin");
        return () => document.documentElement.classList.remove("theme-admin");
    }, []);
    useEffect(() => {
        if (!admin) navigate("/admin/login");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admin]);

    const navGroups = [
        {
            label: "Overview",
            links: [
                { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
            ],
        },
        {
            label: "Management",
            links: [
                { name: "Vendors", path: "/admin/vendors", icon: Store },
                { name: "Service Providers", path: "/admin/service-providers", icon: Users },
                { name: "Customers", path: "/admin/customers", icon: User },
                { name: "Bookings", path: "/admin/bookings", icon: CalendarRange },
                { name: "Custom Enquiries", path: "/admin/custom-enquiries", icon: LayoutGrid },
                { name: "Training", path: "/admin/training", icon: LayoutGrid },
                { name: "Feedback", path: "/admin/feedback", icon: MessageSquare },
                { name: "App Data", path: "/admin/user-data", icon: Layers },
            ],
        },
        {
            label: "Finance",
            links: [
                { name: "Commission & Payouts", path: "/admin/finance", icon: Wallet },
            ],
        },
        {
            label: "Marketing",
            links: [
                { name: "Banners", path: "/admin/banners", icon: Image },
                { name: "Reels Manage", path: "/admin/reels", icon: Clapperboard },
                { name: "Our Gallery", path: "/admin/gallery", icon: Images },
                { name: "Coupons", path: "/admin/coupons", icon: Ticket },
                { name: "Referrals", path: "/admin/referrals", icon: Gift },
            ],
        },
        {
            label: "Safety",
            links: [
                { name: "SOS Monitor", path: "/admin/sos", icon: ShieldAlert },
            ],
        },
    ];

    const isActive = (path) => location.pathname === path;
    const handleLogout = () => { logout(); navigate("/admin/login"); };

    if (!admin) {
        return <Navigate to="/admin/login" replace />;
    }

    return (
        <div className="flex min-h-screen w-full bg-background">
            {/* Desktop Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[220px] flex-col bg-sidebar-background md:flex overflow-hidden border-r border-border/50 shadow-xl">
                {/* Logo */}
                <div className="flex h-[70px] items-center gap-3 border-b border-sidebar-border px-5">
                    <motion.div whileHover={{ scale: 1.05, rotate: 3 }}
                        className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Shield className="h-5 w-5 text-white" />
                    </motion.div>
                    <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-sidebar-foreground tracking-tight">SWM Admin</span>
                        <span className="text-[9px] font-black uppercase text-primary tracking-[0.2em]">Global Control</span>
                    </div>
                </div>

                {/* Nav */}
                <div className="flex-1 overflow-y-auto py-3 px-3 hide-scrollbar">
                    {navGroups.map((group) => (
                        <div key={group.label} className="mb-4">
                            <p className="text-[9px] font-black text-sidebar-foreground/30 uppercase tracking-[0.2em] px-3 mb-2">{group.label}</p>
                            <nav className="space-y-0.5">
                                {group.links.map((link) => {
                                    const Icon = link.icon;
                                    const active = isActive(link.path);
                                    return (
                                        <motion.div key={link.path} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}>
                                            <Link to={link.path}
                                                className={cn(
                                                    "flex items-center gap-3 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all duration-200",
                                                    active ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-md" : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                                                )}>
                                                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center transition-colors text-[11px]",
                                                    active ? "bg-primary text-white" : "bg-sidebar-border/20")}>
                                                    <Icon className="h-3.5 w-3.5" />
                                                </div>
                                                {link.name}
                                                {active && <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50" />}
                                            </Link>
                                        </motion.div>
                                    );
                                })}
                            </nav>
                        </div>
                    ))}
                </div>

                {/* Bottom */}
                <div className="border-t border-sidebar-border p-3">
                    <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }} onClick={handleLogout}
                        className="flex items-center gap-3 w-full rounded-xl px-3 py-2 text-[12px] font-semibold text-sidebar-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <div className="h-7 w-7 rounded-lg bg-sidebar-border/20 flex items-center justify-center"><LogOut className="h-3.5 w-3.5" /></div>
                        Logout
                    </motion.button>
                </div>
            </aside>

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
                        <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="fixed inset-y-0 left-0 z-50 w-[280px] bg-sidebar-background flex flex-col md:hidden shadow-2xl">
                            <div className="flex h-[70px] items-center justify-between border-b border-sidebar-border px-5">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                                        <Shield className="h-5 w-5 text-white" />
                                    </div>
                                    <span className="text-[14px] font-bold text-sidebar-foreground">SWM Admin</span>
                                </div>
                                <button onClick={() => setSidebarOpen(false)} className="p-2 text-sidebar-foreground/50"><X className="h-5 w-5" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto py-3 px-3">
                                {navGroups.map((group) => (
                                    <div key={group.label} className="mb-4">
                                        <p className="text-[9px] font-black text-sidebar-foreground/30 uppercase tracking-[0.2em] px-3 mb-2">{group.label}</p>
                                        {group.links.map((link) => {
                                            const Icon = link.icon;
                                            const active = isActive(link.path);
                                            return (
                                                <Link key={link.path} to={link.path} onClick={() => setSidebarOpen(false)}
                                                    className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all mb-0.5",
                                                        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/50 hover:text-sidebar-foreground")}>
                                                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", active ? "bg-primary text-white" : "bg-sidebar-border/20")}>
                                                        <Icon className="h-3.5 w-3.5" />
                                                    </div>
                                                    {link.name}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                            <div className="p-3 border-t border-sidebar-border">
                                <button onClick={handleLogout} className="flex items-center gap-3 w-full rounded-xl px-3 py-2 text-[12px] font-semibold text-red-400 hover:bg-red-500/10 transition-all">
                                    <LogOut className="h-3.5 w-3.5" /> Logout
                                </button>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main */}
            <div className="flex flex-col flex-1 md:pl-[220px]">
                <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4 md:px-8">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 hover:bg-muted rounded-lg"><Menu className="h-5 w-5" /></button>
                        <div className="hidden md:block">
                            <h2 className="text-sm font-bold">{admin?.name || "Admin"}</h2>
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Global Admin Panel</p>
                        </div>
                    </div>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="relative p-2.5 bg-muted hover:bg-primary/15 rounded-xl transition-colors">
                        <Bell className="h-5 w-5 text-muted-foreground" />
                        <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-background animate-pulse" />
                    </motion.button>
                </header>

                <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
                    <div className="mx-auto w-full max-w-7xl">
                        <AnimatePresence mode="wait">
                            <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                                <Outlet />
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>

            {/* Mobile Bottom Nav */}
            <nav className="fixed bottom-0 z-50 w-full border-t border-border bg-background/95 backdrop-blur-xl px-1 pb-safe pt-1 md:hidden">
                <div className="flex items-center justify-between">
                    {[
                        { name: "Home", path: "/admin/dashboard", icon: LayoutDashboard },
                        { name: "Vendors", path: "/admin/vendors", icon: Store },
                        { name: "Bookings", path: "/admin/bookings", icon: CalendarRange },
                        { name: "Coupons", path: "/admin/coupons", icon: Ticket },
                        { name: "SOS", path: "/admin/sos", icon: ShieldAlert },
                    ].map((link) => {
                        const Icon = link.icon;
                        const active = isActive(link.path);
                        return (
                            <Link key={link.path} to={link.path} className="flex flex-col items-center justify-center py-1.5 px-1 flex-1">
                                <motion.div whileTap={{ scale: 0.85 }} className={cn("p-1.5 rounded-xl transition-all", active ? "bg-primary/15" : "")}>
                                    <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                                </motion.div>
                                <span className={cn("text-[8px] font-bold mt-0.5", active ? "text-primary" : "text-muted-foreground")}>{link.name}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default AdminLayout;
