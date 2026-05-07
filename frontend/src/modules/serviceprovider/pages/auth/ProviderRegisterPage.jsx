import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ChevronLeft,
    ArrowRight,
    Check,
    Camera,
    Upload,
    ShieldCheck,
    Briefcase,
    Banknote,
    FileText,
    Loader2,
    Trash2,
    RotateCcw,
    X,
    Plus,
    AlertCircle,
    CheckCircle2,
    User,
    ChevronDown
} from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { Progress } from "@/modules/user/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/modules/user/components/ui/select";
import { Badge } from "@/modules/user/components/ui/badge";
import { Checkbox } from "@/modules/user/components/ui/checkbox";
import { Label } from "@/modules/user/components/ui/label";
import { useProviderAuth } from "@/modules/serviceprovider/contexts/ProviderAuthContext";
import { api } from "@/modules/user/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { openFlutterCamera, isFlutterWebView } from "@/utils/flutterBridge";

const steps = [
    { title: "Personal", icon: CheckCircle2 },
    { title: "KYC", icon: ShieldCheck },
    { title: "Professional", icon: Briefcase },
    { title: "Bank", icon: Banknote },
    { title: "Review", icon: FileText }
];

const STORAGE_KEY = 'swm-provider-registration';
const EXPIRY_DAYS = 7;
const CATALOG_REQUEST_TIMEOUT_MS = 10000;

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
        ),
    ]);
}

async function fetchCatalogArray(label, requestFn) {
    try {
        const res = await withTimeout(requestFn(), CATALOG_REQUEST_TIMEOUT_MS, label);
        return Array.isArray(res?.data) ? res.data : [];
    } catch (error) {
        if (import.meta?.env?.DEV) {
            console.warn("[ProviderRegisterCatalog] request fallback", {
                endpoint: label,
                reason: error?.message || "unknown",
            });
        }
        return [];
    }
}

