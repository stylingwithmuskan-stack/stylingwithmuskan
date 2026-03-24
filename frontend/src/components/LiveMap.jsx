import React, { useEffect, useRef, useState } from "react";

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
};

const LiveMap = ({ userLocation, providerLocation, className = "", height = 192, bikeIconUrl = "/bike-marker.svg" }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const userMarker = useRef(null);
  const providerMarker = useRef(null);
  const directionsRenderer = useRef(null);
  const directionsService = useRef(null);
  const [ready, setReady] = useState(false);
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(key)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    
    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: providerLocation || userLocation || { lat: 20.5937, lng: 78.9629 },
        zoom: 15,
        disableDefaultUI: true,
        gestureHandling: "greedy",
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ]
      });

      directionsService.current = new window.google.maps.DirectionsService();
      directionsRenderer.current = new window.google.maps.DirectionsRenderer({
        map: mapInstance.current,
        suppressMarkers: true, // We use our own custom markers
        polylineOptions: {
          strokeColor: "#3b82f6", // Blue color for the path
          strokeWeight: 5,
          strokeOpacity: 0.8
        }
      });
    }

    // Update User Marker (Red)
    if (userLocation) {
      if (!userMarker.current) {
        userMarker.current = new window.google.maps.Marker({
          position: userLocation,
          map: mapInstance.current,
          title: "Customer",
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#ef4444", // Red
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 8,
          },
        });
      } else {
        userMarker.current.setPosition(userLocation);
      }
    }

    // Update Provider Marker (Bike)
    if (providerLocation) {
      if (!providerMarker.current) {
        providerMarker.current = new window.google.maps.Marker({
          position: providerLocation,
          map: mapInstance.current,
          title: "Provider",
          icon: {
            url: bikeIconUrl,
            scaledSize: new window.google.maps.Size(40, 40),
            anchor: new window.google.maps.Point(20, 20)
          },
        });
      } else {
        providerMarker.current.setPosition(providerLocation);
      }
    }

    // Draw Route and Fit Bounds
    if (userLocation && providerLocation && directionsService.current && directionsRenderer.current) {
      directionsService.current.route(
        {
          origin: providerLocation,
          destination: userLocation,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            directionsRenderer.current.setDirections(result);
            
            // Auto-fit bounds to show both markers
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend(userLocation);
            bounds.extend(providerLocation);
            mapInstance.current.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
          }
        }
      );
    } else if (mapInstance.current) {
      const center = providerLocation || userLocation;
      if (center) mapInstance.current.setCenter(center);
    }

  }, [ready, userLocation?.lat, userLocation?.lng, providerLocation?.lat, providerLocation?.lng, bikeIconUrl]);

  const hasLocation = !!(userLocation || providerLocation);
  if (!key) {
    return (
      <div className={`flex items-center justify-center bg-muted/40 text-xs text-muted-foreground ${className}`} style={{ height }}>
        Google Maps key missing
      </div>
    );
  }
  if (!hasLocation) {
    return (
      <div className={`flex items-center justify-center bg-muted/40 text-xs text-muted-foreground ${className}`} style={{ height }}>
        Location unavailable
      </div>
    );
  }
  return <div ref={mapRef} className={className} style={{ height }} />;
};

export default LiveMap;
