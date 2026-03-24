import React from "react";
import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  CalendarClock,
  BarChart2,
  User,
  Settings,
  Bell,
  CalendarRange
} from "lucide-react";
import { cn } from "@/modules/user/lib/utils";
import { useProviderAuth } from "../contexts/ProviderAuthContext";
import { api } from "@/modules/user/lib/api";

// Fallback cn if needed, but normally it's at @/lib/utils in these setups
// If not, we can just use template literals. Assuming standard shadcn template.

const ProviderLayout = () => {
  const location = useLocation();

  const navLinks = [
    { name: "Dashboard", path: "/provider/dashboard", icon: LayoutDashboard },
    { name: "Bookings", path: "/provider/bookings", icon: CalendarRange },
    { name: "Availability", path: "/provider/availability", icon: CalendarClock },
    { name: "Performance", path: "/provider/performance", icon: BarChart2 },
    { name: "Profile", path: "/provider/profile", icon: User },
    { name: "Admin", path: "/provider/admin", icon: Settings },
  ];

  const isActive = (path) => location.pathname === path;

  const { provider, isLoggedIn, hydrated } = useProviderAuth();
  const safeProvider = provider || {};
  const name = safeProvider.name || "stylingwithmuskan";
  const profileImage = safeProvider.profilePhoto || "/logo1.png";

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isLoggedIn) {
    return <Navigate to="/provider/login" replace />;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40 md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link to="/provider/profile" className="flex items-center gap-3 group px-1">
            <div className="relative">
              <img src={profileImage} alt="Logo" className="h-12 w-12 rounded-full object-cover border-2 border-primary/20 shadow-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" onError={(e) => { e.target.onerror = null; e.target.src = '/logo1.png' }} />
              <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-bold leading-none text-gray-900 tracking-tight group-hover:text-purple-700 transition-colors w-32 truncate">{name}</span>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-[1px] w-3 bg-purple-300"></div>
                <span className="text-[9px] font-black uppercase text-purple-600 tracking-[0.25em] leading-none">Professional</span>
              </div>
            </div>
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${isActive(link.path)
                    ? "bg-muted text-primary"
                    : "text-muted-foreground"
                    }`}
                >
                  <Icon className="h-5 w-5" />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 md:pl-64">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 md:hidden">
          <Link to="/provider/profile" className="flex items-center gap-3 group max-w-[70%]">
            <div className="relative shrink-0">
              <img src={profileImage} alt="Logo" className="h-10 w-10 rounded-full object-cover border-2 border-primary/20 shadow-md" onError={(e) => { e.target.onerror = null; e.target.src = '/logo1.png' }} />
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] font-bold leading-none text-gray-900 tracking-tight truncate">{name}</span>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[8px] font-black uppercase text-purple-600 tracking-[0.2em] leading-none">Professional</span>
              </div>
            </div>
          </Link>

          {/* Right side icons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.confirm("EMERGENCY: Do you want to trigger SOS alert?")) {
                  api.sos.create({ userType: "beautician", userId: safeProvider?._id || safeProvider?.id || "sp_demo", source: "provider-app" })
                    .then(() => alert("SOS Alert Sent! Emergency team notified."))
                    .catch(() => alert("Failed to send SOS"));
                }
              }}
              className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
              title="Emergency SOS"
            >
              <Bell className="h-5 w-5 animate-pulse" />
            </button>
            <Link to="/provider/credits" className="p-2 bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100 transition-colors">
              <Wallet className="h-5 w-5" />
            </Link>
            <button className="p-2 bg-gray-50 text-gray-600 rounded-full relative hover:bg-gray-100 transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border border-white"></span>
            </button>
          </div>
        </header>

        <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 md:p-8 pb-20 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 z-50 w-full border-t bg-background px-2 pb-safe pt-2 md:hidden">
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex flex-col items-center justify-center min-w-[4.5rem] p-1 gap-1 flex-1 rounded-lg ${active ? "text-purple-600" : "text-muted-foreground"
                  }`}
              >
                <div className={`p-1.5 rounded-full ${active ? "bg-purple-100 dark:bg-purple-900/30" : ""}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium truncate w-full text-center">
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

export default ProviderLayout;
