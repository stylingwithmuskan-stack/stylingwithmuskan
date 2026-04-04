import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Scale, Info, CheckCircle2 } from "lucide-react";

const ProviderTermsConditionsPage = () => {
  const navigate = useNavigate();

  const terms = [
    { title: "Service Agreement", icon: Info, content: "As a service provider, you agree to deliver quality services to customers as per the booking details. Punctuality and professionalism are expected." },
    { title: "Payment Terms", icon: Scale, content: "Payments will be processed after successful service completion. Commission rates apply as per your subscription plan. Payouts are made weekly." },
    { title: "Quality Standards", icon: CheckCircle2, content: "Maintain high service quality standards. Customer ratings and feedback directly impact your profile visibility and booking opportunities." },
    { title: "Account Responsibility", icon: FileText, content: "You are responsible for maintaining account security and updating your availability calendar. Any misuse may result in account suspension." },
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
        <p className="text-sm text-muted-foreground italic px-2">Please read these terms carefully as a service provider.</p>
        {terms.map((term, i) => (
          <motion.div
            key={term.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-2xl p-5 border border-border/50 space-y-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <term.icon className="w-5 h-5 text-violet-600" />
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

export default ProviderTermsConditionsPage;
