import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // Only log 404s in development to keep production console clean
    if (import.meta.env.DEV) {
      console.warn("404 Error: Non-existent route:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdf8f6] p-6 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center text-4xl mb-8 border border-pink-100"
      >
        🔍
      </motion.div>
      <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">PAGE NOT FOUND</h1>
      <p className="text-gray-500 max-w-xs mx-auto mb-8 text-sm font-medium">
        The path <code className="bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded font-bold">{location.pathname}</code> doesn't seem to exist in our application.
      </p>
      <a
        href="/"
        className="inline-flex items-center gap-2 px-8 py-4 bg-[#e65689] text-white rounded-2xl font-black text-sm shadow-lg shadow-pink-200 hover:scale-105 transition-all active:scale-95"
      >
        RETURN HOME
      </a>
    </div>
  );
};
export default NotFound;
