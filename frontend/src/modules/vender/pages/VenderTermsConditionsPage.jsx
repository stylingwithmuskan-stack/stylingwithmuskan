import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Scale, Info, CheckCircle2 } from "lucide-react";

const VenderTermsConditionsPage = () => {
  const navigate = useNavigate();

  const terms = [
    { title: "Vendor Agreement", icon: Info, content: "As a city vendor, you agree to manage service providers in your assigned zones and ensure quality service delivery to customers." },
    { title: "Payment & Commission", icon: Scale, content: "Commission structure and payment terms are defined in your vendor agreement. Payouts are processed monthly based on completed bookings." },
    { title: "Quality Management", icon: CheckCircle2, content: "You are responsible for maintaining service quality standards, provider verification, and handling customer complaints in your zones." },
    { title: "Account Responsibilities", icon: FileText, content: "Maintain accurate records, approve/reject provider applications promptly, and ensure compliance with platform policies." },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-semibold">Terms & Conditions</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto mt-6 space-y-6">
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
