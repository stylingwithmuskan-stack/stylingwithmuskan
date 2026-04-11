import React, { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Loader2, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { useProviderAuth } from "../contexts/ProviderAuthContext";
import { api } from "@/modules/user/lib/api";
import { GoogleMap, LoadScript, Polygon, InfoWindow } from '@react-google-maps/api';

export default function AllZonesMapPage() {
    const navigate = useNavigate();
    const { provider } = useProviderAuth();
    const [allZones, setAllZones] = useState([]);
    const [mapCenter, setMapCenter] = useState(null);
    const [selectedZone, setSelectedZone] = useState(null);
    const [loadingZones, setLoadingZones] = useState(true);
    const [zoneError, setZoneError] = useState(null);

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Fetch all zones for provider's city
    useEffect(() => {
        const fetchAllZones = async () => {
            if (!provider?.city) {
                setLoadingZones(false);
                setZoneError("City information not available");
                return;
            }

            try {
                setLoadingZones(true);
                setZoneError(null);

                console.log('🔥 [AllZonesMapPage] Fetching zones for city:', provider.city);
                
                // Fetch ALL zones for provider's city (no filtering)
                const response = await api.content.zones({ cityName: provider.city });
                
                console.log('🔥 [AllZonesMapPage] API Response:', response);
                console.log('🔥 [AllZonesMapPage] Total zones received:', response.zones?.length);
                console.log('🔥 [AllZonesMapPage] All zones:', response.zones);
                
                const zones = response.zones || [];

                // Separate zones with and without coordinates
                const zonesWithCoords = zones.filter(z => 
                    z.coordinates && 
                    Array.isArray(z.coordinates) && 
                    z.coordinates.length > 0
                );

                const zonesWithoutCoords = zones.filter(z => 
                    !z.coordinates || 
                    !Array.isArray(z.coordinates) || 
                    z.coordinates.length === 0
                );

                console.log('🔥 [AllZonesMapPage] Zones WITH coordinates:', zonesWithCoords.length, zonesWithCoords.map(z => z.name));
                console.log('🔥 [AllZonesMapPage] Zones WITHOUT coordinates:', zonesWithoutCoords.length, zonesWithoutCoords.map(z => z.name));
                console.log('🔥 [AllZonesMapPage] Provider assigned zones:', provider?.zones);

                // Show all zones in list, but only zones with coordinates on map
                setAllZones(zones); // All zones for list
                
                if (zonesWithCoords.length === 0) {
                    setZoneError("No zones with map coordinates available");
                    setLoadingZones(false);
                    return;
                }

                // Calculate map center from zones with coordinates only
                const center = calculateCityCenter(zonesWithCoords);
                
                setMapCenter(center);
                setLoadingZones(false);
            } catch (err) {
                console.error("🔥 [AllZonesMapPage] Error:", err);
                setZoneError("Failed to load zone data");
                setLoadingZones(false);
            }
        };

        fetchAllZones();
    }, [provider?.city]);

    // Calculate city center from all zone coordinates
    const calculateCityCenter = (zones) => {
        if (!zones || zones.length === 0) {
            return { lat: 28.4595, lng: 77.0266 }; // Default: Gurgaon
        }

        // Collect all coordinates from all zones
        const allCoords = zones.flatMap(z => z.coordinates || []);
        
        if (allCoords.length === 0) {
            return { lat: 28.4595, lng: 77.0266 };
        }

        // Calculate average lat/lng
        const avgLat = allCoords.reduce((sum, c) => sum + c.lat, 0) / allCoords.length;
        const avgLng = allCoords.reduce((sum, c) => sum + c.lng, 0) / allCoords.length;

        return { lat: avgLat, lng: avgLng };
    };

    // Check if zone is assigned to provider
    const isProviderZone = (zoneName) => {
        return provider?.zones?.includes(zoneName) || false;
    };

    // Get polygon options based on zone assignment
    const getPolygonOptions = (zone) => {
        const isAssigned = isProviderZone(zone.name);
        
        return {
            strokeColor: isAssigned ? "#8B5CF6" : "#10B981",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: isAssigned ? "#8B5CF6" : "#10B981",
            fillOpacity: isAssigned ? 0.3 : 0.15,
            clickable: true,
            draggable: false,
            editable: false,
        };
    };

    // Handle polygon click
    const handlePolygonClick = (zone) => {
        setSelectedZone(zone);
    };

    // Close info window
    const handleInfoWindowClose = () => {
        setSelectedZone(null);
    };

    const providerCity = provider?.city || "Your City";
    const assignedZonesCount = provider?.zones?.length || 0;
    const availableZonesCount = allZones.length - assignedZonesCount;

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

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white pt-6 md:pt-10 sticky top-0 z-10 shadow-sm">
                <div className="px-6 flex items-center justify-between mb-4">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-black text-slate-900 tracking-tight">All Service Zones</h1>
                    <div className="w-9" /> {/* Spacer */}
                </div>

                <div className="flex border-b border-slate-100">
                    <div className="px-6 py-3 border-b-4 border-slate-900 font-black text-sm text-slate-900 tracking-tight">
                        {providerCity}
                    </div>
                </div>
            </div>

            {/* Map Section */}
            <div className="p-4">
                <Card className="overflow-hidden rounded-3xl border-none shadow-xl bg-white ring-1 ring-slate-100">
                    <div className="relative aspect-[4/3] w-full bg-slate-100">
                        {loadingZones ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                                <Loader2 className="h-12 w-12 text-green-600 mb-3 animate-spin" />
                                <p className="text-sm font-bold text-slate-500">Loading all zones...</p>
                            </div>
                        ) : zoneError || !mapCenter || allZones.length === 0 ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                                <MapPin className="h-12 w-12 text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-500">
                                    {zoneError || "No zones available"}
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
                                    zoom={11}
                                    options={mapOptions}
                                >
                                    {/* Render polygons only for zones with coordinates */}
                                    {allZones
                                        .filter(zone => zone.coordinates && Array.isArray(zone.coordinates) && zone.coordinates.length > 0)
                                        .map((zone, index) => (
                                            <Polygon
                                                key={zone._id || index}
                                                paths={zone.coordinates}
                                                options={getPolygonOptions(zone)}
                                                onClick={() => handlePolygonClick(zone)}
                                            />
                                        ))
                                    }

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
                                                    {isProviderZone(selectedZone.name) ? (
                                                        <span className="font-semibold text-purple-600">✓ Your Active Zone</span>
                                                    ) : (
                                                        <span className="font-semibold text-green-600">Available Zone</span>
                                                    )}
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
                        
                        {/* Legend */}
                        {!loadingZones && !zoneError && allZones.length > 0 && (
                            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-100 z-10">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 mb-2">Legend</p>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-purple-500/30 border-2 border-purple-500 rounded" />
                                        <span className="text-[10px] font-bold text-slate-600">Your Zones</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-green-500/15 border-2 border-green-500 rounded" />
                                        <span className="text-[10px] font-bold text-slate-600">Other Zones</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Status Badge */}
                        {!loadingZones && !zoneError && allZones.length > 0 && (
                            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-slate-100 flex items-center gap-2 z-10">
                                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black tracking-widest uppercase text-slate-700">
                                    {allZones.length} Zones
                                </span>
                            </div>
                        )}
                    </div>

                    <CardContent className="p-6 space-y-6 bg-white">
                        {/* Statistics */}
                        {allZones.length > 0 && (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-2xl font-black text-slate-900">{allZones.length}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Total Zones</p>
                                </div>
                                <div className="text-center p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                    <p className="text-2xl font-black text-purple-600">{assignedZonesCount}</p>
                                    <p className="text-[10px] text-purple-600 font-bold uppercase tracking-widest mt-1">Your Zones</p>
                                </div>
                                <div className="text-center p-4 bg-green-50 rounded-2xl border border-green-100">
                                    <p className="text-2xl font-black text-green-600">{availableZonesCount}</p>
                                    <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest mt-1">Available</p>
                                </div>
                            </div>
                        )}

                        {/* Info Card */}
                        <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                <Info className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-blue-900 mb-1">Service Coverage Map</p>
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    This map shows all service zones in {providerCity}. Purple zones are assigned to you, green zones are available for expansion.
                                </p>
                            </div>
                        </div>

                        {/* All Zones List */}
                        {allZones.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                                    All Zones in {providerCity} ({allZones.length})
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {allZones.map((zone, index) => {
                                        const isAssigned = isProviderZone(zone.name);
                                        const hasCoordinates = zone.coordinates && Array.isArray(zone.coordinates) && zone.coordinates.length > 0;
                                        
                                        return (
                                            <div
                                                key={zone._id || index}
                                                onClick={() => hasCoordinates ? handlePolygonClick(zone) : null}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                                                    !hasCoordinates 
                                                        ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' 
                                                        : isAssigned 
                                                            ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm cursor-pointer hover:scale-105' 
                                                            : 'bg-green-50 text-green-700 border-green-200 cursor-pointer hover:scale-105'
                                                }`}
                                                title={!hasCoordinates ? 'Map coordinates not set by admin' : ''}
                                            >
                                                {isAssigned && <span className="mr-1">✓</span>}
                                                {!hasCoordinates && <span className="mr-1">📍</span>}
                                                {zone.name}
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {/* Info about zones without coordinates */}
                                {allZones.some(z => !z.coordinates || !Array.isArray(z.coordinates) || z.coordinates.length === 0) && (
                                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                        <p className="text-xs text-amber-800 font-medium">
                                            <span className="font-bold">📍 Note:</span> Some zones don't have map coordinates yet. They will appear on the map once admin sets their boundaries.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* CTA Section */}
            <div className="mt-4 p-6 bg-white border-t border-slate-100 shadow-sm rounded-t-[40px]">
                <div className="p-6 rounded-3xl bg-slate-900 text-white relative overflow-hidden group">
                    <div className="relative z-10">
                        <h3 className="text-lg font-black tracking-tight mb-1">Want to Expand?</h3>
                        <p className="text-xs font-bold text-slate-400 max-w-[240px]">
                            Request access to more zones and increase your earning potential.
                        </p>
                        <button 
                            onClick={() => navigate("/provider/profile")}
                            className="mt-4 bg-white text-slate-900 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-slate-100 transition-all active:scale-95"
                        >
                            Request New Zone
                        </button>
                    </div>
                    <MapPin className="absolute -right-4 -bottom-4 h-32 w-32 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                </div>
            </div>
        </div>
    );
}
