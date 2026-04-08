import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Navigation, Home, Briefcase, Plus } from "lucide-react";
import { useAuth } from "@/modules/user/contexts/AuthContext";
import { Button } from "@/modules/user/components/ui/button";
import { api } from "@/modules/user/lib/api";

const AddressModal = ({ isOpen, onClose, onSave, initialAddress }) => {
    const { updateAddress, updateExistingAddress } = useAuth();
    const areaInputRef = useRef(null);
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
    const [cities, setCities] = useState([]);
    const [zones, setZones] = useState([]);
    const [zonesLoading, setZonesLoading] = useState(false);
    const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

    useEffect(() => {
        api.content.cities().then(res => setCities(res.cities || [])).catch(() => {});
    }, []);


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
                _id: initialAddress._id || initialAddress.id
            });
        } else {
            setAddress({ houseNo: "", landmark: "", area: "", city: "", cityId: "", zone: "", zoneId: "", type: "home", _id: undefined });
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
            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                if (!place || !place.geometry) return;
                
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const comp = place.address_components || [];
                
                const getComp = (types) => comp.find(c => types.some(t => c.types.includes(t)))?.long_name || "";

                const houseNo = getComp(["street_number", "premise", "subpremise"]);
                const landmark = getComp(["neighborhood", "sublocality_level_2", "sublocality_level_3"]);
                const area = place.formatted_address || place.name || address.area;
                const city = getComp(["locality", "administrative_area_level_2"]);
                
                setAddress(prev => ({ 
                    ...prev, 
                    houseNo: houseNo || prev.houseNo,
                    landmark: landmark || prev.landmark,
                    area, 
                    city: city || prev.city, 
                    lat, 
                    lng 
                }));
            });
        } catch {
            // silent fallback
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, mapsReady]);

    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const apply = (areaStr, cityStr) => {
                    setAddress(prev => ({ ...prev, area: areaStr, city: cityStr || prev.city, lat: latitude, lng: longitude }));
                    setIsLocating(false);
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
                            alert(`Location captured!\nDetected zone: ${location.zoneName}`);
                        } else if (location.reason === "out_of_zone") {
                            alert("Service is not available at your current location yet.");
                        }
                    } catch {}
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
                                } else {
                                    if (status === "REQUEST_DENIED") {
                                        alert("Google Maps Geocoding API is not enabled. Please enable it in your Google Cloud Console.");
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
                alert("Unable to retrieve your location. Please enter manually.");
                console.error(error);
            }
        );
    };

    const handleSave = (e) => {
        e.preventDefault();
        if (address.houseNo && address.area && address.city) {
            if (address._id) {
                updateExistingAddress(address._id, {
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
                updateAddress({
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
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-10 sm:p-8 md:p-12">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 10 }}
                        className="relative w-full max-w-lg bg-background rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden my-auto"
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
                                        onChange={e => setAddress({ ...address, houseNo: e.target.value })}
                                        placeholder="e.g. B-12, 4th Floor"
                                        className="w-full h-12 px-4 rounded-xl bg-accent border-none text-base focus:ring-2 focus:ring-primary/20 transition-all"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Landmark (Optional)</label>
                                    <input
                                        type="text"
                                        value={address.landmark}
                                        onChange={e => setAddress({ ...address, landmark: e.target.value })}
                                        placeholder="e.g. Near Central Park"
                                        className="w-full h-12 px-4 rounded-xl bg-accent border-none text-base focus:ring-2 focus:ring-primary/20 transition-all"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Area / Locality*</label>
                                    <div className="relative group">
                                        <Navigation className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isLocating ? 'text-primary animate-pulse' : 'text-primary'}`} />
                                    <input
                                        ref={areaInputRef}
                                            type="text"
                                            required
                                            value={address.area}
                                            onChange={e => setAddress({ ...address, area: e.target.value })}
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
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">City*</label>
                                    <select
                                        required
                                        value={address.city || ""}
                                        onChange={e => {
                                            const selectedCity = cities.find((c) => c.name === e.target.value);
                                            setAddress({
                                                ...address,
                                                city: e.target.value,
                                                cityId: selectedCity?._id || "",
                                                zone: "",
                                                zoneId: "",
                                            });
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
                                            setAddress({
                                                ...address,
                                                zone: selectedZone?.name || "",
                                                zoneId: selectedZone?._id || "",
                                            });
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
                                            onClick={() => setAddress({ ...address, type: type.id })}
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
                                disabled={isLocating}
                                className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 border-none bg-black text-white hover:bg-black/90"
                            >
                                CONFIRM LOCATION
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AddressModal;
