import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Lock, Eye, FileText } from "lucide-react";

const VenderPrivacyPolicyPage = () => {
  const navigate = useNavigate();

  const sections = [
    { title: "Information We Collect", icon: FileText, content: "We collect your business details, operational data, provider information, and transaction records to facilitate city-level management." },
    { title: "How We Use Your Data", icon: Eye, content: "Your data is used to manage service providers, process bookings, handle payments, and generate business insights for your operations." },
    { title: "Data Security", icon: Lock, content: "We implement enterprise-grade security measures to protect your business data and ensure compliance with data protection regulations." },
    { title: "Your Rights", icon: ShieldCheck, content: "You have the right to access, update, or export your business data. Contact support for any data-related requests." },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-semibold">Privacy Policy</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto mt-6 space-y-6">
        <p className="text-sm text-muted-foreground italic">Last Updated: April 2026</p>
        {sections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-2xl p-5 border border-border/50 space-y-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <section.icon className="w-5 h-5 text-emerald-600" />
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

export default VenderPrivacyPolicyPage;
