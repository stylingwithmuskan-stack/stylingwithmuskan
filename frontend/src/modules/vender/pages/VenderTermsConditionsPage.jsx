import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Scale, Info, CheckCircle2 } from "lucide-react";

const VenderTermsConditionsPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const terms = [
    { title: "Vendor Agreement", icon: Info, content: "As a city vendor, you agree to manage service providers in your assigned zones and ensure quality service delivery to customers." },
    { title: "Payment & Commission", icon: Scale, content: "Commission structure and payment terms are defined in your vendor agreement. Payouts are processed monthly based on completed bookings." },
    { title: "Quality Management", icon: CheckCircle2, content: "You are responsible for maintaining service quality standards, provider verification, and handling customer complaints in your zones." },
    { title: "Account Responsibilities", icon: FileText, content: "Maintain accurate records, approve/reject provider applications promptly, and ensure compliance with platform policies." },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 pt-10">
      <div className="px-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8 px-2">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h1 className="text-2xl font-black text-slate-900 text-sm md:text-2xl uppercase md:normal-case">Terms & Conditions</h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Partner Agreement</p>
            </div>
        </div>
        <p className="text-sm text-muted-foreground italic px-2">Please read these terms carefully as a vendor partner.</p>
        {terms.map((term, i) => (
          <motion.div
            key={term.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-2xl p-5 border border-border/50 space-y-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <term.icon className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="font-bold text-base text-foreground">{term.title}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {term.content}
            </p>
          </motion.div>
        ))}
        
        <div className="pt-10 pb-20 text-center opacity-30 text-xs font-bold uppercase tracking-[4px]">
            Styling With Muskan © 2026
        </div>
      </div>
    </div>
  );
};

export default VenderTermsConditionsPage;
