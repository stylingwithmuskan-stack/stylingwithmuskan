import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { useAuth } from "@/modules/user/contexts/AuthContext";

import { api } from "@/modules/user/lib/api";

import { ChevronRight, Wallet, MapPin, Gift, Ticket, HelpCircle, LogOut, User, Calendar, Edit2, ShieldCheck, Zap, Sparkles, Bell, History, Info, FileText, Phone, Trash2, BellRing } from "lucide-react";
import NotificationDropdown from "@/modules/user/components/salon/NotificationDropdown";
import { safeStorage } from "@/modules/user/lib/safeStorage";
import { API_BASE_URL } from "@/modules/user/lib/api";

/**
 * ProfilePage Component
 * Displays user profile information, gender theme switcher, and navigation to sub-pages.
 */
const ProfilePage = () => {
  const navigate = useNavigate();
  const { gender, setGender } = useGenderTheme();
  const { user, logout, isLoggedIn, loading } = useAuth();
  const [walletBalance, setWalletBalance] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [menEnabled, setMenEnabled] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pushStatus, setPushStatus] = useState(""); // "", "sending", "sent", "error"
  const subscription = user?.subscription || null;
  const plusDiscount = Number(subscription?.discountPercentage || 0);
  const plusExpiry = user?.plusExpiry || subscription?.currentPeriodEnd || null;

  useEffect(() => {
    api.admin.getSystemSettings()
        .then(data => {
            setMenEnabled(data.settings?.menSectionEnabled || false);
        })
        .catch(() => setMenEnabled(false));
  }, []);

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigate("/login", { replace: true });
    }
  }, [loading, isLoggedIn, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!loading && isLoggedIn) {
          const { wallet } = await api.wallet();
          if (!cancelled) setWalletBalance(wallet?.balance ?? 0);
        }
      } catch {
        if (!cancelled) setWalletBalance(0);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, isLoggedIn]);

  const handleGenderSwitch = (g) => {
    if (g === "men" && !menEnabled) {
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 2500);
        return;
    }
    setGender(g);
  };

  const handleLogout = () => {
    console.log("[User] logout clicked");
    logout();
    navigate("/home");
  };

  const handleTestPush = async () => {
    setPushStatus("sending");
    try {
      const token = safeStorage.getItem("swm_token") || "";
      const res = await fetch(`${API_BASE_URL}/notifications/push/test-self`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });
      if (res.ok) {
        setPushStatus("sent");
      } else {
        setPushStatus("error");
      }
    } catch {
      setPushStatus("error");
    }
    setTimeout(() => setPushStatus(""), 3000);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/users/me/account`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to delete account' }));
        alert(data.error || 'Failed to delete account');
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }
      
      // Account deleted successfully
      logout();
      navigate('/home');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const menuItems = [
    { icon: Calendar, label: "My Bookings", desc: "View past & upcoming bookings", path: "/bookings" },
    { icon: Wallet, label: "Wallet", desc: walletBalance !== null ? `₹${walletBalance} balance` : "Loading balance...", path: "/wallet" },
    { icon: History, label: "Activity", desc: "View recent activity", path: "/activity" },
    { icon: MapPin, label: "Addresses", desc: "Manage saved addresses", path: "/addresses" },
    { icon: Gift, label: "Referral", desc: "Invite friends & earn", path: "/referral" },
    { icon: Ticket, label: "Coupons", desc: "Available offers", path: "/coupons" },
    { icon: Bell, label: "Notifications", desc: "Alerts & updates", path: "/notifications" },
    { icon: Info, label: "About Us", desc: "Learn more about Styling With Muskan", path: "/about-us" },
    { icon: Phone, label: "Contact Us", desc: "Reach out for help", path: "/contact-us" },
    { icon: ShieldCheck, label: "Privacy Policy", desc: "How we protect your data", path: "/privacy-policy" },
    { icon: FileText, label: "Terms & Conditions", desc: "Platform usage terms", path: "/terms-conditions" },
    { icon: HelpCircle, label: "Help & Support", desc: "FAQs, chat, call", path: "/support" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3 font-medium">
        <h1 className={`text-lg font-semibold flex-1 ${gender === "women" ? "font-display" : "font-heading-men"}`}>Profile</h1>
      </div>

      <div className="px-4 md:px-8 lg:px-0 max-w-2xl mx-auto mt-3 space-y-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-4 flex items-center justify-between border border-border/50 shadow-soft"
        >
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-theme flex items-center justify-center shadow-lg relative overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-primary-foreground" />
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center shadow-sm z-10">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-foreground">{user?.name || "User"}</h2>
                {user?.isVerified && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Verified</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{user?.phone || ""}</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/edit-profile")}
            className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center active:scale-95 transition-all"
          >
            <Edit2 className="w-5 h-5" />
          </button>
        </motion.div>

        {/* SWM Plus Subscription Banner */}
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => navigate('/plus-subscription')}
            className={`rounded-2xl p-4 md:p-5 relative overflow-hidden flex items-center justify-between cursor-pointer border shadow-sm transition-all hover:shadow-md
                ${user?.isPlusMember 
                    ? 'bg-slate-900 text-white border-slate-800' 
                    : 'bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border-indigo-500/20'}`}
        >
            <div className={`absolute top-0 right-0 p-8 opacity-10 ${user?.isPlusMember ? 'text-amber-400' : 'text-indigo-600'}`}>
                <Zap className="w-32 h-32" />
            </div>
            
            <div className="relative z-10 flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-black tracking-tight ${user?.isPlusMember ? 'text-amber-400' : 'text-indigo-900'} text-lg leading-none`}>
                        SWM Plus
                    </h3>
                    {user?.isPlusMember && (
                        <span className="bg-amber-400 text-slate-900 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">
                            Active
                        </span>
                    )}
                </div>
                {user?.isPlusMember ? (
                    <p className="text-xs font-medium text-slate-400 mt-1 max-w-[200px]">
                        Enjoying {plusDiscount || 10}% off with backend-managed SWM Plus benefits.
                    </p>
                ) : (
                    <p className="text-xs font-bold text-indigo-700/80 mt-1">
                        Get 10% to 15% off on eligible bookings
                    </p>
                )}
            </div>

            <div className="relative z-10 shrink-0">
                {user?.isPlusMember ? (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Valid Till</span>
                        <span className="text-sm font-black text-white">{plusExpiry ? new Date(plusExpiry).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : "N/A"}</span>
                    </div>
                ) : (
                    <div className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/30 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Join Now
                    </div>
                )}
            </div>
        </motion.div>
        
        {/* Refer & Earn Banner */}
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            onClick={() => navigate('/referral')}
            className="rounded-2xl p-4 md:p-5 relative overflow-hidden flex items-center justify-between cursor-pointer border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 shadow-sm transition-all hover:shadow-md h-24"
        >
            <div className="absolute top-0 right-0 p-4 opacity-10 text-primary">
                <Gift className="w-20 h-20" />
            </div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black tracking-tight text-primary text-lg leading-none">
                        Refer & Earn
                    </h3>
                    <span className="bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">
                        ₹100 Per Friend
                    </span>
                </div>
                <p className="text-xs font-medium text-muted-foreground mt-1 max-w-[200px]">
                    Invite friends and get ₹100 in your wallet when they sign up!
                </p>
            </div>

            <div className="relative z-10 shrink-0">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md text-primary group-hover:scale-110 transition-transform">
                    <ChevronRight className="w-6 h-6" />
                </div>
            </div>
        </motion.div>

        {/* Gender Switch */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-strong rounded-2xl p-4 border border-border/50 relative overflow-hidden"
        >
          <p className="text-[10px] font-bold mb-3 uppercase tracking-widest text-muted-foreground">Service Category</p>
          <div className="flex gap-3 relative z-10">
            {["women", "men"].map((g) => (
              <button
                key={g}
                onClick={() => handleGenderSwitch(g)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${gender === g
                  ? "bg-primary text-primary-foreground border-primary glow-primary shadow-lg"
                  : "bg-accent text-accent-foreground border-transparent opacity-60"
                  }`}
              >
                {g === "women" ? "👩 Women" : "👨 Men"}
              </button>
            ))}
          </div>

          <AnimatePresence>
              {showPopup && (
                  <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, y: 10 }} 
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm p-4"
                  >
                      <p className="font-bold text-foreground text-sm">🚧 Currently Unavailable</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 text-center font-medium">This service category is launching soon!</p>
                  </motion.div>
              )}
          </AnimatePresence>
        </motion.div>

        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map((item, i) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.03 }}
              onClick={item.onClick ? item.onClick : () => navigate(item.path)}
              className="w-full glass-strong rounded-[20px] p-3 flex items-center gap-4 hover:bg-accent/50 transition-all border border-border/40 hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold">{item.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-40" />
            </motion.button>
          ))}
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full glass-strong rounded-[20px] p-3 flex items-center gap-4 text-destructive hover:bg-destructive/10 transition-all border border-destructive/10 group active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            <LogOut className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold">Logout</span>
        </button>

        {/* Delete Account Button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full glass-strong rounded-[20px] p-3 flex items-center gap-4 text-red-600 hover:bg-red-50 transition-all border border-red-200 group active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            <Trash2 className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold">Delete Account</span>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl p-6 max-w-sm w-full border border-border shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold">Delete Account?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              This action cannot be undone. All your data including bookings history, addresses, and wallet balance will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl bg-accent text-accent-foreground font-bold hover:bg-accent/80 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center p-4">
        <div className="pointer-events-auto">
          <NotificationDropdown isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
