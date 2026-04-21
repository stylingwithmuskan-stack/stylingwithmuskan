import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Navigation, ShieldAlert, Maximize2, MapPin, ZoomIn, ZoomOut, Target } from "lucide-react";

/**
 * Modern Google Routes API (v2) helper
 */
const fetchRoute = async (apiKey, origin, destination) => {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const requestBody = {
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        units: 'METRIC'
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            // Only request the fields we need to save quota and speed up response
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Failed to fetch route");
    }

    return await response.json();
};

const loadGoogleMaps = (key) => {
  if (!key) return Promise.reject(new Error("Missing Google Maps key"));
  if (window.google?.maps) return Promise.resolve();
  const existing = document.getElementById("google-maps-js");
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => resolve());
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "google-maps-js";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
};

const LiveMap = ({ 
  userLocation, 
  providerLocation, 
  className = "", 
  height = 192, 
  bikeIconUrl = "/bike-marker.svg",
  showSOS = false,
  onSOS = () => {},
  showHeader = false,
  title = "Live Tracking"
}) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const userMarker = useRef(null);
  const providerMarker = useRef(null);
  const routePolyline = useRef(null); // Replaces DirectionsRenderer
  const [ready, setReady] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  const [routeError, setRouteError] = useState(null);
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(key)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => console.error("Google Maps Load Error:", err));
    return () => { cancelled = true; };
  }, [key]);

  const initMap = useCallback(() => {
    if (!ready || !mapRef.current || mapInstance.current) return;
    
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: providerLocation || userLocation || { lat: 20.5937, lng: 78.9629 },
      zoom: 15,
      disableDefaultUI: true,
      gestureHandling: "greedy",
      styles: [
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] }
      ]
    });
  }, [ready, userLocation, providerLocation]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  // Update Markers and Route
  useEffect(() => {
    if (!ready || !mapInstance.current) return;

    // 1. User Marker
    if (userLocation) {
      if (!userMarker.current) {
        userMarker.current = new window.google.maps.Marker({
          position: userLocation,
          map: mapInstance.current,
          icon: {
            url: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white" /></svg>')}`,
            scaledSize: new window.google.maps.Size(32, 32),
            anchor: new window.google.maps.Point(16, 32)
          },
          zIndex: 100
        });
      } else {
        userMarker.current.setPosition(userLocation);
      }
    }

    // 2. Provider Marker
    if (providerLocation) {
      if (!providerMarker.current) {
        providerMarker.current = new window.google.maps.Marker({
          position: providerLocation,
          map: mapInstance.current,
          icon: {
            url: bikeIconUrl,
            scaledSize: new window.google.maps.Size(44, 44),
            anchor: new window.google.maps.Point(22, 22)
          },
          zIndex: 200
        });
      } else {
        providerMarker.current.setPosition(providerLocation);
      }
    }

    // 3. Compute Route via new Routes API
    if (userLocation && providerLocation && key) {
        fetchRoute(key, providerLocation, userLocation)
            .then(data => {
                setRouteError(null);
                const route = data.routes?.[0];
                if (!route) return;

                // Duration & Distance
                const durMin = Math.ceil(parseInt(route.duration) / 60);
                setEta(`${durMin} min`);
                setDistance(`${(route.distanceMeters / 1000).toFixed(1)} km`);

                // Decode Polyline and Draw
                const path = window.google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
                
                if (!routePolyline.current) {
                    routePolyline.current = new window.google.maps.Polyline({
                        path,
                        geodesic: true,
                        strokeColor: "#3b82f6",
                        strokeOpacity: 0.8,
                        strokeWeight: 6,
                        map: mapInstance.current,
                    });
                } else {
                    routePolyline.current.setPath(path);
                }

                // Bounds logic
                const bounds = new window.google.maps.LatLngBounds();
                path.forEach(pt => bounds.extend(pt));
                mapInstance.current.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
            })
            .catch(err => {
                console.error("Route Fetch Error:", err);
                setRouteError(err.message);
            });
    }
  }, [ready, userLocation?.lat, userLocation?.lng, providerLocation?.lat, providerLocation?.lng, bikeIconUrl, key]);

  const handleRecenter = () => {
    if (!mapInstance.current) return;
    const bounds = new window.google.maps.LatLngBounds();
    if (userLocation) bounds.extend(userLocation);
    if (providerLocation) bounds.extend(providerLocation);
    mapInstance.current.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
  };

  const handleZoom = (delta) => {
    if (!mapInstance.current) return;
    mapInstance.current.setZoom(mapInstance.current.getZoom() + delta);
  };

  const hasLocation = !!(userLocation || providerLocation);

  if (!key) return <div className={`flex items-center justify-center bg-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest ${className}`} style={{ height }}>Maps Key Required</div>;
  if (!hasLocation) return <div className={`flex items-center justify-center bg-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest ${className}`} style={{ height }}>Initializing...</div>;

  return (
    <>
      <div 
        className={`relative group cursor-pointer overflow-hidden rounded-[24px] ${className}`} 
        style={{ height }}
        onClick={() => setIsFullScreen(true)}
      >
        <div ref={mapRef} className="w-full h-full" />
        
        {/* Interaction shield for small view */}
        <div className="absolute inset-0 bg-transparent" />
        
        <div className="absolute top-3 left-3 flex flex-col gap-2">
            {eta && (
                <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-gray-100 flex items-center gap-2">
                    <Navigation className="w-3 h-3 text-blue-600 fill-blue-600 animate-pulse" />
                    <span className="text-[10px] font-black text-gray-900">{eta}</span>
                </div>
            )}
            {routeError && (
                <div className="bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 flex items-center gap-2">
                    <span className="text-[9px] font-bold text-red-600 uppercase tracking-tighter">Route Hub Error</span>
                </div>
            )}
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg text-[9px] font-black text-white uppercase tracking-widest">
                Expand Route
            </div>
            <div className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-lg pointer-events-auto">
                <Maximize2 className="w-4 h-4 text-gray-600" />
            </div>
        </div>
      </div>

      {/* Full Screen Modal */}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-white flex flex-col"
          >
            {/* Modal Header */}
            <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                        <Navigation className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black tracking-tight text-gray-900">{title}</h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Real-Time Navigation Hub</p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsFullScreen(false)}
                    className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-900 hover:bg-gray-100 transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative">
                <LiveMapContent 
                    userLocation={userLocation} 
                    providerLocation={providerLocation}
                    bikeIconUrl={bikeIconUrl}
                    eta={eta}
                    distance={distance}
                    showSOS={showSOS}
                    onSOS={onSOS}
                    handleRecenter={handleRecenter}
                    handleZoom={handleZoom}
                    routeError={routeError}
                    apiKey={key}
                />
            </div>

            {/* Bottom Info Sheet */}
            <div className="bg-white px-6 py-6 border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-xl mx-auto flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Live Arrival Estimate</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-gray-900">{eta || "--"}</span>
                            <span className="text-sm font-bold text-gray-400 capitalize">{distance || ""} away</span>
                        </div>
                    </div>
                    
                    {showSOS && (
                        <button 
                            onClick={onSOS}
                            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-red-200 transition-all active:scale-95"
                        >
                            <ShieldAlert className="w-5 h-5" /> SOS Help
                        </button>
                    )}
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Internal component for the actual map content in modal
const LiveMapContent = ({ 
    userLocation, 
    providerLocation, 
    bikeIconUrl, 
    eta, 
    distance,
    showSOS,
    onSOS,
    handleRecenter,
    handleZoom,
    routeError,
    apiKey
}) => {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const userMarker = useRef(null);
    const providerMarker = useRef(null);
    const routePolyline = useRef(null);

    useEffect(() => {
        if (!mapRef.current) return;
        
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
            center: providerLocation || userLocation || { lat: 20.5937, lng: 78.9629 },
            zoom: 16,
            disableDefaultUI: true,
            gestureHandling: "greedy"
        });

        // Add Markers
        if (userLocation) {
            userMarker.current = new window.google.maps.Marker({
                position: userLocation,
                map: mapInstance.current,
                icon: {
                    url: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white" /></svg>')}`,
                    scaledSize: new window.google.maps.Size(40, 40),
                    anchor: new window.google.maps.Point(20, 40)
                },
                zIndex: 100
            });
        }

        if (providerLocation) {
            providerMarker.current = new window.google.maps.Marker({
                position: providerLocation,
                map: mapInstance.current,
                icon: {
                    url: bikeIconUrl,
                    scaledSize: new window.google.maps.Size(48, 48),
                    anchor: new window.google.maps.Point(24, 24)
                },
                zIndex: 200
            });
        }

        // Draw Route via Routes API
        if (userLocation && providerLocation && apiKey) {
            fetchRoute(apiKey, providerLocation, userLocation)
                .then(data => {
                    const route = data.routes?.[0];
                    if (!route) return;

                    const path = window.google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
                    
                    if (routePolyline.current) routePolyline.current.setMap(null);
                    routePolyline.current = new window.google.maps.Polyline({
                        path,
                        geodesic: true,
                        strokeColor: "#3b82f6",
                        strokeOpacity: 0.8,
                        strokeWeight: 8,
                        map: mapInstance.current,
                    });

                    const bounds = new window.google.maps.LatLngBounds();
                    path.forEach(pt => bounds.extend(pt));
                    mapInstance.current.fitBounds(bounds, { top: 100, bottom: 100, left: 100, right: 100 });
                })
                .catch(console.error);
        }
    }, [userLocation, providerLocation, bikeIconUrl, apiKey]);

    return (
        <div className="w-full h-full relative">
            <div ref={mapRef} className="w-full h-full" />
            
            {/* Map Controls */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                <button 
                    onClick={() => handleZoom(1)}
                    className="w-14 h-14 rounded-2xl bg-white shadow-2xl flex items-center justify-center text-gray-900 border border-gray-100 transition-all hover:bg-gray-50 active:scale-95"
                >
                    <ZoomIn className="w-6 h-6" />
                </button>
                <button 
                    onClick={() => handleZoom(-1)}
                    className="w-14 h-14 rounded-2xl bg-white shadow-2xl flex items-center justify-center text-gray-900 border border-gray-100 transition-all hover:bg-gray-50 active:scale-95"
                >
                    <ZoomOut className="w-6 h-6" />
                </button>
                <button 
                    onClick={handleRecenter}
                    className="w-14 h-14 rounded-2xl bg-white shadow-2xl flex items-center justify-center text-blue-600 border border-gray-100 transition-all hover:bg-blue-50 active:scale-95"
                >
                    <Target className="w-6 h-6" />
                </button>
            </div>

            {/* Overlays */}
            <div className="absolute top-6 left-6 flex flex-col gap-3">
                {eta && (
                    <div className="bg-white px-5 py-3 rounded-2xl shadow-2xl border border-gray-100 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <Navigation className="w-5 h-5 fill-blue-600 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live Arrival Proximity</p>
                            <p className="text-xl font-black text-gray-900 leading-none">{eta}</p>
                        </div>
                    </div>
                )}
                {routeError && (
                    <div className="bg-red-600 px-5 py-3 rounded-2xl shadow-2xl flex flex-col gap-1 max-w-xs">
                         <div className="flex items-center gap-2 text-white">
                            <ShieldAlert className="w-4 h-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Routing Blocked</p>
                         </div>
                         <p className="text-[11px] font-bold text-white/80">{routeError}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveMap;
