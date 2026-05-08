import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, History, Calendar, CheckCircle2, Clock } from "lucide-react";

const VenderActivityPage = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const activities = [
    { id: 1, type: "provider", title: "New Provider Approved", status: "Completed", date: "Today, 11:30 AM", icon: CheckCircle2, color: "text-emerald-500" },
    { id: 2, type: "zone", title: "Zone Request Processed", status: "Success", date: "Yesterday", icon: Clock, color: "text-blue-500" },
    { id: 3, type: "booking", title: "Booking Assigned", status: "Active", date: "Today, 2:00 PM", icon: Calendar, color: "text-emerald-600" },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-gray-100 shadow-sm shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-900 hover:bg-slate-100 active:scale-90 transition-all border border-slate-100">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight">Activity</h1>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Recent logs</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 sm:py-8 max-w-2xl mx-auto space-y-3 sm:space-y-4">
        {activities.map((activity, i) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-2xl p-4 border border-border/50 flex items-center gap-4 shadow-sm"
          >
            <div className={`w-12 h-12 rounded-xl bg-accent flex items-center justify-center ${activity.color}`}>
              <activity.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm">{activity.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{activity.date}</p>
            </div>
            <div className="text-right">
              <span className={`text-[10px] font-black uppercase tracking-widest ${activity.color}`}>
                {activity.status}
              </span>
            </div>
          </motion.div>
        ))}

        {activities.length === 0 && (
          <div className="text-center py-20 opacity-50">
            <History className="w-12 h-12 mx-auto mb-4" />
            <p className="font-bold">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VenderActivityPage;
