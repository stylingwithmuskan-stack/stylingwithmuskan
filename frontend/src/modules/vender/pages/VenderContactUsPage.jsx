import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Mail, Phone, MessageSquare, 
  MapPin, ExternalLink, Send, CheckCircle2, 
  Building2, User, Landmark, Globe
} from "lucide-react";

const VenderContactUsPage = () => {
  const navigate = useNavigate();
  const [formState, setFormState] = useState("idle"); // idle, submitting, success
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    businessType: "Salon",
    message: ""
  });

  const contacts = [
    { icon: Phone, label: "Call Vendor Support", value: "+91 999 000 0003", action: "tel:+919990000003", color: "bg-emerald-100 text-emerald-600" },
    { icon: Mail, label: "Email Support", value: "vendor@swm.com", action: "mailto:vendor@swm.com", color: "bg-blue-100 text-blue-600" },
    { icon: MapPin, label: "Head Office", value: "Main Market, Sector 15, Gurgaon", action: "#", color: "bg-purple-100 text-purple-600" },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormState("submitting");
    // Simulate API call
    setTimeout(() => {
      setFormState("success");
    }, 1500);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Vendor Support</h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Contact & Inquiries</p>
          </div>
        </div>
      </div>

      <div className="px-4 max-w-4xl mx-auto mt-8 flex flex-col gap-8">
        {/* Hero Section */}
        <div className="text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 rounded-[2rem] bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-200"
          >
            <Building2 className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-3xl font-black text-slate-900 leading-tight">Partner with SWM</h2>
          <p className="text-slate-500 mt-3 max-w-sm mx-auto">
            Ready to grow your business? Reach out to our dedicated vendor success team for any assistance or partnership inquiries.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Contact Form */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              {formState !== "success" ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100"
                >
                  <h3 className="text-xl font-bold text-slate-900 mb-6">Send us a message</h3>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            required
                            type="text" 
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="John Doe"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Business Email</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            required
                            type="email" 
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="business@example.com"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            required
                            type="tel" 
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+91 98765 43210"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Company Name</label>
                        <div className="relative">
                          <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            required
                            type="text" 
                            name="company"
                            value={formData.company}
                            onChange={handleChange}
                            placeholder="Your Salon Name"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Business Type</label>
                      <select 
                        name="businessType"
                        value={formData.businessType}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium appearance-none"
                      >
                        <option>Salon</option>
                        <option>Spa</option>
                        <option>Freelance Artist</option>
                        <option>Agency</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Message</label>
                      <textarea 
                        required
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows={4}
                        placeholder="Tell us about your requirements..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                      ></textarea>
                    </div>

                    <button 
                      disabled={formState === "submitting"}
                      type="submit"
                      className="w-full bg-emerald-600 text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-100 disabled:opacity-70"
                    >
                      {formState === "submitting" ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Submit Inquiry
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-[2.5rem] p-12 shadow-sm border border-slate-100 text-center flex flex-col items-center justify-center min-h-[500px]"
                >
                  <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-6">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Message Sent!</h3>
                  <p className="text-slate-500 max-w-xs mx-auto mb-8">
                    Thank you for reaching out. Our team will review your inquiry and get back to you within 24 hours.
                  </p>
                  <button 
                    onClick={() => setFormState("idle")}
                    className="text-emerald-600 font-bold hover:underline"
                  >
                    Send another message
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Contact Cards */}
          <div className="lg:col-span-2 space-y-4">
            {contacts.map((contact, i) => (
              <motion.div
                key={contact.label}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => contact.action.startsWith("/") ? navigate(contact.action) : window.open(contact.action, "_blank")}
                className="bg-white rounded-3xl p-6 border border-slate-100 flex items-center gap-5 cursor-pointer hover:border-emerald-200 hover:bg-emerald-50/30 transition-all active:scale-[0.98] shadow-sm group"
              >
                <div className={`w-14 h-14 rounded-2xl ${contact.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <contact.icon className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{contact.label}</p>
                  <p className="font-bold text-slate-900 text-sm">{contact.value}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </motion.div>
            ))}

            {/* Social Connect */}
            <div className="mt-8 bg-slate-900 rounded-[2.5rem] p-8 text-white">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                Join our community
              </h4>
              <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                Stay updated with the latest trends and business tips for beauty professionals.
              </p>
              <div className="flex gap-4">
                {["Instagram", "LinkedIn", "Twitter"].map((social) => (
                  <button key={social} className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-colors">
                    {social.slice(0, 2)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenderContactUsPage;
