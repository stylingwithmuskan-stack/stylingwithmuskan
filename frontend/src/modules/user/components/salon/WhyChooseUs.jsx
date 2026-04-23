import { motion } from "framer-motion";
import { ShieldCheck, Award, Sparkles, Heart, Clock, CheckCircle2 } from "lucide-react";
import { useGenderTheme } from "@/modules/user/contexts/GenderThemeContext";

const features = [
  {
    icon: Award,
    title: "Expert Pros",
    desc: "Top 1% vetted talent",
    color: "from-amber-500 to-orange-500"
  },
  {
    icon: ShieldCheck,
    title: "100% Hygienic",
    desc: "Sanitized everything",
    color: "from-blue-500 to-cyan-500"
  },
  {
    icon: Sparkles,
    title: "Branded Kit",
    desc: "Original products only",
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: Clock,
    title: "On-Time",
    desc: "Or get ₹100 credit",
    color: "from-emerald-500 to-green-500"
  },
];

const WhyChooseUs = () => {
  const { gender } = useGenderTheme();

  return (
    <div className="px-4 mt-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-lg font-bold ${gender === "women" ? "font-display" : "font-heading-men"}`}>
          stylingwithmuskan Trust
        </h2>
        <div className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3" />
          VERIFIED
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -5 }}
            className="flex-shrink-0 w-36 md:w-44 glass-strong rounded-2xl p-4 flex flex-col items-center text-center border border-border/50 hover:border-primary/30 transition-all duration-300"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-3 shadow-lg shadow-black/5`}>
              <f.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-[13px] leading-tight">{f.title}</h3>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>

    </div>
  );
};

export default WhyChooseUs;

