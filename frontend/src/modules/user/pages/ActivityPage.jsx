import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, History, Calendar, CheckCircle2, Clock, Wallet, Sparkles } from "lucide-react";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";
import { api } from "@/modules/user/lib/api";
import { Skeleton } from "@/modules/user/components/ui/skeleton";

const TYPE_ICONS = {
  booking: Calendar,
  wallet: Wallet,
  subscription: Sparkles,
  default: CheckCircle2
};

const ActivityPage = () => {
  const navigate = useNavigate();
  const { gender } = useGenderTheme();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        const res = await api.activity();
        if (res?.activities) {
          setActivities(res.activities);
        }
      } catch (error) {
        console.error("Failed to load activity:", error);
      } finally {
        setLoading(false);
      }
    };
    loadActivity();
  }, []);

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        return `Today, ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
      }
      return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>Recent Activity</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto mt-6 space-y-4">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-strong rounded-2xl p-4 border border-border/50 flex items-center gap-4">
               <Skeleton className="w-12 h-12 rounded-xl" />
               <div className="flex-1 space-y-2">
                 <Skeleton className="h-4 w-1/2" />
                 <Skeleton className="h-3 w-1/3" />
               </div>
            </div>
          ))
        ) : activities.length > 0 ? (
          activities.map((activity, i) => {
            const Icon = TYPE_ICONS[activity.type] || TYPE_ICONS.default;
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-strong rounded-2xl p-4 border border-border/50 flex items-center gap-4"
              >
                <div className={`w-12 h-12 rounded-xl bg-accent flex items-center justify-center ${activity.color || "text-primary"}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm">{activity.title}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(activity.date)}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${activity.color || "text-primary"}`}>
                    {activity.status}
                  </span>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-20 opacity-50">
            <History className="w-12 h-12 mx-auto mb-4" />
            <p className="font-bold">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityPage;
