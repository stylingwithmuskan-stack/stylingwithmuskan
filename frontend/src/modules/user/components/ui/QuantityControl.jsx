import { motion } from "framer-motion";
import { Plus, Minus } from "lucide-react";

const QuantityControl = ({ 
  quantity = 1, 
  onIncrement, 
  onDecrement, 
  size = "sm",
  className = "" 
}) => {
  const sizeClasses = {
    sm: {
      button: "w-7 h-7",
      icon: "w-3.5 h-3.5",
      text: "text-sm",
      gap: "gap-1.5"
    },
    md: {
      button: "w-8 h-8",
      icon: "w-4 h-4",
      text: "text-base",
      gap: "gap-2"
    },
    lg: {
      button: "w-10 h-10",
      icon: "w-5 h-5",
      text: "text-lg",
      gap: "gap-2.5"
    }
  };

  const styles = sizeClasses[size] || sizeClasses.sm;

  const handleDecrement = (e) => {
    e.stopPropagation();
    if (onDecrement) onDecrement();
  };

  const handleIncrement = (e) => {
    e.stopPropagation();
    if (onIncrement) onIncrement();
  };

  return (
    <div className={`flex items-center ${styles.gap} ${className}`}>
      {/* Minus Button */}
      <button
        onClick={handleDecrement}
        className={`${styles.button} rounded-lg border-2 border-primary/20 bg-white text-primary 
                   hover:bg-primary hover:text-white hover:border-primary
                   transition-all duration-200 active:scale-95 
                   flex items-center justify-center shadow-sm
                   disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label="Decrease quantity"
      >
        <Minus className={styles.icon} strokeWidth={2.5} />
      </button>

      {/* Quantity Display with Animation */}
      <motion.div
        key={quantity}
        initial={{ scale: 1.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`w-8 text-center ${styles.text} font-black text-primary`}
      >
        {quantity}
      </motion.div>

      {/* Plus Button */}
      <button
        onClick={handleIncrement}
        className={`${styles.button} rounded-lg border-2 border-primary 
                   bg-primary text-white hover:bg-primary/90 
                   transition-all duration-200 active:scale-95 
                   flex items-center justify-center shadow-sm
                   disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label="Increase quantity"
      >
        <Plus className={styles.icon} strokeWidth={2.5} />
      </button>
    </div>
  );
};

export default QuantityControl;
