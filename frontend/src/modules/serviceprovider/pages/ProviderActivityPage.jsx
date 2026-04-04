import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, History, Calendar, CheckCircle2, Clock } from "lucide-react";

const ProviderActivityPage = () => {
  const navigate = useNavigate();

  const activities = [
    { id: 1, type: "booking", title: "Booking Completed", status: "Completed", date: "Today, 11:30 AM", icon: CheckCircle2, color: "text-emerald-500" },
    { id: 2, type: "wallet", title: "Payment Received", status: "Success", date: "Yesterday", icon: Clock, color: "text-blue-500" },
    { id: 3, type: "booking", title: "Upcoming Booking", status: "Scheduled", date: "Tomorrow, 2:00 PM", icon: Calendar, color: "text-violet-600" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-semibold">Recent Activity</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto mt-6 space-y-4">
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

export default ProviderActivityPage;
