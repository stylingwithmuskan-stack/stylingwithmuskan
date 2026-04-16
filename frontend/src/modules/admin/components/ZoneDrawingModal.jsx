import React, { useState, useEffect, useRef } from "react";
import { X, MapPin, RotateCcw, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { toast } from "sonner";
import useGoogleMaps from "../hooks/useGoogleMaps";
import { ZONE_CONFIG } from "../config/zoneConfig";
import { validatePolygonClient } from "../utils/polygonValidation";

const MAX_POINTS = ZONE_CONFIG.MAX_POINTS; // 8
const MIN_POINTS = ZONE_CONFIG.MIN_POINTS; // 3

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
  const [validationResult, setValidationResult] = useState(null);

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
    if (!zoneToEdit || !Array.isArray(zoneToEdit.coordinates)) return;
    
    // Flexible validation: accept 3-10 points
    if (zoneToEdit.coordinates.length < MIN_POINTS || zoneToEdit.coordinates.length > 10) return;

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

  // Sync refs with state - ALWAYS sync to prevent stale refs
  useEffect(() => {
    markersRef.current = markers;
    polygonRef.current = polygon;
  }, [markers, polygon]);

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
      
      // Debug log to help diagnose issues
      console.log(`[Zone Drawing] Click detected. Current markers: ${currentMarkers.length}/${MAX_POINTS}`);
      
      if (currentMarkers.length >= MAX_POINTS) {
        console.log(`[Zone Drawing] Maximum points (${MAX_POINTS}) reached. Ignoring click.`);
        return;
      }

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
      
      console.log(`[Zone Drawing] Marker ${newMarkers.length} added successfully. Total: ${newMarkers.length}/${MAX_POINTS}`);

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

      if (newMarkers.length >= MIN_POINTS) {
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
      // Clear before rendering to ensure fresh polygons
      clearExistingPolygons();
      renderExistingPolygons();
    }, 100);

  }, [isOpen, city, existingZones]);

  // Re-render existing polygons when zones change or modal state changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    // Always clear existing polygons first (even if modal is closed)
    // This ensures deleted zones are removed from map
    clearExistingPolygons();
    
    // Only render new polygons if modal is open
    if (isOpen) {
      renderExistingPolygons();
    }
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

  // Reset state when modal closes, force clear when opens
  useEffect(() => {
    if (!isOpen) {
      // Modal closing - clear everything
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
    } else if (mapInstanceRef.current) {
      // Modal opening - force clear any stale polygons before rendering
      clearExistingPolygons();
    }
  }, [isOpen]);

  const updatePolygon = (currentMarkers, mapInstance) => {
    const currentPolygon = polygonRef.current;
    if (currentPolygon) currentPolygon.setMap(null);

    const path = currentMarkers.map(m => m.getPosition());
    
    // Validate polygon if enough points
    let validation = null;
    let strokeColor = ZONE_CONFIG.POLYGON_COLORS.DEFAULT.stroke;
    let fillColor = ZONE_CONFIG.POLYGON_COLORS.DEFAULT.fill;
    
    if (currentMarkers.length >= MIN_POINTS) {
      validation = validatePolygonClient(currentMarkers);
      setValidationResult(validation);
      
      // Change color based on validation
      if (validation.isValid) {
        strokeColor = ZONE_CONFIG.POLYGON_COLORS.VALID.stroke;
        fillColor = ZONE_CONFIG.POLYGON_COLORS.VALID.fill;
      } else {
        strokeColor = ZONE_CONFIG.POLYGON_COLORS.INVALID.stroke;
        fillColor = ZONE_CONFIG.POLYGON_COLORS.INVALID.fill;
      }
    } else {
      setValidationResult(null);
    }
    
    const newPolygon = new window.google.maps.Polygon({
      paths: path,
      strokeColor: strokeColor,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: fillColor,
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

    if (pointsPlaced < MIN_POINTS) {
      setError(ZONE_CONFIG.UI_TEXT.MIN_POINTS_ERROR(MIN_POINTS));
      return;
    }
    
    if (pointsPlaced > MAX_POINTS) {
      setError(ZONE_CONFIG.UI_TEXT.MAX_POINTS_ERROR(MAX_POINTS));
      return;
    }
    
    // Validate polygon geometry
    const validation = validatePolygonClient(markersRef.current);
    if (!validation.isValid) {
      setError(`Invalid zone shape: ${validation.errors.join(', ')}`);
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
                <h2 className="text-base font-bold text-gray-900">{zoneToEdit ? 'Edit Zone' : 'Draw New Zone'}</h2>
                <p className="text-xs text-gray-700 font-medium">
                  {city?.name || "Unknown City"} • {ZONE_CONFIG.UI_TEXT.PLACE_POINTS(MIN_POINTS, MAX_POINTS)}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-700 hover:text-gray-900 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Map */}
          <div className="relative bg-gray-100" style={{ height: '430px' }}>
            <div ref={mapRef} className="w-full h-full" />
            
            {!isMapLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-sm font-bold text-gray-900">Loading Google Maps...</p>
              </div>
            )}
            
            {isMapLoaded && (
              <>
                <div className="absolute top-4 left-4 bg-white rounded-xl shadow-lg px-4 py-2 border z-10">
                  <p className="text-xs font-bold text-gray-900 uppercase">
                    {ZONE_CONFIG.UI_TEXT.POINT_COUNTER(pointsPlaced, MAX_POINTS, pointsPlaced >= MIN_POINTS)}
                  </p>
                  
                  {/* Validation Status */}
                  {validationResult && pointsPlaced >= MIN_POINTS && (
                    <div className="mt-2 pt-2 border-t">
                      {validationResult.isValid ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          <span className="text-xs font-bold">{ZONE_CONFIG.UI_TEXT.VALIDATION_VALID}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="text-xs font-bold">{ZONE_CONFIG.UI_TEXT.VALIDATION_INVALID}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-700 font-medium mt-1">
                        Area: {validationResult.areaKm} km²
                      </p>
                    </div>
                  )}
                  
                  {isComplete && (
                    <p className="text-xs text-green-600 font-bold mt-1">✓ Complete</p>
                  )}
                </div>
                
                {/* Validation Errors */}
                {validationResult && !validationResult.isValid && pointsPlaced >= MIN_POINTS && (
                  <div className="absolute top-24 left-4 bg-red-50 border border-red-200 rounded-xl shadow-lg px-4 py-2 z-10 max-w-xs">
                    <p className="text-xs font-bold text-red-600 mb-1">Issues:</p>
                    <ul className="text-[10px] text-red-600 space-y-1">
                      {validationResult.errors.map((err, idx) => (
                        <li key={idx}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {pointsPlaced > 0 && (
                  <div className="absolute top-4 right-4 z-10">
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      size="sm"
                      className="bg-white shadow-lg text-gray-900 border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-400"
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
                <label className="text-xs font-bold text-gray-700 uppercase mb-2 block">
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
                  disabled={!zoneName.trim() || pointsPlaced < MIN_POINTS || isSaving || (validationResult && !validationResult.isValid)}
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