export default function ProviderRegisterPage() {
    const navigate = useNavigate();
    const { register, provider, requestRegisterOtp, verifyRegisterOtp } = useProviderAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [stepError, setStepError] = useState("");

    // Google Maps API key for geocoding
    const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    const [cities, setCities] = useState([]);
    const [zones, setZones] = useState([]);
    const [zonesLoading, setZonesLoading] = useState(false);
    const [serviceTypesList, setServiceTypesList] = useState([]);
    const [categoriesList, setCategoriesList] = useState([]);
    const [servicesList, setServicesList] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const fetchedServiceCategoriesRef = useRef(new Set());

    // OTP States - Declared early to avoid initialization errors
    const [otp, setOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [otpError, setOtpError] = useState("");
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpDeliveryMode, setOtpDeliveryMode] = useState("sms");

    // Form States
    const [formData, setFormData] = useState({
        phone: provider?.phone || "",
        name: "",
        email: "",
        gender: "",
        dob: "",
        experience: "",
        addressLine1: "",
        area: "",
        city: "",
        cityId: "",
        zones: [],
        zoneIds: [],
        customZone: "",
        profilePhoto: null,
        aadharFront: null,
        aadharBack: null,
        panCard: null,
        certifications: [],
        services: [],
        primaryCategory: [],
        specializations: [],
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        upiId: "",
        lat: null,
        lng: null,
        agreedCommission: false,
        agreedGuidelines: false,
        agreedBackgroundCheck: false
    });

    useEffect(() => {
        api.content.cities().then(res => setCities(res.cities || [])).catch(() => { });
        
        // Load saved registration data from localStorage
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const { data, timestamp } = JSON.parse(saved);
                const daysPassed = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
                
                // Check if data is not expired
                if (daysPassed <= EXPIRY_DAYS) {
                    setCurrentStep(data.currentStep || 1);
                    setFormData(prev => ({ ...prev, ...data.formData }));
                    if (data.otpVerified) setOtpVerified(true);
                    if (data.otpSent) setOtpSent(true);
                } else {
                    // Clear expired data
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (error) {
            console.error('Failed to load saved registration:', error);
        }
    }, [cities]); // Added cities to dependency to ensure cityId mapping works

    // Sanitize and validate formData after loading or during updates
    useEffect(() => {
        if (!Array.isArray(formData.certifications)) {
            setFormData(prev => ({ ...prev, certifications: [] }));
        }
    }, [formData.certifications]);

    // Auto-save registration progress to localStorage
    useEffect(() => {
        try {
            const dataToSave = {
                data: {
                    currentStep,
                    formData,
                    otpVerified,
                    otpSent
                },
                timestamp: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        } catch (error) {
            console.error('Failed to save registration progress:', error);
        }
    }, [currentStep, formData, otpVerified, otpSent]);

    // Scroll to top on step change
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentStep]);

    useEffect(() => {
        let cancelled = false;
        setCatalogLoading(true);
        Promise.all([
            fetchCatalogArray("/content/service-types", () => api.content.serviceTypes()),
            fetchCatalogArray("/content/categories", () => api.content.categories()),
            fetchCatalogArray("/content/services?limit=1000", () => api.content.services({ limit: 1000 })),
        ]).then(([types, categories, services]) => {
            if (cancelled) return;
            setServiceTypesList(types);
            setCategoriesList(categories);
            setServicesList(services);
        }).finally(() => {
            if (!cancelled) setCatalogLoading(false);
        });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (formData.city) {
            setZonesLoading(true);
            api.content.zones({ cityName: formData.city }).then(res => {
                const nextZones = res.zones || [];
                setZones(nextZones);
                setFormData(prev => {
                    const nextSelectedZones = prev.zones.filter((zoneName) => nextZones.some((zone) => zone.name === zoneName));
                    const nextSelectedZoneIds = nextZones
                        .filter((zone) => nextSelectedZones.includes(zone.name))
                        .map((zone) => zone._id);
                    return { ...prev, zones: nextSelectedZones, zoneIds: nextSelectedZoneIds };
                });
            }).catch(() => {
                setZones([]);
            }).finally(() => {
                setZonesLoading(false);
            });
        } else {
            setZones([]);
        }
    }, [formData.city]);

    const syncSelectedZoneIds = (selectedZoneNames, availableZones = zones) => {
        const nextZoneIds = availableZones
            .filter((zone) => selectedZoneNames.includes(zone.name))
            .map((zone) => zone._id);
        setFormData((prev) => ({ ...prev, zones: selectedZoneNames, zoneIds: nextZoneIds }));
    };

    const {
        serviceTypeOptions,
        filteredCategories,
        serviceOptions
    } = useMemo(() => {
        const types = Array.isArray(serviceTypesList) ? serviceTypesList.filter(st => st?.label) : [];
        const selectedTypeLabels = new Set(formData.primaryCategory);
        const selectedTypeIds = new Set(
            types.filter(st => selectedTypeLabels.has(st.label)).map(st => st.id)
        );

        let cats = [];
        const catsRaw = Array.isArray(categoriesList) ? categoriesList.filter(c => c?.name) : [];
        if (selectedTypeIds.size > 0 || selectedTypeLabels.size > 0) {
            cats = catsRaw.filter(c => 
                selectedTypeIds.has(c.serviceType) || selectedTypeLabels.has(c.serviceType)
            );
        }

        const selectedCatNames = new Set(formData.specializations);
        const selectedCatIds = new Set(cats.filter(c => selectedCatNames.has(c.name)).map(c => c.id));
        
        let services = [];
        const servicesRaw = Array.isArray(servicesList) ? servicesList.filter(s => s?.name) : [];
        if (selectedCatIds.size > 0 || selectedCatNames.size > 0) {
            services = servicesRaw.filter(s => 
                selectedCatIds.has(s.category) || selectedCatNames.has(s.category)
            );
        }

        return {
            serviceTypeOptions: types,
            filteredCategories: cats,
            serviceOptions: services
        };
    }, [serviceTypesList, categoriesList, servicesList, formData.primaryCategory, formData.specializations]);

    // Recovery path: if the bulk services request misses data, lazily hydrate services per selected category.
    useEffect(() => {
        if (catalogLoading || !Array.isArray(filteredCategories) || filteredCategories.length === 0) return;

        const categoryIds = filteredCategories
            .map((c) => String(c?.id || ""))
            .filter(Boolean);
        if (categoryIds.length === 0) return;

        const existingCategoryIds = new Set(
            (Array.isArray(servicesList) ? servicesList : [])
                .map((s) => String(s?.category || ""))
                .filter(Boolean)
        );

        const missingCategoryIds = categoryIds.filter(
            (id) => !existingCategoryIds.has(id) && !fetchedServiceCategoriesRef.current.has(id)
        );
        if (missingCategoryIds.length === 0) return;

        let cancelled = false;
        Promise.all(
            missingCategoryIds.map((id) =>
                fetchCatalogArray(`/content/services?category=${id}`, () => api.content.services({ category: id }))
                    .then((items) => ({ id, items }))
            )
        ).then((results) => {
            if (cancelled) return;

            for (const { id } of results) fetchedServiceCategoriesRef.current.add(id);

            const merged = [];
            for (const { items } of results) {
                if (Array.isArray(items) && items.length > 0) merged.push(...items);
            }
            if (merged.length === 0) return;

            setServicesList((prev) => {
                const current = Array.isArray(prev) ? prev : [];
                const seen = new Set(
                    current.map((s) => String(s?.id || s?._id || `${s?.name || ""}|${s?.category || ""}`))
                );
                const additions = merged.filter((s) => {
                    const key = String(s?.id || s?._id || `${s?.name || ""}|${s?.category || ""}`);
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                return additions.length ? [...current, ...additions] : current;
            });
        });

        return () => {
            cancelled = true;
        };
    }, [catalogLoading, filteredCategories, servicesList]);

    // Auto-cleanup specializations if parent categories are deselected
    useEffect(() => {
        if (!catalogLoading && filteredCategories) {
            const validNames = new Set(filteredCategories.map(c => c.name));
            const activeSpec = formData.specializations;
            const validSpec = activeSpec.filter(s => validNames.has(s));
            if (activeSpec.length !== validSpec.length) {
                setFormData(prev => ({ ...prev, specializations: validSpec }));
            }
        }
    }, [filteredCategories, catalogLoading]);

    // Auto-cleanup services if subcategories are deselected
    useEffect(() => {
        if (!catalogLoading && serviceOptions) {
            const validNames = new Set(serviceOptions.map(s => s.name));
            const activeServ = formData.services;
            const validServ = activeServ.filter(s => validNames.has(s));
            if (activeServ.length !== validServ.length) {
                setFormData(prev => ({ ...prev, services: validServ }));
            }
        }
    }, [serviceOptions, catalogLoading]);

    // Refs for hidden inputs
    const profileInputRef = useRef(null);
    const aadharFrontRef = useRef(null);
    const aadharBackRef = useRef(null);
    const panCardRef = useRef(null);
    const certsInputRef = useRef(null);

    const handleFileChange = (field, file) => {
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, [field]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    // Camera capture state
    const [capturingField, setCapturingField] = useState(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const startCamera = async (field = "profilePhoto") => {
        // Check for Flutter Bridge First
        if (isFlutterWebView()) {
            const file = await openFlutterCamera();
            if (file) {
                const data = file.dataUrl;
                if (field === "certifications") {
                    setFormData(prev => ({
                        ...prev,
                        certifications: [...(Array.isArray(prev.certifications) ? prev.certifications : []), {
                            name: file.name,
                            type: file.type,
                            data
                        }]
                    }));
                } else {
                    setFormData(prev => ({ ...prev, [field]: data }));
                }
                return;
            }
            // If user cancelled bridge camera, don't fallback to web camera
            // return;
        }

        setCapturingField(field);
        setCameraError("");
        setIsVideoReady(false);
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error("Camera API not supported");
            }
            setIsCameraOpen(true);
            await new Promise((r) => requestAnimationFrame(r));
            const tryConstraints = async (c) => {
                try {
                    return await navigator.mediaDevices.getUserMedia(c);
                } catch {
                    return null;
                }
            };
            let stream =
                (await tryConstraints({ video: { facingMode: { ideal: "user" } }, audio: false })) ||
                (await tryConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false })) ||
                (await tryConstraints({ video: true, audio: false }));
            if (!stream) throw new Error("Unable to access camera");
            streamRef.current = stream;
            if (videoRef.current) {
                const v = videoRef.current;
                v.srcObject = stream;
                try { v.setAttribute("playsinline", "true"); } catch { }
                try { v.setAttribute("muted", "true"); } catch { }
                try { v.muted = true; } catch { }
                const waitForCanPlay = () => new Promise((resolve) => {
                    const done = () => {
                        setIsVideoReady(true);
                        resolve();
                    };
                    if (v.readyState >= 2 && v.videoWidth > 0) return done();
                    const onCanPlay = () => { v.removeEventListener("canplay", onCanPlay); done(); };
                    v.addEventListener("canplay", onCanPlay, { once: true });
                });
                const ensurePlay = async () => {
                    try { await v.play(); } catch { }
                    if (v.readyState >= 2 && v.videoWidth > 0) {
                        setIsVideoReady(true);
                        return;
                    }
                    await waitForCanPlay();
                };
                await ensurePlay();
                setTimeout(() => {
                    if (!isVideoReady && v.videoWidth > 0) setIsVideoReady(true);
                }, 1500);
            }
        } catch (e) {
            setCameraError(e?.message || "Camera access denied or not available");
        }
    };

    const stopCamera = () => {
        try {
            const s = streamRef.current;
            if (s) {
                s.getTracks().forEach(t => t.stop());
            }
            if (videoRef.current) {
                videoRef.current.srcObject = null;
                videoRef.current.onloadedmetadata = null;
            }
        } catch { }
        streamRef.current = null;
        setIsVideoReady(false);
        setIsCameraOpen(false);
        setCapturingField(null);
    };

    const capturePhoto = () => {
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas || !capturingField) return;
            const vw = video.videoWidth || 0;
            const vh = video.videoHeight || 0;
            if (!isVideoReady || vw === 0 || vh === 0) {
                setCameraError("Camera not ready. Please wait a moment and try again.");
                return;
            }
            canvas.width = vw;
            canvas.height = vh;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const data = canvas.toDataURL("image/png");
            if (capturingField === "certifications") {
                setFormData(prev => ({
                    ...prev,
                    certifications: [...(Array.isArray(prev.certifications) ? prev.certifications : []), {
                        name: `camera_cert_${Date.now()}.png`,
                        type: "image/png",
                        data
                    }]
                }));
            } else {
                setFormData(prev => ({ ...prev, [capturingField]: data }));
            }
            stopCamera();
        } catch {
            setCameraError("Failed to capture photo");
        }
    };

    const handleCertsChange = (files) => {
        if (!files || files.length === 0) return;
        const arr = Array.from(files);
        const readers = arr.map(
            (file) =>
                new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve({ name: file.name, type: file.type, data: reader.result });
                    reader.readAsDataURL(file);
                })
        );
        Promise.all(readers).then((items) => {
            setFormData((prev) => ({
                ...prev,
                certifications: [...(Array.isArray(prev.certifications) ? prev.certifications : []), ...items],
            }));
        });
    };

    useEffect(() => {
        setOtp("");
        setOtpSent(false);
        setOtpVerified(false);
        setOtpError("");
    }, [formData.phone]);

    const handleSendOtp = async () => {
        const phone = (formData.phone || "").trim();
        if (!/^\d{10}$/.test(phone)) {
            setOtpError("Enter a valid 10-digit mobile number");
            return;
        }
        setOtpLoading(true);
        setOtpError("");
        try {
            const res = await requestRegisterOtp(phone);
            setOtpDeliveryMode(res?.deliveryMode || "sms");
            setOtpSent(true);
        } catch (e) {
            setOtpError(e?.message || "Failed to send OTP");
        } finally {
            setOtpLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const phone = (formData.phone || "").trim();
        if (otp.length !== 6) {
            setOtpError("Enter a valid 6-digit OTP");
            return;
        }
        setOtpLoading(true);
        setOtpError("");
        try {
            await verifyRegisterOtp(phone, otp);
            setOtpVerified(true);
        } catch (e) {
            setOtpVerified(false);
            setOtpError(e?.message || "OTP verification failed");
        } finally {
            setOtpLoading(false);
        }
    };

    const nextStep = () => {
        setStepError("");
        setOtpError("");

        if (currentStep === 1) {
            if (!otpVerified) {
                setOtpError("Please verify your mobile number with OTP");
                return;
            }
            if (!formData.profilePhoto) {
                setStepError("Please capture your live profile photo");
                return;
            }
            if (!formData.name.trim()) {
                setStepError("Please enter your full name as per Aadhar");
                return;
            }
            if (!formData.gender) {
                setStepError("Please select your gender");
                return;
            }
            // Email validation: Allow common valid TLDs, reject .co
            const emailRegex = /^[^\s@]+@[^\s@]+\.(com|net|org|edu|gov|mil|in|uk|us|ca|au|de|jp|fr|it|ru|br|cn|nl|se|no|es|mx|za|nz|sg|hk|ae|sa|eg|pk|bd|my|th|vn|id|ph|kr|tw|tr|pl|ua|ro|cz|be|gr|pt|hu|at|ch|dk|fi|ie|il|ar|cl|co\.in|co\.uk|co\.za|ac\.in|edu\.in|gov\.in|org\.in|net\.in|info|biz|io|app|dev|tech|online|site|store|shop|xyz|pro|name|mobi|asia|tel|travel|jobs|cat|aero|coop|museum)$/i;
            const isTypo = /@(gnail\.com|gmil\.com|gmal\.com|gmail\.con)$/i.test(formData.email.trim());
            if (!formData.email.trim() || !emailRegex.test(formData.email) || isTypo) {
                setStepError("Please enter a valid email address (e.g., name@example.com or name@example.in)");
                return;
            }
            if (!formData.dob) {
                setStepError("Please enter your date of birth");
                return;
            }
            if (!formData.experience) {
                setStepError("Please select your professional experience");
                return;
            }
            if (!formData.city) {
                setStepError("Please select your base city");
                return;
            }
            if (formData.zones.length === 0 && !formData.customZone.trim()) {
                setStepError("Please select at least one hub zone");
                return;
            }
            if (!formData.addressLine1.trim() || !formData.area.trim()) {
                setStepError("Please complete your full address details");
                return;
            }
        }

        if (currentStep === 2) {
            if (!formData.aadharFront) {
                setStepError("Please upload Aadhar Card Front view");
                return;
            }
            if (!formData.aadharBack) {
                setStepError("Please upload Aadhar Card Back view");
                return;
            }
            if (!formData.panCard) {
                setStepError("Please upload your PAN Card");
                return;
            }
        }

        if (currentStep === 3) {
            if (formData.primaryCategory.length === 0) {
                setStepError("Please select at least one primary category");
                return;
            }
            if (formData.services.length === 0) {
                setStepError("Please select at least one service from catalog");
                return;
            }
        }

        if (currentStep === 4) {
            if (!formData.bankName.trim() || !formData.accountNumber.trim() || !formData.ifscCode.trim()) {
                setStepError("Please complete your bank account details");
                return;
            }
            // Standard IFSC validation: 4 letters, then 0, then 6 alphanumeric characters
            const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
            if (!ifscRegex.test(formData.ifscCode.toUpperCase())) {
                setStepError("Please enter a valid 11-digit IFSC code (e.g. SBIN0001234)");
                return;
            }
            // Account number validation: 9-18 digits, numbers only
            const accountNumberRegex = /^\d{9,18}$/;
            if (!accountNumberRegex.test(formData.accountNumber)) {
                setStepError("Account number must be 9-18 digits (numbers only)");
                return;
            }
            if (formData.ifscCode.length !== 11) {
                setStepError("IFSC code must be exactly 11 characters");
                return;
            }
            // UPI ID validation (optional field, but if provided must be valid)
            if (formData.upiId.trim()) {
                // Valid UPI format: username@provider (e.g., 9876543210@paytm, name@okaxis)
                const upiRegex = /^[a-zA-Z0-9._\-]+@[a-zA-Z0-9.\-]+$/;
                if (!upiRegex.test(formData.upiId)) {
                    setStepError("Please enter a valid UPI ID (e.g., 9876543210@paytm or username@upi)");
                    return;
                }
            }
        }

        if (currentStep === 5) {
            // Validate all agreements are accepted
            if (!formData.agreedCommission) {
                setStepError("Please accept the 85/15 Payout Commission Policy");
                return;
            }
            if (!formData.agreedGuidelines) {
                setStepError("Please agree to follow Safety & Hygiene Guidelines");
                return;
            }
            if (!formData.agreedBackgroundCheck) {
                setStepError("Please acknowledge the Background Check requirement");
                return;
            }
        }

        if (currentStep < 5) setCurrentStep(currentStep + 1);
        else handleSubmit();
    };

    const prevStep = () => {
        setStepError("");
        setOtpError("");
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const handleSubmit = async () => {
        if (!otpVerified) {
            setOtpError("Please verify your mobile number with OTP");
            return;
        }
        setIsLoading(true);
        try {
            const finalZones = [...formData.zones];
            if (formData.customZone.trim()) finalZones.push(formData.customZone.trim());
            await register({ ...formData, zones: finalZones });
            
            // Meta Pixel Tracking
            try {
                if (window.fbq) {
                    window.fbq('track', 'CompleteRegistration', {
                        content_name: 'Provider Registration',
                        status: 'Success'
                    });
                }
            } catch (err) {
                console.error("Meta Pixel Provider CompleteRegistration error:", err);
            }

            // Clear localStorage after successful registration
            localStorage.removeItem(STORAGE_KEY);
            
            setIsLoading(false);
            setIsSuccess(true);
        } catch (err) {
            // ✅ FIX: Handle session expiry. Redirect to Step 1 for re-verification.
            if (err.status === 403) {
                setStepError("Your verification session has expired. Please verify your phone number again on Step 1 (your other details are saved).");
                setCurrentStep(1);
                setOtpVerified(false);
            } else {
                setOtpError(err.message || "Registration failed");
            }
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <Check className="h-12 w-12 text-green-600 stroke-[3px]" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-2">Registration Submitted!</h1>
                <p className="text-gray-500 max-w-sm mb-8 font-medium">
                    Your profile is now under review. We typically approve profiles within <span className="text-gray-900 font-bold">24-48 hours</span>.
                </p>
                <div className="bg-gray-50 p-6 rounded-2xl w-full max-w-sm mb-8">
                    <div className="flex items-center gap-3 text-left">
                        <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                            <ShieldCheck className="text-purple-600 h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase text-gray-400">Application Status</p>
                            <p className="text-sm font-bold text-yellow-600">Pending Review</p>
                        </div>
                    </div>
                </div>
                <Button
                    className="bg-violet-600 hover:bg-violet-700 text-white font-black h-14 w-full max-w-sm rounded-2xl shadow-xl shadow-violet-200"
                    onClick={() => navigate("/provider/status")}
                >
                    Check Status
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* Header with Progress Bar */}
            <div className="sticky top-0 z-20 bg-white shadow-sm pb-1">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button onClick={prevStep} disabled={currentStep === 1} className="p-2 disabled:opacity-0 transition-opacity">
                        <ChevronLeft className="h-6 w-6 text-gray-600" />
                    </button>
                    <span className="font-black text-gray-900">Partner Registration</span>
                    <button onClick={() => navigate("/provider/login")} className="text-sm font-bold text-violet-400">Cancel</button>
                </div>
                <div className="max-w-4xl mx-auto px-4 pb-4">
                    <div className="flex justify-between items-center mb-2">
                        {steps.map((s, i) => (
                            <div key={i} className="flex flex-col items-center gap-1">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${currentStep > i + 1 ? "bg-green-500 text-white" :
                                    currentStep === i + 1 ? "bg-violet-600 text-white scale-110 shadow-md" :
                                        "bg-gray-100 text-gray-400"
                                    }`}>
                                    {currentStep > i + 1 ? <Check className="h-5 w-5" /> : <s.icon className="h-4 w-4" />}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-tighter ${currentStep === i + 1 ? "text-violet-600" : "text-gray-400"
                                    }`}>{s.title}</span>
                            </div>
                        ))}
                    </div>
                    <Progress value={(currentStep / 5) * 100} className="h-1 bg-gray-100 [&>div]:bg-violet-600" />
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 mt-8">
                <Card className="border-none shadow-xl rounded-[24px] bg-white pt-2">
                    <CardContent className="p-6 sm:p-10">
                        {/* Step 1: Personal Information */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-black text-gray-900">Personal Information</h2>
                                    <p className="text-gray-500 text-sm font-medium">Help clients know you better.</p>
                                </div>

                                {/* 1. Profile Photo - Live Camera */}
                                <div className="flex flex-col items-center py-4">
                                        <div className="w-32 h-32 rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-violet-600">
                                            {formData.profilePhoto ? (
                                                <div 
                                                    className="relative w-full h-full group/photo cursor-pointer"
                                                    onClick={() => startCamera("profilePhoto")}
                                                >
                                                    <img src={formData.profilePhoto} className="w-full h-full object-cover" alt="Profile" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                        <div 
                                                            className="p-2 bg-white rounded-full text-violet-600 hover:scale-110 transition-transform shadow-lg"
                                                            title="Retake Photo"
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </div>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFormData(prev => ({ ...prev, profilePhoto: null }));
                                                            }}
                                                            className="p-2 bg-white rounded-full text-red-600 hover:scale-110 transition-transform shadow-lg"
                                                            title="Delete Photo"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div 
                                                    className="w-full h-full flex flex-col items-center justify-center cursor-pointer group-active:scale-95 transition-transform"
                                                    onClick={() => startCamera("profilePhoto")}
                                                >
                                                    <Camera className="h-10 w-10 text-gray-300 group-hover:text-violet-600 transition-colors" />
                                                    <span className="text-[10px] font-black uppercase text-gray-400 mt-1">Live Photo</span>
                                                </div>
                                            )}
                                        </div>
                                    <p className="text-[10px] font-bold text-gray-400 mt-4 uppercase tracking-widest leading-none">Live Camera Only</p>

                                </div>

                                {/* 2. Full Name */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-gray-400">Full Name</Label>
                                    <Input
                                        placeholder="Enter as per Aadhar"
                                        className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600"
                                        value={formData.name}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (/^[a-zA-Z\s]*$/.test(val)) {
                                                setFormData({ ...formData, name: val });
                                            }
                                        }}
                                    />
                                </div>

                                {/* 3. Gender Selection */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-gray-400">Gender</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['Male', 'Female', 'Other'].map((g) => (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, gender: g })}
                                                className={`h-12 rounded-xl font-bold border-2 transition-all ${
                                                    formData.gender === g 
                                                        ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-100' 
                                                        : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-violet-200'
                                                }`}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 4. Email */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-gray-400">Email Address</Label>
                                    <Input
                                        type="email"
                                        placeholder="name@example.com"
                                        className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold"
                                        title="Please enter a valid email address (e.g., name@example.com or name@example.in)"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>

                                {/* 4. Phone Number with OTP */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-black uppercase text-gray-400">Mobile Number</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="tel"
                                            placeholder="10-digit mobile number"
                                            className="h-12 flex-1 rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                            disabled={otpVerified}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-12 px-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest shrink-0 w-[90px] sm:w-[120px]"
                                            onClick={handleSendOtp}
                                            disabled={otpLoading || !/^\d{10}$/.test(formData.phone) || otpVerified}
                                        >
                                            {otpSent ? "Resend" : "Send OTP"}
                                        </Button>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            placeholder="Enter 6-digit OTP"
                                            className="h-12 flex-1 rounded-xl bg-gray-50 border-gray-100 font-bold text-center tracking-widest"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                            disabled={!otpSent || otpVerified}
                                        />
                                        <Button
                                            type="button"
                                            className="h-12 px-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest bg-violet-600 hover:bg-violet-700 shrink-0 w-[90px] sm:w-[120px]"
                                            onClick={handleVerifyOtp}
                                            disabled={otpLoading || otp.length !== 6 || otpVerified}
                                        >
                                            {otpVerified ? "Verified" : "Verify"}
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        {otpVerified && (
                                            <p className="text-xs font-bold text-green-600">Mobile number verified</p>
                                        )}
                                        {otpSent && !otpVerified && !otpError && (
                                            <p className="text-xs font-medium text-gray-500">
                                                {otpDeliveryMode === "allowlist"
                                                    ? `Enter the 6-digit OTP for +91 ${formData.phone}`
                                                    : `Enter the 6-digit code sent to +91 ${formData.phone}`}
                                            </p>
                                        )}
                                        {otpError && (
                                            <p className="text-xs font-bold text-red-600">{otpError}</p>
                                        )}
                                    </div>
                                </div>

                                {/* 5. Date of Birth */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-gray-400">Date of Birth</Label>
                                    <Input
                                        type="date"
                                        className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold"
                                        value={formData.dob}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={(e) => {
                                            const selectedDate = new Date(e.target.value);
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            
                                            if (selectedDate > today) {
                                                setStepError("Date of birth cannot be in the future");
                                                return;
                                            }
                                            
                                            setStepError("");
                                            setFormData({ ...formData, dob: e.target.value });
                                        }}
                                    />
                                </div>

                                {/* 6. Address Section */}
                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase text-gray-400">Address & Hub Location</Label>

                                    {/* Use Current Location Button moved here */}
                                    <Button
                                        type="button"
                                        variant={formData.lat ? "default" : "outline"}
                                        className={`w-full h-12 transition-all ${formData.lat ? "bg-green-600 hover:bg-green-700 text-white border-green-600 shadow-lg shadow-green-100" : ""}`}
                                        disabled={isLoading}
                                        onClick={async () => {
                                            if (!navigator.geolocation) {
                                                alert("Geolocation is not supported by your browser");
                                                return;
                                            }

                                            setIsLoading(true);
                                            navigator.geolocation.getCurrentPosition(
                                                async (position) => {
                                                    const latitude = position.coords.latitude;
                                                    const longitude = position.coords.longitude;

                                                    // Helper function to resolve location and set form fields
                                                    const resolveLocationAndSetFields = async (googleCity, addressLine1, areaText) => {
                                                        try {
                                                            const res = await api.content.resolveLocation({
                                                                lat: String(latitude),
                                                                lng: String(longitude),
                                                                cityName: googleCity || ""
                                                            });

                                                            const location = res?.location || {};

                                                            if (location.insideServiceArea && location.zoneName) {
                                                                // CASE 1: Zone found - populate dropdowns
                                                                const matchedCity = cities.find(
                                                                    c => c._id === location.cityId || c.name === location.cityName
                                                                );
                                                                const nextCity = matchedCity?.name || location.cityName;
                                                                const nextCityId = matchedCity?._id || location.cityId || "";

                                                                // Load zones for this city
                                                                let nextZones = [];
                                                                try {
                                                                    const zonesRes = await api.content.zones({ cityName: nextCity });
                                                                    nextZones = zonesRes?.zones || [];
                                                                    setZones(nextZones);
                                                                } catch {
                                                                    nextZones = [];
                                                                    setZones([]);
                                                                }

                                                                // Find matching zone
                                                                const resolvedZone = nextZones.find(
                                                                    z => z._id === location.zoneId || z.name === location.zoneName
                                                                );

                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    lat: latitude,
                                                                    lng: longitude,
                                                                    addressLine1: addressLine1 || prev.addressLine1,
                                                                    area: areaText || prev.area,
                                                                    city: nextCity,
                                                                    cityId: nextCityId,
                                                                    zones: resolvedZone ? [resolvedZone.name] : (location.zoneName ? [location.zoneName] : []),
                                                                    zoneIds: resolvedZone ? [resolvedZone._id] : (location.zoneId ? [location.zoneId] : []),
                                                                    customZone: "" // Clear custom zone when zone is found
                                                                }));

                                                                alert(`Location captured!\nDetected zone: ${location.zoneName}`);
                                                            } else {
                                                                // CASE 2: Out of zone - fill custom zone
                                                                const customZoneText = [areaText, googleCity || location.cityName]
                                                                    .filter(Boolean)
                                                                    .join(", ");

                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    lat: latitude,
                                                                    lng: longitude,
                                                                    addressLine1: addressLine1 || prev.addressLine1,
                                                                    area: areaText || prev.area,
                                                                    customZone: customZoneText || "Current Location",
                                                                    zones: [],
                                                                    zoneIds: []
                                                                }));

                                                                alert("Your location is out of service area.\nCustom zone has been filled with your address.");
                                                            }
                                                        } catch (error) {
                                                            console.error("Location resolution error:", error);

                                                            // Fallback: Just set address fields and custom zone
                                                            const fallbackCustomZone = [areaText, googleCity]
                                                                .filter(Boolean)
                                                                .join(", ") || "Current Location";

                                                            setFormData(prev => ({
                                                                ...prev,
                                                                lat: latitude,
                                                                lng: longitude,
                                                                addressLine1: addressLine1 || prev.addressLine1,
                                                                area: areaText || prev.area,
                                                                customZone: fallbackCustomZone
                                                            }));

                                                            alert("Location captured! Please verify the details.");
                                                        } finally {
                                                            setIsLoading(false);
                                                        }
                                                    };

                                                    // Ensure Google Maps is loaded
                                                    const loadGoogleMaps = () => {
                                                        if (window.google?.maps) return Promise.resolve();
                                                        const existing = document.getElementById("google-maps-sdk");
                                                        if (existing) return Promise.resolve();
                                                        
                                                        return new Promise((resolve, reject) => {
                                                            const script = document.createElement("script");
                                                            script.id = "google-maps-sdk";
                                                            script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}&libraries=places`;
                                                            script.onload = resolve;
                                                            script.onerror = reject;
                                                            document.head.appendChild(script);
                                                        });
                                                    };

                                                    try {
                                                        await loadGoogleMaps();
                                                    } catch (e) {
                                                        console.warn("Google Maps script failed to load:", e);
                                                    }

                                                    // Try Google Maps Geocoding
                                                    if (window.google?.maps) {
                                                        try {
                                                            const geocoder = new window.google.maps.Geocoder();
                                                            geocoder.geocode(
                                                                { location: { lat: latitude, lng: longitude } },
                                                                (results, status) => {
                                                                    if (status === "OK" && results && results[0]) {
                                                                        const res = results[0];
                                                                        const comp = res.address_components || [];

                                                                        // Helper to get component by type
                                                                        const getComp = (types) =>
                                                                            comp.find(c => types.some(t => c.types.includes(t)))?.long_name || "";

                                                                        // Extract address components
                                                                        const houseNo = getComp(["street_number", "premise", "subpremise"]);
                                                                        const street = getComp(["route", "street_address"]);
                                                                        const landmark = getComp(["neighborhood", "sublocality_level_2", "sublocality_level_3"]);
                                                                        const area = getComp(["sublocality_level_1", "sublocality"]);
                                                                        const city = getComp(["locality", "administrative_area_level_2"]);

                                                                        // Format address line 1 - use formatted address as fallback if specific components missing
                                                                        const addressLine1 = [houseNo, street, landmark]
                                                                            .filter(Boolean)
                                                                            .join(", ") || res.formatted_address.split(",")[0];

                                                                        // Use area or formatted_address
                                                                        const areaText = area || res.formatted_address;

                                                                        // Now resolve with backend API
                                                                        resolveLocationAndSetFields(city, addressLine1, areaText);
                                                                    } else {
                                                                        // Fallback to backend only
                                                                        resolveLocationAndSetFields("", "Current Location", "Current Location");
                                                                    }
                                                                }
                                                            );
                                                        } catch (error) {
                                                            console.error("Google Maps Geocoding error:", error);
                                                            resolveLocationAndSetFields("", "Current Location", "Current Location");
                                                        }
                                                    } else {
                                                        // Google Maps not available, use backend only with dummy address to pass validation
                                                        resolveLocationAndSetFields("", "Current Location", "Current Location");
                                                    }
                                                },
                                                (error) => {
                                                    setIsLoading(false);
                                                    console.error("Geolocation error:", error);
                                                    alert("Permission denied or location unavailable. Please ensure GPS is enabled.");
                                                },
                                                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                                            );
                                        }}
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="font-black uppercase text-[10px] tracking-widest">Getting Location...</span>
                                            </div>
                                        ) : formData.lat ? (
                                            <div className="flex items-center gap-2">
                                                <Check className="h-4 w-4 stroke-[3px]" />
                                                <span className="font-black uppercase text-[10px] tracking-widest">Location Captured</span>
                                            </div>
                                        ) : (
                                            "📍 Use Current Location"
                                        )}
                                    </Button>
                                    <p className="text-[10px] text-amber-700 font-medium">
                                        💡 Tip: Click "Use Current Location" to auto-detect your zone and fill address details
                                    </p>


                                    {/* 6.1 Flat/Building/Landmark */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-gray-500 uppercase">Flat/Building/Landmark</Label>
                                        <Input
                                            placeholder="Enter flat, building or landmark"
                                            className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600"
                                            value={formData.addressLine1}
                                            onChange={(e) => setFormData(prev => ({ ...prev, addressLine1: e.target.value }))}
                                        />
                                    </div>

                                    {/* 6.2 Area/Locality */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-gray-500 uppercase">Area/Locality</Label>
                                        <Input
                                            placeholder="Enter area or locality name"
                                            className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600"
                                            value={formData.area}
                                            onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
                                        />
                                    </div>

                                    {/* 6.3 City Selection */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-gray-500 uppercase">City</Label>
                                        <Select value={formData.city} onValueChange={v => {
                                            const selectedCity = cities.find((city) => city.name === v);
                                            setFormData(prev => ({
                                                ...prev,
                                                city: v,
                                                cityId: selectedCity?._id || "",
                                                zones: [],
                                                zoneIds: [],
                                            }));
                                        }}>
                                            <SelectTrigger className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600">
                                                <SelectValue placeholder="Select City" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {cities.map(c => <SelectItem key={c._id} value={c.name}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* 6.4 Hub Zones Selection */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Hub Zones (Multiple)</Label>
                                        <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            {zonesLoading ? (
                                                <div className="flex items-center gap-2 py-2">
                                                    <Loader2 className="h-4 w-4 text-violet-600 animate-spin" />
                                                    <span className="text-xs font-bold text-gray-400">Fetching zones...</span>
                                                </div>
                                            ) : zones.length > 0 ? (
                                                <>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase">Available Hubs</span>
                                                        <Button type="button" variant="ghost" size="sm" onClick={() => {
                                                            if (formData.zones.length === zones.length) {
                                                                setFormData(prev => ({ ...prev, zones: [], zoneIds: [] }));
                                                            } else {
                                                                syncSelectedZoneIds(zones.map(z => z.name));
                                                            }
                                                        }} className="h-6 text-[9px] font-black text-violet-600 hover:bg-violet-50">
                                                            {formData.zones.length === zones.length ? "Deselect All" : "Select All"}
                                                        </Button>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                                                        {zones.map(z => (
                                                            <div key={z._id} onClick={() => {
                                                                const current = [...formData.zones];
                                                                const idx = current.indexOf(z.name);
                                                                if (idx > -1) current.splice(idx, 1);
                                                                else current.push(z.name);
                                                                syncSelectedZoneIds(current);
                                                            }} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.zones.includes(z.name) ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-100' : 'bg-white border-gray-100 text-gray-600 hover:border-violet-200'}`}>
                                                                <div className={`h-5 w-5 rounded flex items-center justify-center ${formData.zones.includes(z.name) ? 'bg-white text-violet-600' : 'bg-gray-100'}`}>
                                                                    {formData.zones.includes(z.name) && <Check className="h-3 w-3" />}
                                                                </div>
                                                                <span className="text-xs font-black truncate">{z.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : formData.city ? (
                                                <p className="text-xs font-semibold text-gray-400 py-2">No zones available for selected city</p>
                                            ) : (
                                                <p className="text-xs font-semibold text-gray-400 py-2">Please select a city first</p>
                                            )}
                                        </div>
                                    </div>
                                </div>



                                {/* 8. Professional Experience */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-gray-400">Professional Experience</Label>
                                    <Select
                                        value={formData.experience}
                                        onValueChange={(v) => setFormData({ ...formData, experience: v })}
                                    >
                                        <SelectTrigger className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold">
                                            <SelectValue placeholder="Select experience" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0-1">0-1 Years</SelectItem>
                                            <SelectItem value="1-3">1-3 Years</SelectItem>
                                            <SelectItem value="3-5">3-5 Years</SelectItem>
                                            <SelectItem value="5+">5+ Years</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {/* Step 2: KYC Verification */}
                        {currentStep === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-black text-gray-900">Identity Verification</h2>
                                    <p className="text-gray-500 text-sm font-medium">Verify your identity to build trust.</p>
                                </div>

                                <div className="grid gap-6">
                                    <input type="file" ref={aadharFrontRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange("aadharFront", e.target.files[0])} />
                                    <input type="file" ref={aadharBackRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange("aadharBack", e.target.files[0])} />
                                    <input type="file" ref={panCardRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileChange("panCard", e.target.files[0])} />

                                    <div className="space-y-3">
                                        <Label className="text-xs font-black uppercase text-gray-400">Aadhar Card Upload</Label>
                                        <div className="grid gap-4">
                                            {/* Front Side */}
                                            <div className="space-y-2">
                                                <span className="text-[10px] font-black uppercase text-gray-400 ml-1">Front Side</span>
                                                <div className={formData.aadharFront ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}>
                                                    {formData.aadharFront ? (
                                                        <div className="border-2 border-violet-100 rounded-2xl p-2 bg-violet-50/30 overflow-hidden relative group">
                                                            <div className="absolute top-3 right-3 z-20 flex gap-2">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => startCamera("aadharFront")}
                                                                    className="p-2 bg-white/90 backdrop-blur-sm shadow-lg rounded-xl text-violet-600 hover:bg-white hover:scale-110 transition-all border border-violet-100"
                                                                    title="Retake Photo"
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
                                                                </button>
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => setFormData(prev => ({ ...prev, aadharFront: null }))}
                                                                    className="p-2 bg-white/90 backdrop-blur-sm shadow-lg rounded-xl text-red-600 hover:bg-white hover:scale-110 transition-all border border-red-100"
                                                                    title="Delete Photo"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                            {formData.aadharFront.startsWith('data:image') || formData.aadharFront.startsWith('http') ? (
                                                                <div className="relative h-40 w-full rounded-xl overflow-hidden">
                                                                    <img src={formData.aadharFront} className="w-full h-full object-contain bg-gray-900/5" alt="Aadhar Front" />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                                                                </div>
                                                            ) : (
                                                                <div className="h-32 flex flex-col items-center justify-center gap-2 text-violet-600">
                                                                    <CheckCircle2 className="h-8 w-8" />
                                                                    <span className="text-xs font-black uppercase tracking-widest">Document Uploaded</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div
                                                                onClick={() => aadharFrontRef.current.click()}
                                                                className="border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center bg-gray-50 text-gray-400 hover:border-violet-600 hover:bg-white transition-all cursor-pointer min-h-[100px] group"
                                                            >
                                                                <Upload className="h-6 w-6 mb-1.5 group-hover:scale-110 transition-transform" />
                                                                <span className="text-[10px] font-black uppercase text-center tracking-widest">Upload</span>
                                                            </div>
                                                            <div
                                                                onClick={() => startCamera("aadharFront")}
                                                                className="border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center bg-gray-50 text-gray-400 hover:border-violet-600 hover:bg-white transition-all cursor-pointer min-h-[100px] group"
                                                            >
                                                                <Camera className="h-6 w-6 mb-1.5 group-hover:scale-110 transition-transform" />
                                                                <span className="text-[10px] font-black uppercase text-center tracking-widest">Camera</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Back Side */}
                                            <div className="space-y-2">
                                                <span className="text-[10px] font-black uppercase text-gray-400 ml-1">Back Side</span>
                                                <div className={formData.aadharBack ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}>
                                                    {formData.aadharBack ? (
                                                        <div className="border-2 border-violet-100 rounded-2xl p-2 bg-violet-50/30 overflow-hidden relative group">
                                                            <div className="absolute top-3 right-3 z-20 flex gap-2">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => startCamera("aadharBack")}
                                                                    className="p-2 bg-white/90 backdrop-blur-sm shadow-lg rounded-xl text-violet-600 hover:bg-white hover:scale-110 transition-all border border-violet-100"
                                                                    title="Retake Photo"
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
                                                                </button>
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => setFormData(prev => ({ ...prev, aadharBack: null }))}
                                                                    className="p-2 bg-white/90 backdrop-blur-sm shadow-lg rounded-xl text-red-600 hover:bg-white hover:scale-110 transition-all border border-red-100"
                                                                    title="Delete Photo"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                            {formData.aadharBack.startsWith('data:image') || formData.aadharBack.startsWith('http') ? (
                                                                <div className="relative h-40 w-full rounded-xl overflow-hidden">
                                                                    <img src={formData.aadharBack} className="w-full h-full object-contain bg-gray-900/5" alt="Aadhar Back" />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                                                                </div>
                                                            ) : (
                                                                <div className="h-32 flex flex-col items-center justify-center gap-2 text-violet-600">
                                                                    <CheckCircle2 className="h-8 w-8" />
                                                                    <span className="text-xs font-black uppercase tracking-widest">Document Uploaded</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div
                                                                onClick={() => aadharBackRef.current.click()}
                                                                className="border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center bg-gray-50 text-gray-400 hover:border-violet-600 hover:bg-white transition-all cursor-pointer min-h-[100px] group"
                                                            >
                                                                <Upload className="h-6 w-6 mb-1.5 group-hover:scale-110 transition-transform" />
                                                                <span className="text-[10px] font-black uppercase text-center tracking-widest">Upload</span>
                                                            </div>
                                                            <div
                                                                onClick={() => startCamera("aadharBack")}
                                                                className="border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center bg-gray-50 text-gray-400 hover:border-violet-600 hover:bg-white transition-all cursor-pointer min-h-[100px] group"
                                                            >
                                                                <Camera className="h-6 w-6 mb-1.5 group-hover:scale-110 transition-transform" />
                                                                <span className="text-[10px] font-black uppercase text-center tracking-widest">Camera</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-black uppercase text-gray-400">PAN Card</Label>
                                        <div className={formData.panCard ? "grid grid-cols-1" : "grid grid-cols-2 gap-4"}>
                                            {formData.panCard ? (
                                                <div className="border-2 border-violet-100 rounded-2xl p-2 bg-violet-50/30 overflow-hidden relative group">
                                                    <div className="absolute top-3 right-3 z-20 flex gap-2">
                                                        <button 
                                                            type="button"
                                                            onClick={() => startCamera("panCard")}
                                                            className="p-2 bg-white/90 backdrop-blur-sm shadow-lg rounded-xl text-violet-600 hover:bg-white hover:scale-110 transition-all border border-violet-100"
                                                            title="Retake Photo"
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, panCard: null }))}
                                                            className="p-2 bg-white/90 backdrop-blur-sm shadow-lg rounded-xl text-red-600 hover:bg-white hover:scale-110 transition-all border border-red-100"
                                                            title="Delete Photo"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    {formData.panCard.startsWith('data:image') || formData.panCard.startsWith('http') ? (
                                                        <div className="relative h-40 w-full rounded-xl overflow-hidden">
                                                            <img src={formData.panCard} className="w-full h-full object-contain bg-gray-900/5" alt="PAN Card" />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                                                        </div>
                                                    ) : (
                                                        <div className="h-32 flex flex-col items-center justify-center gap-2 text-violet-600">
                                                            <CheckCircle2 className="h-8 w-8" />
                                                            <span className="text-xs font-black uppercase tracking-widest">Document Uploaded</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <div
                                                        onClick={() => panCardRef.current.click()}
                                                        className="border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center bg-gray-50 text-gray-400 hover:border-violet-600 hover:bg-white transition-all cursor-pointer min-h-[100px] group"
                                                    >
                                                        <Upload className="h-6 w-6 mb-1.5 group-hover:scale-110 transition-transform" />
                                                        <span className="text-[10px] font-black uppercase text-center tracking-widest leading-tight">Upload PDF/Image</span>
                                                    </div>
                                                    <div
                                                        onClick={() => startCamera("panCard")}
                                                        className="border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center bg-gray-50 text-gray-400 hover:border-violet-600 hover:bg-white transition-all cursor-pointer min-h-[100px] group"
                                                    >
                                                        <Camera className="h-6 w-6 mb-1.5 group-hover:scale-110 transition-transform" />
                                                        <span className="text-[10px] font-black uppercase text-center tracking-widest leading-tight">Take Photo</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-purple-50 p-4 rounded-2xl flex items-start gap-4">
                                    <ShieldCheck className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                                    <p className="text-xs font-semibold text-purple-900 leading-relaxed">
                                        Your data is encrypted and secure. We use these details strictly for platform verification and legal compliance.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Professional Details */}
                        {currentStep === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-black text-gray-900">Professional Details</h2>
                                    <p className="text-gray-500 text-sm font-medium">Select what you're best at.</p>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase text-gray-400">Primary Categories</Label>
                                    <details className="group relative">
                                        <summary className="h-12 w-full border border-gray-100 bg-gray-50 rounded-xl flex items-center justify-between px-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                            <span className="font-bold text-sm text-gray-700">
                                                {formData.primaryCategory.length > 0 
                                                    ? `${formData.primaryCategory.length} Categories Selected` 
                                                    : "Select Primary Categories"}
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform" />
                                        </summary>
                                        <div className="absolute z-10 top-14 left-0 w-full bg-white border border-gray-100 shadow-2xl rounded-xl p-2 max-h-60 overflow-y-auto">
                                            {serviceTypeOptions.length > 0 ? serviceTypeOptions.map(cat => (
                                                <div
                                                    key={cat.id || cat.label}
                                                    onClick={() => {
                                                        const updated = formData.primaryCategory.includes(cat.label)
                                                            ? formData.primaryCategory.filter(c => c !== cat.label)
                                                            : [...formData.primaryCategory, cat.label];
                                                        setFormData({ ...formData, primaryCategory: updated });
                                                    }}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all mb-2 last:mb-0 ${formData.primaryCategory.includes(cat.label) ? 'bg-purple-50 border-purple-600 text-purple-900 shadow-sm' : 'bg-white border-gray-100 text-gray-600 hover:border-purple-200'}`}
                                                >
                                                    <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${formData.primaryCategory.includes(cat.label) ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}>
                                                        {formData.primaryCategory.includes(cat.label) && <Check className="h-3 w-3" />}
                                                    </div>
                                                    <span className="text-xs font-black truncate uppercase">{cat.label}</span>
                                                </div>
                                            )) : (
                                                <p className="text-xs font-semibold text-gray-400 p-2 text-center">
                                                    {catalogLoading ? "Loading categories..." : "No categories available"}
                                                </p>
                                            )}
                                        </div>
                                    </details>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase text-gray-400">Sub Categories (Specializations)</Label>
                                    <details className="group relative">
                                        <summary className="h-12 w-full border border-gray-100 bg-gray-50 rounded-xl flex items-center justify-between px-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                            <span className="font-bold text-sm text-gray-700">
                                                {formData.specializations.length > 0 
                                                    ? `${formData.specializations.length} Sub Categories Selected` 
                                                    : "Select Sub Categories"}
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform" />
                                        </summary>
                                        <div className="absolute z-10 top-14 left-0 w-full bg-white border border-gray-100 shadow-2xl rounded-xl p-2 max-h-60 overflow-y-auto">
                                            {filteredCategories.length > 0 ? filteredCategories.map(spec => (
                                                <div
                                                    key={spec.id || spec.name}
                                                    onClick={() => {
                                                        const updated = formData.specializations.includes(spec.name)
                                                            ? formData.specializations.filter(s => s !== spec.name)
                                                            : [...formData.specializations, spec.name];
                                                        setFormData({ ...formData, specializations: updated });
                                                    }}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all mb-2 last:mb-0 ${formData.specializations.includes(spec.name) ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm' : 'bg-white border-gray-100 text-gray-600 hover:border-blue-200'}`}
                                                >
                                                    <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${formData.specializations.includes(spec.name) ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                                                        {formData.specializations.includes(spec.name) && <Check className="h-3 w-3" />}
                                                    </div>
                                                    <span className="text-[10px] font-black truncate uppercase">{spec.name}</span>
                                                </div>
                                            )) : (
                                                <p className="text-xs font-semibold text-gray-400 p-2 text-center">
                                                    {catalogLoading 
                                                        ? "Loading sub categories..." 
                                                        : formData.primaryCategory.length > 0 
                                                            ? "No sub categories available for selected primary categories"
                                                            : "Please select primary categories first to see sub categories"}
                                                </p>
                                            )}
                                        </div>
                                    </details>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase text-gray-400">Services</Label>
                                    <details className="group relative">
                                        <summary className="h-12 w-full border border-gray-100 bg-gray-50 rounded-xl flex items-center justify-between px-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                            <span className="font-bold text-sm text-gray-700">
                                                {formData.services.length > 0 
                                                    ? `${formData.services.length} Services Selected` 
                                                    : "Select Services"}
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform" />
                                        </summary>
                                        <div className="absolute z-10 top-14 left-0 w-full bg-white border border-gray-100 shadow-2xl rounded-xl p-2 max-h-60 overflow-y-auto">
                                            {serviceOptions.length > 0 ? serviceOptions.map(svc => (
                                                <div
                                                    key={svc.id || svc.name}
                                                    onClick={() => {
                                                        const updated = formData.services.includes(svc.name)
                                                            ? formData.services.filter(s => s !== svc.name)
                                                            : [...formData.services, svc.name];
                                                        setFormData({ ...formData, services: updated });
                                                    }}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all mb-2 last:mb-0 ${formData.services.includes(svc.name) ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-sm' : 'bg-white border-gray-100 text-gray-600 hover:border-emerald-200'}`}
                                                >
                                                    <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${formData.services.includes(svc.name) ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>
                                                        {formData.services.includes(svc.name) && <Check className="h-3 w-3" />}
                                                    </div>
                                                    <span className="text-[10px] font-black truncate uppercase">{svc.name}</span>
                                                </div>
                                            )) : (
                                                <p className="text-xs font-semibold text-gray-400 p-2 text-center">
                                                    {catalogLoading 
                                                        ? "Loading services..." 
                                                        : formData.primaryCategory.length > 0 || formData.specializations.length > 0
                                                            ? "No services available for selected categories"
                                                            : "Please select categories first to see services"}
                                                </p>
                                            )}
                                        </div>
                                    </details>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase text-gray-400">Upload Certifications</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {formData.certifications.map((c, idx) => (
                                            <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border bg-white group/cert">
                                                {c.type?.includes("image") ? (
                                                    <img src={c.data} alt={c.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-xs">
                                                        <FileText className="h-8 w-8 mb-1" />
                                                        <span className="px-2 truncate">{c.name}</span>
                                                    </div>
                                                )}
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            certifications: prev.certifications.filter((_, i) => i !== idx)
                                                        }));
                                                    }}
                                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover/cert:opacity-100 transition-opacity"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                        <input
                                            type="file"
                                            ref={certsInputRef}
                                            className="hidden"
                                            accept="image/*,.pdf"
                                            multiple
                                            onChange={(e) => handleCertsChange(e.target.files)}
                                        />
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => certsInputRef.current?.click()}
                                                className="h-12 w-12 rounded-2xl bg-gray-50 border-2 border-dashed flex items-center justify-center text-gray-300 hover:border-purple-600 transition-colors"
                                            >
                                                <Plus className="h-6 w-6" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => startCamera("certifications")}
                                                className="h-12 w-12 rounded-2xl bg-gray-50 border-2 border-dashed flex items-center justify-center text-gray-300 hover:border-violet-600 transition-colors"
                                            >
                                                <Camera className="h-6 w-6" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Bank Details */}
                        {currentStep === 4 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-1 text-center">
                                    <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Banknote className="h-8 w-8" />
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-900">Payout Details</h2>
                                    <p className="text-gray-500 text-sm font-medium">Where should we send your earnings?</p>
                                </div>

                                <div className="grid gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-gray-400">Bank Name</Label>
                                        <Input
                                            placeholder="e.g. HDFC Bank"
                                            className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold"
                                            value={formData.bankName}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (/^[a-zA-Z\s]*$/.test(val)) {
                                                    setFormData({ ...formData, bankName: val });
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-gray-400">Account Number</Label>
                                        <Input
                                            type="password"
                                            placeholder="•••• •••• •••• 1234"
                                            className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold"
                                            pattern="\d{9,18}"
                                            title="Account number must be 9-18 digits"
                                            maxLength={18}
                                            value={formData.accountNumber}
                                            onChange={(e) => {
                                                // Only allow numbers and limit to 18 digits
                                                const value = e.target.value.replace(/\D/g, '').slice(0, 18);
                                                setFormData({ ...formData, accountNumber: value });
                                            }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-gray-400">IFSC Code</Label>
                                            <Input
                                                placeholder="HDFC0001234"
                                                className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold uppercase"
                                                value={formData.ifscCode}
                                                maxLength={11}
                                                onChange={(e) => {
                                                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
                                                    setFormData({ ...formData, ifscCode: val });
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-gray-400">UPI ID (Optional)</Label>
                                            <Input
                                                placeholder="e.g., 9876543210@paytm, username@ybl"
                                                className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold"
                                                pattern="[a-zA-Z0-9._\-]+@[a-zA-Z0-9.\-]+"
                                                title="Enter valid UPI ID (Google Pay, PhonePe, Paytm, BHIM supported)"
                                                value={formData.upiId}
                                                onChange={(e) => setFormData({ ...formData, upiId: e.target.value.toLowerCase().trim() })}
                                            />
                                            <p className="text-[10px] text-gray-500 font-medium">
                                                Supported: Google Pay (@okaxis, @oksbi, @okicici), PhonePe (@ybl, @axl), Paytm (@paytm), BHIM (@upi, @bhim)
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center gap-3">
                                    <AlertCircle className="h-5 w-5 text-gray-400" />
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        Used for weekly payouts only. We do not store PINs or passwords.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step 5: Review & Agreements */}
                        {currentStep === 5 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-black text-gray-900">Final Review</h2>
                                    <p className="text-gray-500 text-sm font-medium">Accept policies and submit for approval.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="border border-gray-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                                        <div className="bg-slate-50 p-4 px-6 flex justify-between items-center border-b border-gray-100">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-violet-600" />
                                                <span className="text-xs font-black uppercase text-gray-400 tracking-[0.1em]">Profile Review</span>
                                            </div>
                                            <button
                                                onClick={() => setCurrentStep(1)}
                                                className="text-[10px] font-black uppercase text-violet-600 hover:bg-violet-50 px-3 py-1 rounded-full transition-colors"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        <div className="p-6">
                                            <div className="flex flex-col sm:flex-row gap-6">
                                                {formData.profilePhoto && (
                                                    <div className="shrink-0 flex justify-center sm:block">
                                                        <img src={formData.profilePhoto} className="h-32 w-28 rounded-2xl object-cover border-4 border-white shadow-md ring-1 ring-slate-100" alt="Preview" />
                                                    </div>
                                                )}
                                                <div className="flex-1 space-y-3">
                                                    {[
                                                        { label: "Name", value: formData.name, bold: true },
                                                        { label: "City", value: formData.city, bold: true },
                                                        {
                                                            label: "KYC Status",
                                                            value: (formData.aadharFront && formData.panCard) ? "Verified" : "Pending Documents",
                                                            color: (formData.aadharFront && formData.panCard) ? "text-green-600" : "text-amber-600"
                                                        },
                                                        { label: "Categories", value: formData.primaryCategory.join(", ") },
                                                        { label: "Services", value: formData.services.join(", ") },
                                                        { label: "Hubs", value: [formData.zones, formData.customZone].flat().filter(Boolean).join(", ") },
                                                    ].filter(i => i.value).map((item, idx) => (
                                                        <div key={idx} className="flex flex-col gap-0.5 border-b border-slate-50 pb-2 last:border-0">
                                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-sans">{item.label}</span>
                                                            <span className={`text-[13px] leading-snug ${item.bold ? 'font-bold' : 'font-semibold'} ${item.color || 'text-slate-700'}`}>
                                                                {item.value}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {formData.certifications.length > 0 && (
                                                        <div className="flex flex-col gap-0.5 border-b border-slate-50 pb-2 last:border-0">
                                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Certificates</span>
                                                            <div className="flex items-center gap-1.5 text-[13px] font-bold text-green-600">
                                                                <FileText className="h-3.5 w-3.5" />
                                                                {formData.certifications.length} Files Attached
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                            <Checkbox 
                                                id="c1" 
                                                checked={formData.agreedCommission}
                                                onCheckedChange={(c) => setFormData({ ...formData, agreedCommission: c })} 
                                            />
                                            <label htmlFor="c1" className="text-xs font-bold text-gray-700 leading-snug cursor-pointer">
                                                I accept the 85/15 Payout Commission Policy.
                                            </label>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                            <Checkbox 
                                                id="c2" 
                                                checked={formData.agreedGuidelines}
                                                onCheckedChange={(c) => setFormData({ ...formData, agreedGuidelines: c })} 
                                            />
                                            <label htmlFor="c2" className="text-xs font-bold text-gray-700 leading-snug cursor-pointer">
                                                I agree to follow the Safety & Hygiene Guidelines on every visit.
                                            </label>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                            <Checkbox 
                                                id="c3" 
                                                checked={formData.agreedBackgroundCheck}
                                                onCheckedChange={(c) => setFormData({ ...formData, agreedBackgroundCheck: c })} 
                                            />
                                            <label htmlFor="c3" className="text-xs font-bold text-gray-700 leading-snug cursor-pointer">
                                                I understand that my profile will be subject to a Background Check.
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {stepError && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3"
                            >
                                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                                <p className="text-sm font-bold text-red-700">{stepError}</p>
                            </motion.div>
                        )}

                        <div className="flex gap-4 mt-10">
                            {currentStep > 1 && (
                                <Button
                                    variant="outline"
                                    onClick={prevStep}
                                    className="flex-1 h-14 rounded-2xl font-black text-gray-600 border-gray-200"
                                >
                                    Back
                                </Button>
                            )}
                            <Button
                                onClick={nextStep}
                                className={`flex-[2] h-14 rounded-2xl font-black text-lg shadow-xl transition-all border-none ${
                                    currentStep === 5 && (
                                        !formData.agreedCommission || 
                                        !formData.agreedGuidelines || 
                                        !formData.agreedBackgroundCheck
                                    )
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none hover:bg-gray-300'
                                        : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200'
                                }`}
                                disabled={
                                    isLoading || 
                                    (currentStep === 5 && (
                                        !formData.agreedCommission || 
                                        !formData.agreedGuidelines || 
                                        !formData.agreedBackgroundCheck
                                    ))
                                }
                            >
                                {isLoading ? <Loader2 className="animate-spin" /> : currentStep === 5 ? "Submit Application" : "Continue"}
                                {!isLoading && currentStep !== 5 && <ArrowRight className="ml-2 h-5 w-5" />}
                            </Button>
                        </div>

                        {currentStep === 1 && (
                            <div className="text-center pt-6">
                                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none">
                                    Already a partner? <Link to="/provider/login" className="text-violet-600">Login Here</Link>
                                </p>
                            </div>
                        )}

                        {/* Global Camera Modal */}
                        {isCameraOpen && (
                            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                                <div className="absolute inset-0 bg-black/70" onClick={stopCamera} />
                                <div className="relative bg-white rounded-2xl p-4 w-full max-w-sm z-10">
                                    <div className="rounded-xl overflow-hidden bg-black">
                                        <video ref={videoRef} className="w-full h-80 object-cover" autoPlay muted playsInline />
                                        <canvas ref={canvasRef} className="hidden" />
                                    </div>
                                    {!isVideoReady && !cameraError && <p className="text-sm text-gray-500 mt-2">Starting camera...</p>}
                                    {cameraError && <p className="text-sm text-red-600 mt-2">{cameraError}</p>}
                                    <div className="flex gap-3 mt-4">
                                        <Button type="button" className="flex-1 h-12 rounded-xl font-bold" disabled={!isVideoReady} onClick={capturePhoto}>Capture</Button>
                                        <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={stopCamera}>Cancel</Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
