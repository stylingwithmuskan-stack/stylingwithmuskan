import React from "react";
import { motion } from "framer-motion";
import { 
    Calendar, Clock, ChevronRight, Star, Users, LayoutGrid, CheckCircle2
} from "lucide-react";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";

const CustomEnquiryDetailsModal = ({ isOpen, onClose, enquiry }) => {
    const { services: globalServices } = useUserModuleData();

    if (!isOpen || !enquiry) return null;

    const getPhaseColor = (phase) => {
        switch (phase) {
            case "pricing": return "bg-green-100 text-green-700";
            case "payment": return "bg-amber-100 text-amber-700";
            case "team_pending": return "bg-blue-100 text-blue-700";
            case "team_review": return "bg-cyan-100 text-cyan-700";
            case "final": return "bg-emerald-100 text-emerald-700";
            case "vendor_pricing": return "bg-amber-100 text-amber-700";
            case "expired": return "bg-red-100 text-red-700";
            default: return "bg-primary/10 text-primary";
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-background w-full max-w-2xl rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                    <div>
                        <h3 className="text-xl font-black font-display">{enquiry.eventType}</h3>
                        <p className="text-xs text-muted-foreground mt-1">Enquiry ID: {String(enquiry._id || enquiry.id || "").slice(-8)}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 rotate-90" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                        <span className={`text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full ${getPhaseColor(enquiry.displayPhase)}`}>
                            {enquiry.statusLabel || enquiry.status || "Pending Review"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Sent on {new Date(enquiry.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                    </div>

                    {/* Schedule & Details Grid */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                            <p className="text-xs font-black uppercase text-muted-foreground mb-3">Preferred Schedule</p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-bold">
                                    <Calendar className="w-4 h-4 text-primary" />
                                    {enquiry.scheduledAt?.date || enquiry.date || enquiry.slot?.date}
                                </div>
                                <div className="flex items-center gap-2 text-sm font-bold">
                                    <Clock className="w-4 h-4 text-primary" />
                                    {enquiry.scheduledAt?.timeSlot || enquiry.timeSlot || enquiry.slot?.time}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                            <p className="text-xs font-black uppercase text-muted-foreground mb-3">Event Details</p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-bold">
                                    <Users className="w-4 h-4 text-primary" />
                                    {enquiry.noOfPeople} People
                                </div>
                                {enquiry.quote?.totalServiceTime && (
                                    <div className="flex items-center gap-2 text-sm font-bold">
                                        <Clock className="w-4 h-4 text-primary" />
                                        {enquiry.quote.totalServiceTime}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Pricing Details */}
                    {((enquiry.quote?.totalAmount || enquiry.totalAmount || 0) > 0) && (
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                            <p className="text-xs font-black uppercase text-primary mb-3">Pricing Breakdown</p>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Total Amount</span>
                                    <span className="text-lg font-black text-primary">
                                        ₹{(enquiry.quote?.totalAmount || enquiry.totalAmount || 0).toLocaleString()}
                                    </span>
                                </div>
                                {((enquiry.quote?.discountPrice || enquiry.discountPrice || 0) > 0) && (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Discount</span>
                                            <span className="text-sm font-bold text-green-600">
                                                -₹{(enquiry.quote?.discountPrice || enquiry.discountPrice || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                                            <span className="text-sm font-bold">Final Amount</span>
                                            <span className="text-xl font-black text-emerald-600">
                                                ₹{((enquiry.quote?.totalAmount || enquiry.totalAmount || 0) - (enquiry.quote?.discountPrice || enquiry.discountPrice || 0)).toLocaleString()}
                                            </span>
                                        </div>
                                    </>
                                )}
                                {(enquiry.quote?.prebookAmount || 0) > 0 && (
                                    <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                                        <span className="text-sm font-bold text-amber-700">Advance Required</span>
                                        <span className="text-lg font-black text-amber-700">
                                            ₹{(enquiry.quote?.prebookAmount || 0).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Payment Status (After Acceptance) */}
                    {enquiry.paymentStatus && enquiry.paymentStatus !== "pending" && (
                        <div className="p-4 bg-green-50 rounded-2xl border border-green-200">
                            <p className="text-xs font-black uppercase text-green-600 mb-3 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> Payment Status
                            </p>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Status</span>
                                    <span className={`text-sm font-black uppercase px-3 py-1 rounded-full ${
                                        enquiry.paymentStatus === "paid" ? "bg-green-600 text-white" : 
                                        enquiry.paymentStatus === "refunded" ? "bg-red-600 text-white" : 
                                        "bg-amber-600 text-white"
                                    }`}>
                                        {enquiry.paymentStatus}
                                    </span>
                                </div>
                                {enquiry.prebookAmountPaid > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Advance Paid</span>
                                        <span className="text-lg font-black text-green-600">
                                            ₹{enquiry.prebookAmountPaid.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {enquiry.prebookPaidAt && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Paid On</span>
                                        <span className="text-xs font-bold">
                                            {new Date(enquiry.prebookPaidAt).toLocaleDateString('en-IN', { 
                                                day: 'numeric', 
                                                month: 'short', 
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Service Category & Services */}
                    {(enquiry.categoryName || enquiry.selectedServices) && (
                        <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                            <p className="text-xs font-black uppercase text-purple-600 mb-3 flex items-center gap-1">
                                <LayoutGrid className="h-4 w-4" /> Service Details
                            </p>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Category</p>
                                    <p className="text-sm font-bold">{enquiry.categoryName || enquiry.serviceType}</p>
                                </div>
                                {enquiry.selectedServices && enquiry.selectedServices.length > 0 && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2">Requested Services</p>
                                        <div className="space-y-2">
                                            {enquiry.selectedServices.map((s, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-2 bg-white border border-purple-200 rounded-xl">
                                                    {(s.image || globalServices?.find(gs => gs.id === s.id)?.image) && (
                                                        <img 
                                                            src={s.image || globalServices?.find(gs => gs.id === s.id)?.image} 
                                                            alt={s.name} 
                                                            className="w-10 h-10 rounded-lg object-cover bg-accent"
                                                        />
                                                    )}
                                                    <div>
                                                        <p className="text-xs font-bold text-purple-700">{s.name}</p>
                                                        {s.quantity > 1 && <p className="text-[10px] text-muted-foreground">Quantity: {s.quantity}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Provider & Team Members */}
                    {(enquiry.assignedProvider || enquiry.maintainerProvider || (enquiry.teamMembers && enquiry.teamMembers.length > 0)) && (
                        <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                            <p className="text-xs font-black uppercase text-emerald-600 mb-3 flex items-center gap-1">
                                <Users className="h-4 w-4" /> {enquiry.teamMembers && enquiry.teamMembers.length > 0 ? 'Assigned Team' : 'Assigned Provider'}
                            </p>
                            
                            {/* Main Provider */}
                            {(enquiry.assignedProvider || enquiry.maintainerProvider) && !(enquiry.teamMembers && enquiry.teamMembers.length > 0) && (
                                <div className="p-3 bg-white border border-emerald-200 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <Star className="w-5 h-5 text-emerald-600 fill-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">Professional Assigned</p>
                                            <p className="text-xs text-muted-foreground">Provider ID: {enquiry.assignedProvider || enquiry.maintainerProvider}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Team Members */}
                            {enquiry.teamMembers && enquiry.teamMembers.length > 0 && (
                                <div className="grid grid-cols-2 gap-2">
                                    {enquiry.teamMembers.map((m, idx) => (
                                        <div key={idx} className="p-3 bg-white border border-emerald-200 rounded-xl">
                                            <p className="text-sm font-bold">{m.name}</p>
                                            <p className="text-xs text-muted-foreground">{m.serviceType}</p>
                                            {m.id === enquiry.maintainProvider && (
                                                <span className="inline-block mt-1 text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                                                    LEAD
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Customer Notes */}
                    {enquiry.notes && (
                        <div className="p-4 bg-accent/40 rounded-2xl border border-border">
                            <p className="text-xs font-black uppercase text-muted-foreground mb-2">Special Requirements</p>
                            <p className="text-sm text-foreground italic leading-relaxed">"{enquiry.notes}"</p>
                        </div>
                    )}

                    {/* Quote Expiry */}
                    {enquiry.quote?.expiryAt && (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                            <p className="text-xs font-bold text-amber-700">
                                Quote expires on: {new Date(enquiry.quote.expiryAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-muted/30">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-primary text-primary-foreground rounded-2xl font-bold hover:opacity-90 transition-opacity"
                    >
                        Close
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default CustomEnquiryDetailsModal;
