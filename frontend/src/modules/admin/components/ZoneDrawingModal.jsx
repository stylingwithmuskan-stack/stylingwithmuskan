import React, { useState, useEffect, useRef } from "react";
import { X, MapPin, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { toast } from "sonner";
import useGoogleMaps from "../hooks/useGoogleMaps";

const ZoneDrawingModal = ({ isOpen, onClose, city, existingZone = null, providerLocation = null, initialZoneName = "", onSave }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const providerMarkerRef = useRef(null);
  const [markers, setMarkers] = useState([]);
  const markersRef = useRef([]);
  const [polygon, setPolygon] = useState(null);
  const polygonRef = useRef(null);
  const [pointsPlaced, setPointsPlaced] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [zoneName, setZoneName] = useState(initialZoneName || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded: isMapLoaded, loadError } = useGoogleMaps(apiKey);

  // Update zone name when initialZoneName changes
  useEffect(() => {
    if (initialZoneName) {
      setZoneName(initialZoneName);
    }
  }, [initialZoneName]);

  // Sync refs
  useEffect(() => {
    markersRef.current = markers;
    polygonRef.current = polygon;
  }, [markers, polygon]);

  // Initialize map once when API loads
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !window.google?.maps || mapInstanceRef.current) {
      return;
    }

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: { lat: 23.0225, lng: 77.4126 },
      zoom: 12,
      mapTypeId: "roadmap",
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy'
    });

    mapInstanceRef.current = mapInstance;

    // Add click listener
    mapInstance.addListener("click", (event) => {
      const currentMarkers = markersRef.current;
      if (currentMarkers.length >= 5) return;

      const marker = new window.google.maps.Marker({
        position: event.latLng,
        map: mapInstance,
        draggable: true,
        label: {
          text: `${currentMarkers.length + 1}`,
          color: '#FFFFFF',
          fontWeight: 'bold'
        },
        animation: window.google.maps.Animation.DROP
      });

      const newMarkers = [...currentMarkers, marker];
      setMarkers(newMarkers);
      setPointsPlaced(newMarkers.length);

      marker.addListener("drag", () => {
        updatePolygon(markersRef.current, mapInstance);
      });

      if (newMarkers.length >= 2) {
        updatePolygon(newMarkers, mapInstance);
      }

      if (newMarkers.length === 5) {
        setIsComplete(true);
      }
    });

    // Trigger resize
    setTimeout(() => {
      window.google.maps.event.trigger(mapInstance, 'resize');
    }, 100);

  }, [isMapLoaded]);

  // Update map center when modal opens or city changes
  useEffect(() => {
    if (!isOpen || !mapInstanceRef.current || !city) return;

    const mapCenter = {
      lat: city.lat || 23.0225,
      lng: city.lng || 77.4126
    };

    setTimeout(() => {
      window.google.maps.event.trigger(mapInstanceRef.current, 'resize');
      mapInstanceRef.current.setCenter(mapCenter);
      mapInstanceRef.current.setZoom(12);
    }, 100);

  }, [isOpen, city]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      markers.forEach(marker => marker.setMap(null));
      if (polygon) polygon.setMap(null);
      
      setMarkers([]);
      setPolygon(null);
      setPointsPlaced(0);
      setIsComplete(false);
      setZoneName("");
      setError(null);
    }
  }, [isOpen]);

  const updatePolygon = (currentMarkers, mapInstance) => {
    const currentPolygon = polygonRef.current;
    if (currentPolygon) currentPolygon.setMap(null);

    const path = currentMarkers.map(m => m.getPosition());
    const newPolygon = new window.google.maps.Polygon({
      paths: path,
      strokeColor: "#FF0000",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: "#FF0000",
      fillOpacity: 0.35
    });

    newPolygon.setMap(mapInstance);
    setPolygon(newPolygon);
  };

  const handleReset = () => {
    markers.forEach(marker => marker.setMap(null));
    if (polygon) polygon.setMap(null);
    setMarkers([]);
    setPolygon(null);
    setPointsPlaced(0);
    setIsComplete(false);
  };

  const extractCoordinates = () => {
    return markers.map(marker => {
      const pos = marker.getPosition();
      return { lat: pos.lat(), lng: pos.lng() };
    });
  };

  const handleSave = async () => {
    if (!zoneName.trim()) {
      setError("Zone name is required");
      return;
    }

    if (pointsPlaced !== 5) {
      setError("Please place all 5 points on the map");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const coordinates = extractCoordinates();
      await onSave({
        name: zoneName.trim(),
        cityId: city._id,
        cityName: city.name,
        coordinates
      });
    } catch (err) {
      setError(err.message || "Failed to save zone");
      toast.error(err.message || "Failed to save zone");
    } finally {
      setIsSaving(false);
    }
  };

  if (!apiKey) {
    return isOpen ? (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">Configuration Error</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Google Maps API key not configured.
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    ) : null;
  }

  if (loadError) {
    return isOpen ? (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">Failed to Load Google Maps</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {loadError.message || "Please check your network connection."}
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    ) : null;
  }

  // Custom modal with conditional rendering (doesn't unmount)
  return (
    <div 
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div 
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold">Draw New Zone</h2>
                <p className="text-xs text-muted-foreground">
                  {city?.name || "Unknown City"} • Click to place 5 points
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Map */}
          <div className="relative bg-gray-100" style={{ height: '450px' }}>
            <div ref={mapRef} className="w-full h-full" />
            
            {!isMapLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-sm font-bold text-muted-foreground">Loading Google Maps...</p>
              </div>
            )}
            
            {isMapLoaded && (
              <>
                <div className="absolute top-4 left-4 bg-white rounded-xl shadow-lg px-4 py-2 border z-10">
                  <p className="text-xs font-bold text-muted-foreground uppercase">
                    Point {pointsPlaced} of 5
                  </p>
                  {isComplete && (
                    <p className="text-xs text-green-600 font-bold mt-1">✓ Complete</p>
                  )}
                </div>

                {pointsPlaced > 0 && (
                  <div className="absolute top-4 right-4 z-10">
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      size="sm"
                      className="bg-white shadow-lg"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Form */}
          <div className="p-4 border-t bg-muted/30">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">
                  Zone Name *
                </label>
                <Input
                  value={zoneName}
                  onChange={(e) => {
                    setZoneName(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter zone name (e.g., North Delhi, Sector 18)"
                  disabled={isSaving}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <p className="text-xs font-bold text-red-600">{error}</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white"
                  disabled={!zoneName.trim() || pointsPlaced !== 5 || isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Zone"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneDrawingModal;
