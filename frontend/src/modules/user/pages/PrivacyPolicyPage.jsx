import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Lock, Eye, FileText } from "lucide-react";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();
  const { gender } = useGenderTheme();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    { title: "Information We Collect", icon: FileText, content: "We collect information you provide directly to us, such as when you create an account, make a booking, or contact us. This may include your name, email, phone number, and location." },
    { title: "How We Use Your Data", icon: Eye, content: "We use your data to process bookings, provide customer support, and improve our services. We do not sell your personal data to third parties." },
    { title: "Data Security", icon: Lock, content: "We implement industry-standard security measures to protect your information from unauthorized access, disclosure, or alteration." },
    { title: "Your Rights", icon: ShieldCheck, content: "You have the right to access, correct, or delete your personal data. Contact our support team for any data-related requests." },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className={`text-lg font-semibold ${gender === "women" ? "font-display" : "font-heading-men"}`}>Privacy Policy</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto mt-6 space-y-6">
        <p className="text-sm text-muted-foreground italic">Last Updated: April 2026</p>
        {sections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-strong rounded-2xl p-5 border border-border/50 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <section.icon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-bold text-base text-foreground">{section.title}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {section.content}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
