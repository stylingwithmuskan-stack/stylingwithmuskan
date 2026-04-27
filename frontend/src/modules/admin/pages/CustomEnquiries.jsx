import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { 
  ClipboardList, CheckCircle, RefreshCw, Eye, X, LayoutGrid, 
  IndianRupee, Percent, Clock, MapPin, User, Phone, Users, Calendar 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Badge } from "@/modules/user/components/ui/badge";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { toast } from "sonner";

export default function CustomEnquiries() {
  const { getEnquiries, priceQuoteEnquiry, finalApproveEnquiry } = useAdminAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState({ totalAmount: "", discountPrice: "", notes: "", prebookAmount: "", totalServiceTime: "", quoteExpiryHours: 12 });
  const [activeId, setActiveId] = useState("");
  const [editItems, setEditItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEnq, setSelectedEnq] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getEnquiries();
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const beginQuote = (enq) => { 
    setSelectedEnq(enq);
    setActiveId(enq._id); 
    setQuote({ 
      totalAmount: enq.quote?.totalAmount || "", 
      discountPrice: enq.quote?.discountPrice || "", 
      notes: enq.quote?.notes || "", 
      prebookAmount: enq.quote?.prebookAmount || "", 
      totalServiceTime: enq.quote?.totalServiceTime || "", 
      quoteExpiryHours: 12 
    }); 

    const itemsToQuote = enq.quote?.items?.length 
      ? enq.quote.items 
      : (enq.items || []);
    
    setEditItems(itemsToQuote.map(it => ({
      id: it.id || it._id,
      name: it.name,
      category: it.category || it.categoryName,
      quantity: it.quantity || 1,
      price: it.price || 0
    })));
    setIsModalOpen(true);
  };

  const handleItemPriceChange = (index, newPrice) => {
    const updated = [...editItems];
    updated[index].price = parseFloat(newPrice) || 0;
    setEditItems(updated);
    
    const newTotal = updated.reduce((acc, it) => acc + (it.price * (it.quantity || 1)), 0);
    setQuote(q => ({ ...q, totalAmount: newTotal }));
  };

  const submitQuote = async () => {
    if (!activeId) return;
    try {
      await priceQuoteEnquiry(activeId, {
        items: editItems,
        totalAmount: Number(quote.totalAmount),
        discountPrice: Number(quote.discountPrice) || 0,
        prebookAmount: Number(quote.prebookAmount) || 0,
        totalServiceTime: quote.totalServiceTime || "",
        quoteExpiryHours: Number(quote.quoteExpiryHours) || 12,
        notes: quote.notes || ""
      });
      toast.success("Quote approved and sent to customer.");
      setActiveId("");
      load();
    } catch (e) {
      toast.error(e?.message || "Failed to approve quote");
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2"><ClipboardList className="h-7 w-7 text-primary" /> Custom Enquiries</h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">Bulk/Event requests submitted by users</p>
        </div>
        <Button onClick={load} variant="outline" className="gap-2 rounded-xl font-bold" disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </motion.div>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map(enq => (
          <Card key={enq._id} className="border-border/50 shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span>#{String(enq._id).slice(-6)}</span>
                <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                  enq.status === "admin_approved" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : 
                  enq.status === "quote_expired" ? "bg-red-500/10 text-red-500 border border-red-500/20" : 
                  "bg-muted border border-border/50"
                }`}>
                  {enq.status === "admin_approved" && <CheckCircle className="h-2.5 w-2.5" />}
                  {enq.status?.replace(/_/g, " ")}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">{enq.name} • {enq.phone}</div>
                {enq.status === "admin_approved" && (
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-500 border-emerald-500/40 text-[8px] font-black uppercase tracking-widest px-1.5 h-5 animate-pulse">
                    APPROVED
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">Event: {enq.eventType} | People: {enq.noOfPeople}</div>
              <div className="text-[11px] text-muted-foreground">When: {enq.scheduledAt?.date} • {enq.scheduledAt?.timeSlot}</div>
              {enq.quote?.expiryAt && (
                <div className="text-[11px] text-muted-foreground">
                  Quote Expiry: {new Date(enq.quote.expiryAt).toLocaleString()}
                </div>
              )}
              {enq.quote?.totalAmount > 0 && (
                <div className="text-sm font-bold">
                  Quoted: &#8377;{enq.quote.totalAmount} {enq.quote.discountPrice ? `(-&#8377;${enq.quote.discountPrice})` : ""}
                  {enq.quote.prebookAmount ? ` Advance: &#8377;${enq.quote.prebookAmount}` : ""}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={() => beginQuote(enq)} variant="outline" className="rounded-xl h-9 text-xs font-bold gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> View Details
                </Button>
                {enq.status !== "quote_expired" && (
                  <Button onClick={async () => { try { await finalApproveEnquiry(enq._id); toast.success("Booking created."); } catch (e) { toast.error(e?.message || "Booking creation failed"); } }} className="rounded-xl h-9 text-xs font-bold gap-1 bg-primary text-white"><CheckCircle className="h-3 w-3" /> Force Create</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══════ DETAILS & QUOTE MODAL ═══════ */}
      <AnimatePresence>
        {isModalOpen && selectedEnq && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-[480px] bg-card rounded-[24px] shadow-2xl border border-border p-5 space-y-4 overflow-y-auto max-h-[90vh] scrollbar-hide"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" /> Enquiry Details
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center transition-colors"><X className="h-4 w-4" /></button>
              </div>

              {/* Enquiry Quick Info */}
              <div className="bg-muted/50 rounded-2xl p-4 space-y-4 border border-border/50">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Reference</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black">#{String(selectedEnq._id).slice(-8)}</p>
                      <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-tighter bg-primary/10 text-primary border-primary/20">
                        {selectedEnq.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Event Type</p>
                    <p className="text-sm font-black text-primary">{selectedEnq.eventType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-3 border-y border-border/40">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Schedule</p>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-primary" />
                      <div className="flex flex-col">
                        <span className="text-xs font-black">{selectedEnq.scheduledAt?.date || selectedEnq.date}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">{selectedEnq.scheduledAt?.timeSlot || selectedEnq.timeSlot}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-right">Group Size</p>
                    <p className="text-xs font-black flex items-center justify-end gap-1.5 text-primary">
                      <Users className="h-3 w-3" /> {selectedEnq.noOfPeople} People
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Customer</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                        {selectedEnq.name?.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black leading-none">{selectedEnq.name}</span>
                        <span className="text-[10px] font-medium text-muted-foreground mt-1 flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5" /> {selectedEnq.phone}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized Pricing Section */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-1.5">
                  <LayoutGrid className="h-3 w-3 text-primary" /> Itemized Breakdown
                </label>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="bg-secondary/20 rounded-xl p-3 border border-border/50 space-y-2 shadow-sm">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-black truncate text-foreground">{item.name}</p>
                          <p className="text-[9px] text-muted-foreground font-bold italic">{item.category}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-black bg-secondary/50 text-foreground shrink-0 border-border/50">
                          Qty: {item.quantity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <Input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleItemPriceChange(idx, e.target.value)}
                            className="h-8 pl-7 text-[11px] font-black rounded-lg bg-secondary/40 border-border/50 text-foreground focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div className="text-right min-w-[70px]">
                          <p className="text-[8px] font-bold text-muted-foreground uppercase leading-none">Total</p>
                          <p className="text-[11px] font-black text-primary">₹{(item.price * item.quantity).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Global Quote Settings */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Total Amount (₹)</label>
                  <Input type="number" value={quote.totalAmount} onChange={e => setQuote(q => ({ ...q, totalAmount: e.target.value }))} className="h-10 rounded-xl font-black text-xs bg-secondary/30 border-border/50 text-foreground" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-emerald-500 tracking-widest ml-1">Discount (₹)</label>
                  <Input type="number" value={quote.discountPrice} onChange={e => setQuote(q => ({ ...q, discountPrice: e.target.value }))} className="h-10 rounded-xl font-black text-xs bg-secondary/30 border-emerald-500/20 text-foreground" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-amber-500 tracking-widest ml-1">Advance (₹)</label>
                  <Input type="number" value={quote.prebookAmount} onChange={e => setQuote(q => ({ ...q, prebookAmount: e.target.value }))} className="h-10 rounded-xl font-black text-xs bg-secondary/30 border-amber-500/20 text-foreground" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Service Time</label>
                  <Input type="text" value={quote.totalServiceTime} onChange={e => setQuote(q => ({ ...q, totalServiceTime: e.target.value }))} placeholder="e.g. 4 hrs" className="h-10 rounded-xl font-black text-xs bg-secondary/30 border-border/50 text-foreground" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Quote Expiry (hours)</label>
                  <Input type="number" value={quote.quoteExpiryHours} onChange={e => setQuote(q => ({ ...q, quoteExpiryHours: e.target.value }))} className="h-10 rounded-xl font-black text-xs bg-secondary/30 border-border/50 text-foreground" />
                </div>
              </div>

              {quote.totalAmount > 0 && (
                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Final Price for User</span>
                    <span className="text-xl font-black text-emerald-500">₹{(parseFloat(quote.totalAmount) - (parseFloat(quote.discountPrice) || 0)).toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {selectedEnq.status === "admin_approved" || selectedEnq.status === "waiting_for_customer_payment" || selectedEnq.status === "advance_paid" ? (
                  <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl h-11 flex items-center justify-center gap-2 text-emerald-500 font-black">
                    <CheckCircle className="h-5 w-5" /> Quote Already Approved
                  </div>
                ) : (
                  <Button onClick={submitQuote} className="flex-1 h-11 rounded-xl font-bold gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                    <CheckCircle className="h-4 w-4" /> Approve & Send Quote
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsModalOpen(false)} className="h-11 rounded-xl font-bold">Close</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
