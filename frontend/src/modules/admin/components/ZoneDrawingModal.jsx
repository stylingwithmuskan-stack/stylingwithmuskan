import React, { useState, useEffect, useRef } from "react";
import { X, MapPin, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { toast } from "sonner";
import useGoogleMaps from "../hooks/useGoogleMaps";

const ZoneDrawingModal = ({ isOpen, onClose, city, existingZone = null, existingZones = [], providerLocation = null, zoneToEdit = null, initialZoneName = "", onSave }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const providerMarkerRef = useRef(null);
  const existingPolygonsRef = useRef([]);
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

  // Update zone name when zoneToEdit or initialZoneName changes
  useEffect(() => {
    if (zoneToEdit) {
      setZoneName(zoneToEdit.name || "");
    } else if (initialZoneName) {
      setZoneName(initialZoneName);
    } else {
      setZoneName("");
    }
  }, [initialZoneName, zoneToEdit]);

  // Initialize markers for editing an existing zone
  useEffect(() => {
    if (!isOpen || !isMapLoaded || !mapInstanceRef.current || !window.google?.maps) return;
    if (!zoneToEdit || !Array.isArray(zoneToEdit.coordinates) || zoneToEdit.coordinates.length !== 5) return;

    const mapInstance = mapInstanceRef.current;
    
    // Clear any existing markers first to prevent duplicates
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    
    // Create markers from existing coordinates
    const loadedMarkers = zoneToEdit.coordinates.map((coord, index) => {
      const marker = new window.google.maps.Marker({
        position: { lat: Number(coord.lat), lng: Number(coord.lng) },
        map: mapInstance,
        draggable: true,
        cursor: 'move',
        label: {
          text: `${index + 1}`,
          color: '#FFFFFF',
          fontWeight: 'bold'
        },
        animation: window.google.maps.Animation.DROP,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#FF0000',
          fillOpacity: 0.8,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        }
      });
      
      // Add drag listener with fresh reference
      marker.addListener("drag", () => {
        const currentMarkers = markersRef.current;
        if (currentMarkers.length > 0) {
          updatePolygon(currentMarkers, mapInstance);
        }
      });
      
      // Add dragend listener for final update
      marker.addListener("dragend", () => {
        updatePolygon(markersRef.current, mapInstance);
      });
      
      // Add hover effects for better UX
      marker.addListener("mouseover", () => {
        marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#FF4444',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3
        });
      });
      
      marker.addListener("mouseout", () => {
        marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#FF0000',
          fillOpacity: 0.8,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        });
      });
      
      return marker;
    });

    // Update ref immediately before state
    markersRef.current = loadedMarkers;
    
    setMarkers(loadedMarkers);
    setPointsPlaced(loadedMarkers.length);
    setIsComplete(true);
    
    // Draw initial polygon
    const path = loadedMarkers.map(m => m.getPosition());
    const newPolygon = new window.google.maps.Polygon({
      paths: path,
      strokeColor: "#FF0000",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: "#FF0000",
      fillOpacity: 0.35
    });
    newPolygon.setMap(mapInstance);
    polygonRef.current = newPolygon;
    setPolygon(newPolygon);

  }, [isOpen, isMapLoaded, zoneToEdit]);

  // Sync refs with state
  useEffect(() => {
    // Only sync if markers/polygon are set from state updates (not from edit mode)
    if (!zoneToEdit) {
      markersRef.current = markers;
      polygonRef.current = polygon;
    }
  }, [markers, polygon, zoneToEdit]);

  const clearExistingPolygons = () => {
    existingPolygonsRef.current.forEach((shape) => shape.setMap(null));
    existingPolygonsRef.current = [];
  };

  const renderExistingPolygons = () => {
    if (!mapInstanceRef.current || !window.google?.maps) return;
    clearExistingPolygons();
    existingPolygonsRef.current = (Array.isArray(existingZones) ? existingZones : [])
      .filter((zone) => Array.isArray(zone?.coordinates) && zone.coordinates.length >= 3)
      .filter((zone) => zone._id !== zoneToEdit?._id)
      .map((zone) => {
        const shape = new window.google.maps.Polygon({
          paths: zone.coordinates.map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })),
          strokeColor: zone._id === existingZone?._id ? "#2563eb" : "#16a34a",
          strokeOpacity: 0.85,
          strokeWeight: zone._id === existingZone?._id ? 3 : 2,
          fillColor: zone._id === existingZone?._id ? "#93c5fd" : "#86efac",
          fillOpacity: zone._id === existingZone?._id ? 0.25 : 0.15,
        });
        shape.setMap(mapInstanceRef.current);
        return shape;
      });
  };

  // Initialize map once when API loads
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !window.google?.maps || mapInstanceRef.current) {
      return;
    }

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: { lat: Number(city?.mapCenterLat || city?.lat || 23.0225), lng: Number(city?.mapCenterLng || city?.lng || 77.4126) },
      zoom: Number(city?.mapZoom || 12),
      mapTypeId: "roadmap",
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy',
      draggable: true,
      disableDoubleClickZoom: false,
      scrollwheel: true,
      clickableIcons: false
    });

    mapInstanceRef.current = mapInstance;
    renderExistingPolygons();

    // Add click listener for placing new markers
    mapInstance.addListener("click", (event) => {
      const currentMarkers = markersRef.current;
      if (currentMarkers.length >= 5) return;

      const marker = new window.google.maps.Marker({
        position: event.latLng,
        map: mapInstance,
        draggable: true,
        cursor: 'move',
        label: {
          text: `${currentMarkers.length + 1}`,
          color: '#FFFFFF',
          fontWeight: 'bold'
        },
        animation: window.google.maps.Animation.DROP,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#FF0000',
          fillOpacity: 0.8,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        }
      });

      const newMarkers = [...currentMarkers, marker];
      markersRef.current = newMarkers;
      setMarkers(newMarkers);
      setPointsPlaced(newMarkers.length);

      // Add drag listener with fresh reference
      marker.addListener("drag", () => {
        const currentMarkers = markersRef.current;
        if (currentMarkers.length > 0) {
          updatePolygon(currentMarkers, mapInstance);
        }
      });
      
      // Add dragend listener for final update
      marker.addListener("dragend", () => {
        updatePolygon(markersRef.current, mapInstance);
      });
      
      // Add hover effects
      marker.addListener("mouseover", () => {
        marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#FF4444',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3
        });
      });
      
      marker.addListener("mouseout", () => {
        marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#FF0000',
          fillOpacity: 0.8,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        });
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
      lat: Number(city.mapCenterLat || city.lat || 23.0225),
      lng: Number(city.mapCenterLng || city.lng || 77.4126)
    };

    setTimeout(() => {
      window.google.maps.event.trigger(mapInstanceRef.current, 'resize');
      mapInstanceRef.current.setCenter(mapCenter);
      mapInstanceRef.current.setZoom(Number(city.mapZoom || 12));
      renderExistingPolygons();
    }, 100);

  }, [isOpen, city, existingZones]);

  useEffect(() => {
    if (!isOpen || !mapInstanceRef.current) return;
    renderExistingPolygons();
  }, [existingZones, existingZone, isOpen]);

  useEffect(() => {
    if (!isOpen || !mapInstanceRef.current || !window.google?.maps) return;
    if (providerMarkerRef.current) {
      providerMarkerRef.current.setMap(null);
      providerMarkerRef.current = null;
    }
    if (providerLocation?.lat && providerLocation?.lng) {
      providerMarkerRef.current = new window.google.maps.Marker({
        position: { lat: Number(providerLocation.lat), lng: Number(providerLocation.lng) },
        map: mapInstanceRef.current,
        title: "Requested location",
      });
    }
  }, [providerLocation, isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      markers.forEach(marker => marker.setMap(null));
      if (polygon) polygon.setMap(null);
      clearExistingPolygons();
      if (providerMarkerRef.current) {
        providerMarkerRef.current.setMap(null);
        providerMarkerRef.current = null;
      }
      
      setMarkers([]);
      setPolygon(null);
      setPointsPlaced(0);
      setIsComplete(false);
      setZoneName("");
      setError(null);
      
      // Clear refs to ensure clean state on next open
      markersRef.current = [];
      polygonRef.current = null;
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
    
    // Clear both state and refs
    markersRef.current = [];
    polygonRef.current = null;
    
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
