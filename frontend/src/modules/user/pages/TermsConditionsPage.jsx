import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Scale, Info, CheckCircle2 } from "lucide-react";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";

const TermsConditionsPage = () => {
  const navigate = useNavigate();
  const { gender } = useGenderTheme();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const terms = [
    { title: "Booking Policies", icon: Info, content: "Bookings can be made up to 7 days in advance. Cancellations must be done at least 4 hours prior to the scheduled service time to avoid cancellation fees." },
    { title: "Service Quality", icon: CheckCircle2, content: "We ensure all service providers are verified and trained. However, users are encouraged to provide feedback to maintain platform quality." },
    { title: "Payment Terms", icon: Scale, content: "Payments can be made via wallet or integrated payment gateways. Advance payments are non-refundable in case of last-minute cancellations." },
    { title: "Account Responsibility", icon: FileText, content: "Users are responsible for maintaining the confidentiality of their account credentials and for all activities that occur under their account." },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>Terms & Conditions</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto mt-6 space-y-6">
        <p className="text-sm text-muted-foreground italic px-2">Please read these terms carefully before using our services.</p>
        {terms.map((term, i) => (
          <motion.div
            key={term.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-strong rounded-2xl p-5 border border-border/50 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <term.icon className="w-5 h-5 text-primary" />
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

export default TermsConditionsPage;
