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
    <div className="min-h-screen bg-[#F8FAFC] pb-24 pt-10">
      <div className="px-4 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-4 mb-8 px-2">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50">
               <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h1 className="text-2xl font-black text-slate-900">Activity</h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Recent logs</p>
            </div>
        </div>
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
