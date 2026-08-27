import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Navigation, Home, Briefcase, Plus } from "lucide-react";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { Button } from "@/modules/user/components/ui/button";
import { api } from "@/modules/user/lib/api";
import { toast } from "sonner";
import LocationPermissionPopup from "./LocationPermissionPopup";

const AddressModal = ({ isOpen, onClose, onSave, initialAddress }) => {
    const { updateAddress, updateExistingAddress } = useAuth();
    const [showLocationPopup, setShowLocationPopup] = useState(false);
    const [locationErrorType, setLocationErrorType] = useState("denied");
    const areaInputRef = useRef(null);
    const modalRef = useRef(null);
    const [address, setAddress] = useState({
        houseNo: "",
        landmark: "",
        area: "",
        city: "",
        cityId: "",
        zone: "",
        zoneId: "",
        type: "home",
        _id: undefined
    });
    const [isLocating, setIsLocating] = useState(false);
    const [mapsReady, setMapsReady] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerInstanceRef = useRef(null);
    const [cities, setCities] = useState([]);
    const [zones, setZones] = useState([]);
    const [zonesLoading, setZonesLoading] = useState(false);
    const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            const scrollY = window.scrollY;
            document.documentElement.classList.add("modal-open");
            document.body.classList.add("modal-open");
            document.body.style.top = `-${scrollY}px`;
            document.body.dataset.scrollY = scrollY;
        } else {
            const activeModals = Array.from(document.querySelectorAll('.swm-modal-active'))
                .filter(el => el !== modalRef.current).length;
            if (activeModals === 0) {
                const scrollY = parseInt(document.body.dataset.scrollY || "0", 10);
                document.documentElement.classList.remove("modal-open");
                document.body.classList.remove("modal-open");
                document.body.style.top = "";
                if (scrollY > 0) window.scrollTo(0, scrollY);
            }
        }
        return () => {
            const activeModals = Array.from(document.querySelectorAll('.swm-modal-active'))
                .filter(el => el !== modalRef.current).length;
            if (activeModals === 0) {
                const scrollY = parseInt(document.body.dataset.scrollY || "0", 10);
                document.documentElement.classList.remove("modal-open");
                document.body.classList.remove("modal-open");
                document.body.style.top = "";
                if (scrollY > 0) window.scrollTo(0, scrollY);
            }
        };
    }, [isOpen]);

    useEffect(() => {
        api.content.cities().then(res => setCities(res.cities || [])).catch(() => { });
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setShowMap(false);
            mapInstanceRef.current = null;
            markerInstanceRef.current = null;
        }
    }, [isOpen]);


    React.useEffect(() => {
        if (initialAddress) {
            setAddress({
                houseNo: initialAddress.houseNo || "",
                landmark: initialAddress.landmark || "",
                area: initialAddress.area || "",
                city: initialAddress.city || "",
                cityId: initialAddress.cityId || "",
                zone: initialAddress.zone || "",
                zoneId: initialAddress.zoneId || "",
                type: initialAddress.type || "home",
                lat: initialAddress.lat || null,
                lng: initialAddress.lng || null,
                _id: initialAddress._id || initialAddress.id
            });
        } else {
            setAddress({ houseNo: "", landmark: "", area: "", city: "", cityId: "", zone: "", zoneId: "", type: "home", lat: null, lng: null, _id: undefined });
        }
    }, [initialAddress, isOpen]);

    useEffect(() => {
        if (!address.city) {
            setZones([]);
            return;
        }
        let cancelled = false;
        setZonesLoading(true);
        api.content.zones({ cityName: address.city }).then((res) => {
            if (cancelled) return;
            setZones(res.zones || []);
        }).catch(() => {
            if (!cancelled) setZones([]);
        }).finally(() => {
            if (!cancelled) setZonesLoading(false);
        });
        return () => { cancelled = true; };
    }, [address.city]);

    useEffect(() => {
        if (!isOpen) return;
        if (!googleKey) return;
        if (window.google?.maps?.places) {
            setMapsReady(true);
            return;
        }
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}&libraries=places`;
        script.async = true;
        script.onload = () => setMapsReady(true);
        script.onerror = () => setMapsReady(false);
        document.body.appendChild(script);
        // no cleanup to keep one-time load
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, googleKey]);

    useEffect(() => {
        if (!isOpen || !mapsReady || !areaInputRef.current || !window.google?.maps?.places) return;
        try {
            const autocomplete = new window.google.maps.places.Autocomplete(areaInputRef.current, {
                types: ["geocode"]
            });
            autocomplete.setFields(["address_components", "geometry", "formatted_address", "name"]);

            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                if (!place || !place.geometry) return;

                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const comp = place.address_components || [];

                const getComp = (types) => comp.find(c => types.some(t => c.types.includes(t)))?.long_name || "";

                const houseNo = getComp(["street_number", "premise", "subpremise"]);
                const landmark = getComp(["neighborhood", "sublocality_level_2", "sublocality_level_3"]);
                const area = place.formatted_address || place.name || "";
                const city = getComp(["locality", "administrative_area_level_2"]);

                console.log("[AddressModal] Autocomplete selected:", { area, city, lat, lng });

                setAddress(prev => ({
                    ...prev,
                    houseNo: houseNo || prev.houseNo,
                    landmark: landmark || prev.landmark,
                    area,
                    city: city || prev.city,
                    lat,
                    lng
                }));

                setShowMap(true); // Open the map so user can see it!
                
                if (mapInstanceRef.current) {
                    const newPos = { lat, lng };
                    mapInstanceRef.current.panTo(newPos);
                    if (markerInstanceRef.current) markerInstanceRef.current.setPosition(newPos);
                }
            });
        } catch {
            // silent fallback
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, mapsReady]);

    useEffect(() => {
        if (!showMap || !mapsReady || !mapContainerRef.current || !window.google?.maps) return;

        if (!mapInstanceRef.current) {
            const initialLat = address.lat || 22.7196; // Default to Indore or current lat
            const initialLng = address.lng || 75.8577;

            mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
                center: { lat: initialLat, lng: initialLng },
                zoom: 15,
                disableDefaultUI: true,
                zoomControl: true,
                gestureHandling: "greedy", // allows 1-finger panning on mobile
            });

            markerInstanceRef.current = new window.google.maps.Marker({
                position: { lat: initialLat, lng: initialLng },
                map: mapInstanceRef.current,
                draggable: false,
                animation: window.google.maps.Animation.DROP,
            });

            const handleLocationChange = (latLng) => {
                const lat = latLng.lat();
                const lng = latLng.lng();

                const geocoder = new window.google.maps.Geocoder();
                geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                    if (status === "OK" && results && results[0]) {
                        const res = results[0];
                        const comp = res.address_components || [];
                        const getComp = (types) => comp.find(c => types.some(t => c.types.includes(t)))?.long_name || "";

                        const houseNo = getComp(["street_number", "premise", "subpremise"]);
                        const landmark = getComp(["neighborhood", "sublocality_level_2", "sublocality_level_3"]);
                        const area = res.formatted_address;
                        const city = getComp(["locality", "administrative_area_level_2"]);

                        setAddress(prev => ({
                            ...prev,
                            houseNo: houseNo || prev.houseNo,
                            landmark: landmark || prev.landmark,
                            area: area,
                            city: city || prev.city,
                            lat,
                            lng
                        }));
                    }
                });
            };

            // Keep marker exactly in the center while map is dragged
            window.google.maps.event.addListener(mapInstanceRef.current, 'center_changed', () => {
                markerInstanceRef.current.setPosition(mapInstanceRef.current.getCenter());
            });

            // Geocode when map stops moving
            window.google.maps.event.addListener(mapInstanceRef.current, 'idle', () => {
                handleLocationChange(mapInstanceRef.current.getCenter());
            });

            // Also geocode if they click somewhere (which moves the map center)
            window.google.maps.event.addListener(mapInstanceRef.current, 'click', (event) => {
                mapInstanceRef.current.panTo(event.latLng);
            });
        } else {
            if (address.lat && address.lng) {
                const newPos = { lat: address.lat, lng: address.lng };
                mapInstanceRef.current.setCenter(newPos);
                if (markerInstanceRef.current) markerInstanceRef.current.setPosition(newPos);
            }
        }
    }, [showMap, mapsReady]);

    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const apply = (areaStr, cityStr) => {
                    setAddress(prev => ({ ...prev, area: areaStr, city: cityStr || prev.city, lat: latitude, lng: longitude }));
                    setIsLocating(false);
                    if (mapInstanceRef.current) {
                        const newPos = { lat: latitude, lng: longitude };
                        mapInstanceRef.current.panTo(newPos);
                        if (markerInstanceRef.current) markerInstanceRef.current.setPosition(newPos);
                    }
                };
                const resolveZone = async (nextCity) => {
                    try {
                        const res = await api.content.resolveLocation({
                            lat: String(latitude),
                            lng: String(longitude),
                            cityName: nextCity || address.city || "",
                        });
                        const location = res?.location || {};
                        setAddress(prev => ({
                            ...prev,
                            city: location.cityName || nextCity || prev.city,
                            cityId: location.cityId || prev.cityId,
                            zone: location.zoneName || prev.zone,
                            zoneId: location.zoneId || prev.zoneId,
                        }));
                        if (location.insideServiceArea && location.zoneName) {
                            toast.success(`Location captured!`, {
                                description: `Detected zone: ${location.zoneName}`
                            });
                        } else if (location.reason === "out_of_zone") {
                            toast.info("Service not available", {
                                description: "Service is not available at your current location yet."
                            });
                        }
                    } catch { }
                };
                if (window.google?.maps && googleKey) {
                    try {
                        const geocoder = new window.google.maps.Geocoder();
                        geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
                            if (status === "OK" && results && results[0]) {
                                const res = results[0];
                                const comp = res.address_components || [];

                                const getComp = (types) => comp.find(c => types.some(t => c.types.includes(t)))?.long_name || "";

                                const houseNo = getComp(["street_number", "premise", "subpremise"]);
                                const landmark = getComp(["neighborhood", "sublocality_level_2", "sublocality_level_3"]);
                                const area = res.formatted_address;
                                const city = getComp(["locality", "administrative_area_level_2"]);

                                setAddress(prev => ({
                                    ...prev,
                                    houseNo: houseNo || prev.houseNo,
                                    landmark: landmark || prev.landmark,
                                    area: area,
                                    city: city || prev.city,
                                    zone: prev.zone || "",
                                    lat: latitude,
                                    lng: longitude
                                }));
                                resolveZone(city || "");
                                setIsLocating(false);
                                
                                setShowMap(true); // Always show map so they can adjust
                                
                                if (mapInstanceRef.current) {
                                    const newPos = { lat: latitude, lng: longitude };
                                    mapInstanceRef.current.panTo(newPos);
                                    if (markerInstanceRef.current) markerInstanceRef.current.setPosition(newPos);
                                }
                            } else {
                                if (status === "REQUEST_DENIED") {
                                    toast.error("Google Maps API error", {
                                        description: "Google Maps Geocoding API is not enabled. Please check console."
                                    });
                                }
                                apply("Current Location", "");
                                resolveZone("");
                            }
                        });
                    } catch {
                        apply("Current Location", "");
                        resolveZone("");
                    }
                } else {
                    apply("Current Location", "");
                    resolveZone("");
                }
            },
            (error) => {
                setIsLocating(false);
                if (error.code === 1) {
                    // PERMISSION_DENIED
                    setLocationErrorType("denied");
                    setShowLocationPopup(true);
                } else if (error.code === 2) {
                    // POSITION_UNAVAILABLE
                    setLocationErrorType("unavailable");
                    setShowLocationPopup(true);
                } else if (error.code === 3) {
                    // TIMEOUT
                    setLocationErrorType("timeout");
                    setShowLocationPopup(true);
                } else {
                    toast.error("Unable to retrieve your location", {
                        description: "Please enter your address manually."
                    });
                }
                console.error(error);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    };

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        if (address.houseNo && address.area && address.city) {
            setIsSaving(true);
            try {
                if (address._id) {
                    await updateExistingAddress(address._id, {
                        houseNo: address.houseNo,
                        area: address.area,
                        landmark: address.landmark,
                        city: address.city,
                        cityId: address.cityId,
                        zone: address.zone,
                        zoneId: address.zoneId,
                        type: address.type,
                        lat: address.lat,
                        lng: address.lng
                    });
                } else {
                    await updateAddress({
                        houseNo: address.houseNo,
                        area: address.area,
                        landmark: address.landmark,
                        city: address.city,
                        cityId: address.cityId,
                        zone: address.zone,
                        zoneId: address.zoneId,
                        type: address.type,
                        lat: address.lat,
                        lng: address.lng
                    });
                }
                onSave?.();
                onClose();
            } catch (error) {
                console.error("[AddressModal] Save failed:", error);
                const msg = error.data?.error || error.message || "Failed to save address";

                if (msg.toLowerCase().includes("unauthorized") || error.status === 401) {
                    toast.error("Please login first to save address", {
                        description: "You need to be logged in to manage your addresses."
                    });
                } else {
                    toast.error(msg);
                }
            } finally {
                setIsSaving(false);
            }
        }
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[200] flex items-end sm:items-center sm:justify-center sm:p-8 md:p-12">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        />

                        <motion.div
                            ref={modalRef}
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 40 }}
                            transition={{ type: "spring", damping: 28, stiffness: 300 }}
                            className="relative w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-lg bg-background sm:rounded-[32px] rounded-none shadow-2xl flex flex-col overflow-hidden swm-modal-active"
                        >
                            {/* Fixed Header */}
                            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-background z-10 shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold font-display uppercase tracking-tight">Select Delivery Location</h2>
                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">Where should we deliver?</p>
                                </div>
                                <button onClick={onClose} className="p-2 rounded-full hover:bg-accent transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-6 sm:p-8">
                                <form id="address-form" onSubmit={handleSave} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">House / Flat No.*</label>
                                        <input
                                            autoFocus
                                            type="text"
                                            required
                                            value={address.houseNo}
                                            onChange={e => setAddress(prev => ({ ...prev, houseNo: e.target.value }))}
                                            placeholder="e.g. B-12, 4th Floor"
                                            className="w-full h-12 px-4 rounded-xl bg-accent border-none text-base focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Landmark (Optional)</label>
                                        <input
                                            type="text"
                                            value={address.landmark}
                                            onChange={e => setAddress(prev => ({ ...prev, landmark: e.target.value }))}
                                            placeholder="e.g. Near Central Park"
                                            className="w-full h-12 px-4 rounded-xl bg-accent border-none text-base focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1 flex justify-between items-center">
                                            <span>Area / Locality*</span>
                                            <button type="button" onClick={() => setShowMap(true)} className="text-primary hover:underline flex items-center gap-1 text-[10px]">
                                                <MapPin className="w-3 h-3" />
                                                {showMap ? "Adjust Pin on Map" : "Choose on Map"}
                                            </button>
                                        </label>
                                        <div className="relative group">
                                            <Navigation className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isLocating ? 'text-primary animate-pulse' : 'text-primary'}`} />
                                            <input
                                                ref={areaInputRef}
                                                type="text"
                                                required
                                                value={address.area}
                                                onChange={e => setAddress(prev => ({ ...prev, area: e.target.value }))}
                                                placeholder="Select your area"
                                                className="w-full h-12 pl-11 pr-32 rounded-xl bg-accent border-none text-base focus:ring-2 focus:ring-primary/20 transition-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleGetCurrentLocation}
                                                disabled={isLocating}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                {isLocating ? "LOCATING..." : "USE CURRENT"}
                                            </button>
                                        </div>
                                        <AnimatePresence>
                                            {showMap && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="mt-2 relative w-full h-48 rounded-xl overflow-hidden border border-border">
                                                        <div ref={mapContainerRef} className="w-full h-full" />
                                                        {!mapsReady && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-accent/50 backdrop-blur-sm">
                                                                <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                                            </div>
                                                        )}
                                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[10px] px-3 py-1.5 rounded-full backdrop-blur-md whitespace-nowrap pointer-events-none">
                                                            Drag the marker to your exact location
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">City*</label>
                                        <select
                                            required
                                            value={address.city || ""}
                                            onChange={e => {
                                                const selectedCity = cities.find((c) => c.name === e.target.value);
                                                setAddress(prev => ({
                                                    ...prev,
                                                    city: e.target.value,
                                                    cityId: selectedCity?._id || "",
                                                    zone: "",
                                                    zoneId: ""
                                                }));
                                            }}
                                            className="w-full h-12 px-4 rounded-xl bg-accent border-none text-base focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                                        >
                                            <option value="" disabled>Select City</option>
                                            {cities.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Zone*</label>
                                        <select
                                            required
                                            value={address.zoneId || ""}
                                            onChange={e => {
                                                const selectedZone = zones.find((z) => z._id === e.target.value);
                                                setAddress(prev => ({
                                                    ...prev,
                                                    zone: selectedZone?.name || "",
                                                    zoneId: selectedZone?._id || ""
                                                }));
                                            }}
                                            className="w-full h-12 px-4 rounded-xl bg-accent border-none text-base focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                                            disabled={!address.city || zonesLoading}
                                        >
                                            <option value="" disabled>
                                                {zonesLoading ? "Loading zones..." : address.city ? "Select Zone" : "Select city first"}
                                            </option>
                                            {zones.map((z) => <option key={z._id} value={z._id}>{z.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 pt-2">
                                        {[
                                            { id: 'home', icon: Home, label: 'Home' },
                                            { id: 'work', icon: Briefcase, label: 'Work' },
                                            { id: 'other', icon: MapPin, label: 'Other' }
                                        ].map(type => (
                                            <button
                                                key={type.id}
                                                type="button"
                                                onClick={() => setAddress(prev => ({ ...prev, type: type.id }))}
                                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${address.type === type.id ? 'border-primary bg-primary/5 text-primary' : 'border-border grayscale opacity-60'}`}
                                            >
                                                <type.icon className="w-5 h-5" />
                                                <span className="text-[10px] font-bold uppercase">{type.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </form>
                            </div>

                            {/* Fixed Footer */}
                            <div className="p-6 bg-background border-t border-border shrink-0">
                                <Button
                                    type="submit"
                                    form="address-form"
                                    disabled={isLocating || isSaving}
                                    className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 border-none bg-black text-white hover:bg-black/90"
                                >
                                    {isSaving ? "SAVING..." : "CONFIRM LOCATION"}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <LocationPermissionPopup
                isOpen={showLocationPopup}
                onClose={() => setShowLocationPopup(false)}
                errorType={locationErrorType}
            />
        </>
    );
};

export default AddressModal;
