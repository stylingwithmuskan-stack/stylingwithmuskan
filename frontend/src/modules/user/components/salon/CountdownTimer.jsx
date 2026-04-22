import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Zap } from "lucide-react";

const CountdownTimer = ({ endDate, compact = false, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  // Calculate time difference
  const calculateTimeLeft = (end) => {
    if (!end) return null;
    
    const now = new Date().getTime();
    const endTime = new Date(end).getTime();
    const diff = endTime - now;
    
    if (diff <= 0) return null; // Expired
    
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
      totalHours: Math.floor(diff / (1000 * 60 * 60))
    };
  };

  useEffect(() => {
    // Initial calculation
    const initialTimeLeft = calculateTimeLeft(endDate);
    setTimeLeft(initialTimeLeft);
    
    // If already expired, call onExpire immediately
    if (!initialTimeLeft && onExpire) {
      onExpire();
    }

    // Update every second
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(endDate);
      setTimeLeft(newTimeLeft);
      
      // Clear interval and call onExpire callback if expired
      if (!newTimeLeft) {
        clearInterval(timer);
        if (onExpire) {
          onExpire();
        }
      }
    }, 1000);

    // Cleanup on unmount
    return () => clearInterval(timer);
  }, [endDate, onExpire]);

  // Don't render if no time left or no endDate
  if (!timeLeft || !endDate) return null;

  const isUrgent = timeLeft.totalHours < 1;
  const isWarning = timeLeft.totalHours < 24;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: -10 }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          y: 0,
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3 }}
        className={`
          backdrop-blur-md rounded-xl px-3 py-2 
          border shadow-lg transition-all duration-300
          ${isUrgent 
            ? 'bg-red-500/90 border-red-400 animate-blink-urgent' 
            : isWarning 
              ? 'bg-orange-500/90 border-orange-400 animate-blink-warning' 
              : 'bg-black/60 border-white/20'
          }
        `}
      >
        <div className="flex items-center gap-1.5">
          {isUrgent ? (
            <Zap className="w-3 h-3 text-white animate-pulse" />
          ) : (
            <Clock className="w-3 h-3 text-white" />
          )}
          <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">
            {isUrgent ? "Ending Soon" : "Ends in"}
          </span>
        </div>
        
        <div className="flex items-center gap-1 mt-0.5">
          {timeLeft.days > 0 && (
            <TimeUnit value={timeLeft.days} unit={compact ? "d" : "days"} isBlinking={isUrgent} />
          )}
          <TimeUnit value={timeLeft.hours} unit={compact ? "h" : "hrs"} isBlinking={isUrgent} />
          <TimeUnit value={timeLeft.minutes} unit={compact ? "m" : "mins"} isBlinking={isUrgent} />
          <TimeUnit value={timeLeft.seconds} unit={compact ? "s" : "sec"} isBlinking={isUrgent} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

const TimeUnit = ({ value, unit, isBlinking = false }) => (
  <div className="flex items-baseline gap-0.5">
    <motion.span 
      animate={isBlinking ? { 
        scale: [1, 1.1, 1],
        opacity: [1, 0.8, 1]
      } : {}}
      transition={isBlinking ? {
        duration: 1,
        repeat: Infinity,
        ease: "easeInOut"
      } : {}}
      className="text-sm font-black text-white tabular-nums"
    >
      {String(value).padStart(2, '0')}
    </motion.span>
    <span className="text-[9px] font-bold text-white/70">
      {unit}
    </span>
  </div>
);

export default CountdownTimer;
