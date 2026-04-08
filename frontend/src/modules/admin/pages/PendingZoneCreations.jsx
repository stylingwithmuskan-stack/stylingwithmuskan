import React, { useState, useEffect } from "react";
import { MapPin, Loader2, CheckCircle, XCircle, AlertTriangle, User, Phone, MapPinned } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/modules/user/components/ui/dialog";
import { Textarea } from "@/modules/user/components/ui/textarea";
import { toast } from "sonner";
import { api } from "@/modules/user/lib/api";
import { useNavigate } from "react-router-dom";
import ZoneDrawingModal from "@/modules/admin/components/ZoneDrawingModal";

const PendingZoneCreations = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [cities, setCities] = useState([]);
  const [cityZones, setCityZones] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isZoneDrawingOpen, setIsZoneDrawingOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
    api.admin.listCities().then((res) => setCities(res.cities || [])).catch(() => {});
  }, []);

  const redirectToAdminLogin = () => {
    toast.error("Admin session expired. Please login again.");
    navigate("/admin/login", { replace: true });
  };

  const hasAdminToken = () => {
    try {
      return !!localStorage.getItem("swm_admin_token");
    } catch {
      return false;
    }
  };

  const fetchRequests = async () => {
    if (!hasAdminToken()) {
      redirectToAdminLogin();
      return;
    }
    try {
      setLoading(true);
      const res = await api.admin.listPendingZoneCreations();
      setRequests(res.requests || []);
    } catch (err) {
      if (err?.status === 401) {
        redirectToAdminLogin();
        return;
      }
      toast.error("Failed to fetch pending zone requests");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZone = (request) => {
    setSelectedRequest(request);
    const cityId = request.providerCityId;
    if (cityId && !cityZones[cityId]) {
      api.admin.listZones(cityId).then((res) => {
        setCityZones((prev) => ({ ...prev, [cityId]: res.zones || [] }));
      }).catch(() => {});
    }
    setIsZoneDrawingOpen(true);
  };

  const handleSaveZone = async (zoneData) => {
    if (!selectedRequest) return;
    
    try {
      await api.admin.createZoneFromRequest({
        providerId: selectedRequest.providerId,
        requestId: selectedRequest._id,
        cityId: zoneData.cityId,
        zoneName: zoneData.name,
        coordinates: zoneData.coordinates
      });
      
      toast.success(`Zone "${zoneData.name}" created successfully`);
      setIsZoneDrawingOpen(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      throw err; // Let modal handle the error
    }
  };

  const handleReject = (request) => {
    setSelectedRequest(request);
    setRejectReason("");
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedRequest) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      setSubmitting(true);
      await api.admin.rejectZoneCreationRequest({
        providerId: selectedRequest.providerId,
        requestId: selectedRequest._id,
        reason: rejectReason.trim()
      });
      
      toast.success("Zone request rejected");
      setIsRejectModalOpen(false);
      setSelectedRequest(null);
      setRejectReason("");
      fetchRequests();
    } catch (err) {
      toast.error(err.message || "Failed to reject request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewLocation = (request) => {
    if (request.providerLocation?.lat && request.providerLocation?.lng) {
      const url = `https://www.google.com/maps?q=${request.providerLocation.lat},${request.providerLocation.lng}`;
      window.open(url, "_blank");
    } else {
      toast.error("Provider location not available");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", { 
      day: "numeric", 
      month: "short", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
            <MapPin className="h-7 w-7 text-primary" /> 
            Pending Zone Creations
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Review and create new zones requested by providers
          </p>
        </div>
        <Card className="hidden md:flex items-center gap-4 px-4 py-2 border-border/50 shadow-none bg-muted/30 rounded-2xl">
          <div className="text-center">
            <p className="text-xl font-black text-primary">{requests.length}</p>
            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
              Pending Requests
            </p>
          </div>
        </Card>
      </motion.div>

      {/* Mobile Stats */}
      <div className="md:hidden">
        <Card className="p-4 border-none shadow-none bg-primary/10 text-primary rounded-2xl">
          <p className="text-3xl font-black">{requests.length}</p>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
            Pending Requests
          </p>
        </Card>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <Card className="border-border/50 shadow-none">
            <CardContent className="py-16 text-center">
              <CheckCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-bold text-muted-foreground">
                No pending zone creation requests
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                All zone requests have been processed
              </p>
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card 
              key={request._id} 
              className="rounded-2xl border-border/50 shadow-none hover:border-primary/30 transition-all"
            >
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Request Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold">{request.zoneName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[9px] font-black bg-amber-500/10 text-amber-600 border-none">
                            🆕 NEW ZONE
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {request.providerCity || "Unknown City"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Provider Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-15">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{request.providerName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{request.providerPhone}</span>
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pl-15">
                      <span>Requested: {formatDate(request.requestedAt)}</span>
                      <span>•</span>
                      <span>Vendor Approved: {formatDate(request.vendorReviewedAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 lg:w-48">
                    <Button
                      onClick={() => handleViewLocation(request)}
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl font-bold text-xs"
                      disabled={!request.providerLocation?.lat || !request.providerLocation?.lng}
                    >
                      <MapPinned className="h-4 w-4 mr-2" />
                      View Location
                    </Button>
                    <Button
                      onClick={() => handleCreateZone(request)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Create Zone
                    </Button>
                    <Button
                      onClick={() => handleReject(request)}
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl font-bold text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Zone Drawing Modal */}
      {selectedRequest && (
        <ZoneDrawingModal
          isOpen={isZoneDrawingOpen}
          onClose={() => {
            setIsZoneDrawingOpen(false);
            setSelectedRequest(null);
          }}
          city={cities.find((city) => city._id === selectedRequest.providerCityId) || {
            _id: selectedRequest.providerCityId,
            name: selectedRequest.providerCity,
            mapCenterLat: selectedRequest.providerLocation?.lat || 23.0225,
            mapCenterLng: selectedRequest.providerLocation?.lng || 77.4126,
            mapZoom: 12,
          }}
          existingZones={selectedRequest.providerCityId ? (cityZones[selectedRequest.providerCityId] || []) : []}
          providerLocation={selectedRequest.providerLocation}
          initialZoneName={selectedRequest.zoneName}
          onSave={handleSaveZone}
        />
      )}

      {/* Reject Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Reject Zone Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              You are about to reject the zone request for <span className="font-bold">{selectedRequest?.zoneName}</span> by{" "}
              <span className="font-bold">{selectedRequest?.providerName}</span>.
            </p>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">
                Rejection Reason *
              </label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this zone request is being rejected..."
                rows={4}
                disabled={submitting}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsRejectModalOpen(false)}
                variant="outline"
                className="flex-1"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmReject}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={!rejectReason.trim() || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  "Confirm Reject"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingZoneCreations;
