import React, { useEffect, useState } from "react";
import { ChevronRight, Briefcase, RefreshCw, HelpCircle, MapPin, Search, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { useProviderAuth } from "../contexts/ProviderAuthContext";
import { api } from "@/modules/user/lib/api";
import { GoogleMap, LoadScript, Polygon, Marker, InfoWindow } from '@react-google-maps/api';

export default function MyHub() {
    const navigate = useNavigate();
    const { provider } = useProviderAuth();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [zoneData, setZoneData] = useState([]);
    const [mapCenter, setMapCenter] = useState(null);
    const [mapZoom, setMapZoom] = useState(12);
    const [selectedZone, setSelectedZone] = useState(null);
    const [providerMarkerPosition, setProviderMarkerPosition] = useState(null);
    const [loadingZones, setLoadingZones] = useState(true);
    const [zoneError, setZoneError] = useState(null);

    // Fetch provider summary
    useEffect(() => {
        let cancelled = false;
        if (provider?.phone) {
            api.provider.summary(provider.phone)
                .then((s) => {
                    if (!cancelled) {
                        setSummary(s);
                        setLoading(false);
                    }
                })
                .catch(() => {
                    if (!cancelled) setLoading(false);
                });
        } else {
            setLoading(false);
        }
        return () => { cancelled = true; };
    }, [provider?.phone]);

    // Fetch zone coordinates and setup map
    useEffect(() => {
        const fetchZoneData = async () => {
            if (!provider?.zones || provider.zones.length === 0 || !provider?.city) {
                setLoadingZones(false);
                return;
            }

            try {
                setLoadingZones(true);
                setZoneError(null);

                // Fetch all zones for provider's city
                const response = await api.content.zones({ cityName: provider.city });
                const allZones = response.zones || [];

                // Filter zones that provider is assigned to
                const providerZones = allZones.filter(z => 
                    provider.zones.includes(z.name) && 
                    z.coordinates && 
                    Array.isArray(z.coordinates) && 
                    z.coordinates.length > 0
                );

                if (providerZones.length === 0) {
                    setZoneError("No zone coordinates available");
                    setLoadingZones(false);
                    return;
                }

                // Calculate map center from all zone coordinates
                const center = calculateMapCenter(providerZones);
                
                // Set provider marker position (use provider's location or zone center)
                const providerLat = provider?.location?.lat || provider?.latitude;
                const providerLng = provider?.location?.lng || provider?.longitude;
                
                if (providerLat && providerLng) {
                    setProviderMarkerPosition({
                        lat: parseFloat(providerLat),
                        lng: parseFloat(providerLng)
                    });
                } else {
                    // Use zone center as fallback
                    setProviderMarkerPosition(center);
                }

                setZoneData(providerZones);
                setMapCenter(center);
                setLoadingZones(false);
            } catch (err) {
                console.error("Failed to load zone data:", err);
                setZoneError("Failed to load zone data");
                setLoadingZones(false);
            }
        };

        fetchZoneData();
    }, [provider?.zones, provider?.city, provider?.location?.lat, provider?.location?.lng, provider?.latitude, provider?.longitude]);

    // Calculate map center from zone coordinates
    const calculateMapCenter = (zones) => {
        if (!zones || zones.length === 0) {
            return { lat: 23.1765, lng: 75.7885 }; // Default fallback
        }

        // Collect all coordinates from all zones
        const allCoords = zones.flatMap(z => z.coordinates || []);
        
        if (allCoords.length === 0) {
            return { lat: 23.1765, lng: 75.7885 };
        }

        // Calculate average lat/lng
        const avgLat = allCoords.reduce((sum, c) => sum + c.lat, 0) / allCoords.length;
        const avgLng = allCoords.reduce((sum, c) => sum + c.lng, 0) / allCoords.length;

        return { lat: avgLat, lng: avgLng };
    };

    // Handle polygon click to show zone info
    const handlePolygonClick = (zone) => {
        setSelectedZone(zone);
    };

    // Close info window
    const handleInfoWindowClose = () => {
        setSelectedZone(null);
    };

    const providerCity = summary?.provider?.city || provider?.city || "Your City";
    const hubName = `${providerCity} Hub`;

    // Map container style
    const mapContainerStyle = {
        width: '100%',
        height: '100%'
    };

    // Map options
    const mapOptions = {
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    };

    // Polygon options for each zone
    const getPolygonOptions = (zone) => ({
        strokeColor: "#8B5CF6",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#8B5CF6",
        fillOpacity: 0.2,
        clickable: true,
        draggable: false,
        editable: false,
    });

    // Marker icon for provider location
    const providerMarkerIcon = {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
        fillColor: "#8B5CF6",
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
        scale: 1.5,
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            {/* Custom Tab Header */}
            <div className="bg-white pt-6 md:pt-10 sticky top-0 z-10 shadow-sm">
                <div className="px-6 flex items-center justify-between mb-4">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-black text-slate-900 tracking-tight">Current Zone</h1>
                    <div className="w-9" /> {/* Spacer */}
                </div>

                <div className="flex border-b border-slate-100">
                    <div className="px-6 py-3 border-b-4 border-slate-900 font-black text-sm text-slate-900 tracking-tight">
                        {hubName}
                    </div>
                </div>
            </div>

            {/* Map Section */}
            <div className="p-4">
                <Card className="overflow-hidden rounded-3xl border-none shadow-xl bg-white ring-1 ring-slate-100">
                    <div className="relative aspect-[4/3] w-full bg-slate-100">
                        {loadingZones ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                                <Loader2 className="h-12 w-12 text-purple-600 mb-3 animate-spin" />
                                <p className="text-sm font-bold text-slate-500">Loading zone map...</p>
                            </div>
                        ) : zoneError || !mapCenter || zoneData.length === 0 ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                                <MapPin className="h-12 w-12 text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-500">
                                    {zoneError || "No zones assigned yet"}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">
                                    Please contact admin
                                </p>
                            </div>
                        ) : (
                            <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
                                <GoogleMap
                                    mapContainerStyle={mapContainerStyle}
                                    center={mapCenter}
                                    zoom={mapZoom}
                                    options={mapOptions}
                                >
                                    {/* Render polygons for each zone */}
                                    {zoneData.map((zone, index) => (
                                        <Polygon
                                            key={zone._id || index}
                                            paths={zone.coordinates}
                                            options={getPolygonOptions(zone)}
                                            onClick={() => handlePolygonClick(zone)}
                                        />
                                    ))}

                                    {/* Provider location marker */}
                                    {providerMarkerPosition && (
                                        <Marker
                                            position={providerMarkerPosition}
                                            icon={providerMarkerIcon}
                                            title="Your Location"
                                        />
                                    )}

                                    {/* Info window for selected zone */}
                                    {selectedZone && selectedZone.coordinates && selectedZone.coordinates.length > 0 && (
                                        <InfoWindow
                                            position={selectedZone.coordinates[0]}
                                            onCloseClick={handleInfoWindowClose}
                                        >
                                            <div className="p-2">
                                                <h3 className="font-bold text-sm text-slate-900 mb-1">
                                                    {selectedZone.name}
                                                </h3>
                                                <p className="text-xs text-slate-600">
                                                    Status: <span className="font-semibold text-green-600">Active</span>
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {providerCity}
                                                </p>
                                            </div>
                                        </InfoWindow>
                                    )}
                                </GoogleMap>
                            </LoadScript>
                        )}
                        
                        {!loadingZones && !zoneError && zoneData.length > 0 && (
                            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-slate-100 flex items-center gap-2 z-10">
                                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black tracking-widest uppercase text-slate-700">
                                    Live Zone Active
                                </span>
                            </div>
                        )}
                    </div>

                    <CardContent className="p-6 space-y-6 bg-white">
                        {/* Zone List */}
                        {zoneData.length > 0 && (
                            <div className="mb-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                                    Your Assigned Zones ({zoneData.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {zoneData.map((zone, index) => (
                                        <div
                                            key={zone._id || index}
                                            className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold border border-purple-100"
                                        >
                                            {zone.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-start gap-4 group">
                            <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                                <Briefcase className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[15px] font-bold text-slate-900 leading-snug">
                                    <span className="text-xl font-black mr-1">{summary?.hub?.jobs30d || 0}</span> jobs delivered within hub in last 30 days
                                </p>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Performance Metric</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 group">
                            <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                                <RefreshCw className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[15px] font-bold text-slate-900 leading-snug">
                                    <span className="text-xl font-black mr-1 text-purple-600">{summary?.hub?.repeatCustomers || 0} of {summary?.hub?.jobs30d || 0}</span> jobs were of repeat customers
                                </p>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Loyalty Score</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Need Help Section */}
            <div className="mt-4 p-6 bg-white border-t border-slate-100 shadow-sm rounded-t-[40px] flex-1">
                <div className="flex items-center gap-2 mb-6 ml-1">
                    <HelpCircle className="h-5 w-5 text-slate-400" />
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Need help?</h2>
                </div>

                <div className="space-y-2">
                    <button className="w-full flex items-center justify-between p-5 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                        <span className="text-[17px] font-bold text-slate-800 tracking-tight">What is a Hub?</span>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-900 transition-colors" />
                    </button>

                    <div className="h-px bg-slate-50 mx-4" />

                    <button className="w-full flex items-center justify-between p-5 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                        <span className="text-[17px] font-bold text-slate-800 tracking-tight">Getting rebooking leads outside hub</span>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-900 transition-colors" />
                    </button>
                </div>

                <div className="mt-12 p-6 rounded-3xl bg-slate-900 text-white relative overflow-hidden group">
                    <div className="relative z-10">
                        <h3 className="text-lg font-black tracking-tight mb-1">Expand Your Zone?</h3>
                        <p className="text-xs font-bold text-slate-400 max-w-[200px]">Unlock more leads by increasing your service radius.</p>
                        <button className="mt-4 bg-white text-slate-900 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-slate-100 transition-all active:scale-95">
                            Upgrade Now
                        </button>
                    </div>
                    <MapPin className="absolute -right-4 -bottom-4 h-32 w-32 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                </div>
            </div>
        </div>
    );
}
