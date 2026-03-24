import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, CheckCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { useAdminAuth } from "@/modules/admin/contexts/AdminAuthContext";
import { toast } from "sonner";

export default function CustomEnquiries() {
  const { getEnquiries, priceQuoteEnquiry, finalApproveEnquiry } = useAdminAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState({ totalAmount: 0, discountPrice: 0, notes: "", prebookAmount: 0, totalServiceTime: "", quoteExpiryHours: 12 });
  const [activeId, setActiveId] = useState("");

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

  const beginQuote = (id) => { setActiveId(id); setQuote({ totalAmount: 0, discountPrice: 0, notes: "", prebookAmount: 0, totalServiceTime: "", quoteExpiryHours: 12 }); };
  const submitQuote = async () => {
    if (!activeId) return;
    try {
      await priceQuoteEnquiry(activeId, {
        items: [],
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
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${enq.status === "quote_expired" ? "bg-red-100 text-red-700" : "bg-muted"}`}>{enq.status}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm font-semibold">{enq.name} • {enq.phone}</div>
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
              {activeId === enq._id ? (
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Total INR" type="number" value={quote.totalAmount} onChange={e => setQuote(q => ({ ...q, totalAmount: e.target.value }))} className="rounded-xl h-9" />
                  <Input placeholder="Discount INR" type="number" value={quote.discountPrice} onChange={e => setQuote(q => ({ ...q, discountPrice: e.target.value }))} className="rounded-xl h-9" />
                  <Input placeholder="Advance INR" type="number" value={quote.prebookAmount} onChange={e => setQuote(q => ({ ...q, prebookAmount: e.target.value }))} className="rounded-xl h-9" />
                  <Input placeholder="Service Time" type="text" value={quote.totalServiceTime} onChange={e => setQuote(q => ({ ...q, totalServiceTime: e.target.value }))} className="rounded-xl h-9" />
                  <Input placeholder="Expiry (hrs)" type="number" value={quote.quoteExpiryHours} onChange={e => setQuote(q => ({ ...q, quoteExpiryHours: e.target.value }))} className="rounded-xl h-9" />
                  <Button onClick={submitQuote} className="rounded-xl h-9 font-bold">Approve Quote</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={() => beginQuote(enq._id)} variant="outline" className="rounded-xl h-9 text-xs font-bold">Price Quote</Button>
                  <Button onClick={async () => { try { await finalApproveEnquiry(enq._id); toast.success("Booking created."); } catch (e) { toast.error(e?.message || "Booking creation failed"); } }} className="rounded-xl h-9 text-xs font-bold gap-1"><CheckCircle className="h-3 w-3" /> Force Create Booking</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
