import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, Briefcase, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Card, CardContent } from "@/modules/user/components/ui/card";

export default function RoleSelectionPage() {
    const navigate = useNavigate();

    useEffect(() => {
        // Remove any theme classes
        document.documentElement.classList.remove("theme-women", "theme-men", "theme-beautician", "theme-admin", "theme-vendor");
    }, []);

    const roles = [
        {
            id: "vendor",
            title: "Vendor",
            subtitle: "Zone Manager",
            description: "Manage service providers, zones, and bookings in your city",
            icon: Store,
            gradient: "from-emerald-500 to-teal-600",
            bgGradient: "from-emerald-50 via-teal-50/30 to-white",
            path: "/vender/login",
            features: ["Manage Zones", "Oversee Providers", "Track Bookings", "Earn Commission"]
        },
        {
            id: "provider",
            title: "Service Provider",
            subtitle: "Beauty Professional",
            description: "Offer beauty services, manage bookings, and grow your business",
            icon: Briefcase,
            gradient: "from-blue-500 to-indigo-600",
            bgGradient: "from-blue-50 via-indigo-50/30 to-white",
            path: "/provider/login",
            features: ["Accept Bookings", "Manage Schedule", "Earn Income", "Build Portfolio"]
        }
    ];

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-5xl"
            >
                {/* Header */}
                <div className="text-center mb-12">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.2 }}
                        className="h-20 w-20 rounded-3xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-purple-200"
                    >
                        <Sparkles className="h-10 w-10 text-white" />
                    </motion.div>
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-3">
                        Join StylingWithMuskan
                    </h1>
                    <p className="text-lg text-gray-600 font-medium">
                        Choose your role to get started
                    </p>
                </div>

                {/* Role Cards */}
                <div className="grid md:grid-cols-2 gap-6">
                    {roles.map((role, index) => (
                        <motion.div
                            key={role.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + index * 0.1 }}
                        >
                            <Card className="border-2 hover:border-gray-300 transition-all duration-300 hover:shadow-2xl group cursor-pointer overflow-hidden">
                                <CardContent className="p-0">
                                    <div className={`bg-gradient-to-br ${role.bgGradient} p-8`}>
                                        {/* Icon */}
                                        <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${role.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                            <role.icon className="h-8 w-8 text-white" />
                                        </div>

                                        {/* Title */}
                                        <h2 className="text-2xl font-black text-gray-900 mb-1">
                                            {role.title}
                                        </h2>
                                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                                            {role.subtitle}
                                        </p>

                                        {/* Description */}
                                        <p className="text-gray-600 mb-6 leading-relaxed">
                                            {role.description}
                                        </p>

                                        {/* Features */}
                                        <div className="space-y-2 mb-6">
                                            {role.features.map((feature, i) => (
                                                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                                                    <div className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${role.gradient}`} />
                                                    <span>{feature}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Button */}
                                        <Button
                                            onClick={() => navigate(role.path)}
                                            className={`w-full h-12 rounded-xl font-bold text-base bg-gradient-to-r ${role.gradient} hover:opacity-90 transition-opacity shadow-lg group-hover:shadow-xl`}
                                        >
                                            Continue as {role.title}
                                            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-center mt-8"
                >
                    <p className="text-sm text-gray-500">
                        Looking for beauty services?{" "}
                        <button
                            onClick={() => navigate("/home")}
                            className="text-pink-600 font-semibold hover:underline"
                        >
                            Browse as Customer
                        </button>
                    </p>
                </motion.div>
            </motion.div>
        </div>
    );
}
