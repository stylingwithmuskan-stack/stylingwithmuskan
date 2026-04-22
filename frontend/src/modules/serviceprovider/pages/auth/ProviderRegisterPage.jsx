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
    X,
    Plus,
    AlertCircle,
    CheckCircle2,
    User
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

const steps = [
    { title: "Personal", icon: CheckCircle2 },
    { title: "KYC", icon: ShieldCheck },
    { title: "Professional", icon: Briefcase },
    { title: "Bank", icon: Banknote },
    { title: "Review", icon: FileText }
];

const STORAGE_KEY = 'swm-provider-registration';
const EXPIRY_DAYS = 7;

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
    }, []);

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

    useEffect(() => {
        let cancelled = false;
        setCatalogLoading(true);
        Promise.all([
            api.content.serviceTypes(),
            api.content.categories(),
            api.content.services()
        ]).then(([stRes, catRes, svcRes]) => {
            if (cancelled) return;
            setServiceTypesList(Array.isArray(stRes?.data) ? stRes.data : []);
            setCategoriesList(Array.isArray(catRes?.data) ? catRes.data : []);
            setServicesList(Array.isArray(svcRes?.data) ? svcRes.data : []);
        }).catch(() => {
            if (cancelled) return;
            setServiceTypesList([]);
            setCategoriesList([]);
            setServicesList([]);
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
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [isVideoReady, setIsVideoReady] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const startCamera = async () => {
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
    };

    const capturePhoto = () => {
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas) return;
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
            setFormData(prev => ({ ...prev, profilePhoto: data }));
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
                certifications: [...prev.certifications, ...items],
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
            if (!formData.name.trim()) {
                setStepError("Please enter your full name as per Aadhar");
                return;
            }
            // Email validation: Allow common valid TLDs, reject .co
            const emailRegex = /^[^\s@]+@[^\s@]+\.(com|net|org|edu|gov|mil|in|uk|us|ca|au|de|jp|fr|it|ru|br|cn|nl|se|no|es|mx|za|nz|sg|hk|ae|sa|eg|pk|bd|my|th|vn|id|ph|kr|tw|tr|pl|ua|ro|cz|be|gr|pt|hu|at|ch|dk|fi|ie|il|ar|cl|co\.in|co\.uk|co\.za|ac\.in|edu\.in|gov\.in|org\.in|net\.in|info|biz|io|app|dev|tech|online|site|store|shop|xyz|pro|name|mobi|asia|tel|travel|jobs|cat|aero|coop|museum)$/i;
            if (!formData.email.trim() || !emailRegex.test(formData.email)) {
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
                const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;
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
            
            // Clear localStorage after successful registration
            localStorage.removeItem(STORAGE_KEY);
            
            setIsLoading(false);
            setIsSuccess(true);
        } catch (err) {
            setOtpError(err.message || "Registration failed");
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
                                    <div
                                        className="relative group cursor-pointer"
                                        onClick={startCamera}
                                    >
                                        <div className="w-32 h-32 rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-violet-600 group-active:scale-95">
                                            {formData.profilePhoto ? (
                                                <img src={formData.profilePhoto} className="w-full h-full object-cover" alt="Profile" />
                                            ) : (
                                                <>
                                                    <Camera className="h-10 w-10 text-gray-300 group-hover:text-violet-600 transition-colors" />
                                                    <span className="text-[10px] font-black uppercase text-gray-400 mt-1">Live Photo</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400 mt-4 uppercase tracking-widest leading-none">Live Camera Only</p>

                                    {/* Camera Modal */}
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
                                </div>

                                {/* 2. Full Name */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-gray-400">Full Name</Label>
                                    <Input
                                        placeholder="Enter as per Aadhar"
                                        className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                {/* 3. Email */}
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
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-gray-400">Mobile Number</Label>
                                    <Input
                                        type="tel"
                                        placeholder="10-digit mobile number"
                                        className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                    />
                                    <div className="mt-2 space-y-2">
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-10 rounded-xl text-xs font-black uppercase tracking-widest"
                                                onClick={handleSendOtp}
                                                disabled={otpLoading || !/^\d{10}$/.test(formData.phone)}
                                            >
                                                {otpSent ? "Resend OTP" : "Send OTP"}
                                            </Button>
                                            <Input
                                                type="text"
                                                placeholder="Enter 6-digit OTP"
                                                className="h-10 rounded-xl bg-gray-50 border-gray-100 font-bold text-center tracking-widest w-40"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                disabled={!otpSent || otpVerified}
                                            />
                                            <Button
                                                type="button"
                                                className="h-10 rounded-xl text-xs font-black uppercase tracking-widest bg-violet-600 hover:bg-violet-700"
                                                onClick={handleVerifyOtp}
                                                disabled={otpLoading || otp.length !== 6 || otpVerified}
                                            >
                                                {otpVerified ? "Verified" : "Verify OTP"}
                                            </Button>
                                        </div>
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

                                {/* 7. Custom Zone Section with Use Current Location */}
                                <div className="space-y-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-black uppercase text-amber-900">Custom Zone (Optional)</Label>
                                        <p className="text-[10px] text-amber-700 font-medium">If your location is not listed in the zones above</p>
                                    </div>

                                    {/* Use Current Location Button */}
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

                                                    // Try Google Maps Geocoding first
                                                    if (window.google?.maps && googleKey) {
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

                                                                        // Format address line 1
                                                                        const addressLine1 = [houseNo, street, landmark]
                                                                            .filter(Boolean)
                                                                            .join(", ");

                                                                        // Use formatted_address as fallback for area
                                                                        const areaText = area || res.formatted_address;

                                                                        // Now resolve with backend API
                                                                        resolveLocationAndSetFields(city, addressLine1, areaText);
                                                                    } else {
                                                                        if (status === "REQUEST_DENIED") {
                                                                            console.warn("Google Maps Geocoding API is not enabled");
                                                                        }
                                                                        // Fallback to backend only
                                                                        resolveLocationAndSetFields("", "", "Current Location");
                                                                    }
                                                                }
                                                            );
                                                        } catch (error) {
                                                            console.error("Google Maps Geocoding error:", error);
                                                            // Fallback to backend only
                                                            resolveLocationAndSetFields("", "", "Current Location");
                                                        }
                                                    } else {
                                                        // Google Maps not available, use backend only
                                                        console.warn("Google Maps not loaded, using backend API only");
                                                        resolveLocationAndSetFields("", "", "Current Location");
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

                                    {/* Custom Zone Input */}
                                    <div className="space-y-2">
                                        <Input
                                            placeholder="Enter custom zone name if not listed above"
                                            className="h-12 rounded-xl bg-white border-amber-200 font-bold focus:ring-amber-500"
                                            value={formData.customZone}
                                            onChange={(e) => setFormData(prev => ({ ...prev, customZone: e.target.value }))}
                                        />
                                        <p className="text-[10px] text-amber-700 font-medium">
                                            💡 Tip: Click "Use Current Location" to auto-detect your zone and fill address details
                                        </p>
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
                                        <div className="grid grid-cols-2 gap-4">
                                            <div
                                                onClick={() => aadharFrontRef.current.click()}
                                                className="border-2 border-dashed rounded-2xl aspect-[3/2] flex flex-col items-center justify-center bg-gray-50 text-gray-400 hover:border-violet-600 transition-all group cursor-pointer overflow-hidden"
                                            >
                                                {formData.aadharFront ? (
                                                    <img src={formData.aadharFront} className="w-full h-full object-cover" />
                                                ) : (
                                                    <>
                                                        <Upload className="h-6 w-6 mb-2 group-hover:scale-110 transition-transform" />
                                                        <span className="text-[10px] font-black uppercase">Front View</span>
                                                    </>
                                                )}
                                            </div>
                                            <div
                                                onClick={() => aadharBackRef.current.click()}
                                                className="border-2 border-dashed rounded-2xl aspect-[3/2] flex flex-col items-center justify-center bg-gray-50 text-gray-400 hover:border-violet-600 transition-all group cursor-pointer overflow-hidden"
                                            >
                                                {formData.aadharBack ? (
                                                    <img src={formData.aadharBack} className="w-full h-full object-cover" />
                                                ) : (
                                                    <>
                                                        <Upload className="h-6 w-6 mb-2 group-hover:scale-110 transition-transform" />
                                                        <span className="text-[10px] font-black uppercase">Back View</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-black uppercase text-gray-400">PAN Card</Label>
                                        <div
                                            onClick={() => panCardRef.current.click()}
                                            className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center bg-gray-50 text-gray-400 hover:border-violet-600 transition-all cursor-pointer overflow-hidden min-h-[100px]"
                                        >
                                            {formData.panCard ? (
                                                <div className="flex items-center gap-2 text-purple-600">
                                                    <CheckCircle2 className="h-5 w-5" />
                                                    <span className="text-xs font-bold">PAN Card Uploaded</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <Upload className="h-6 w-6 mb-2" />
                                                    <span className="text-xs font-bold text-gray-500">Tap to upload PAN Card PDF or Image</span>
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
                                    <div className="flex flex-wrap gap-2">
                                        {serviceTypeOptions.length > 0 ? serviceTypeOptions.map(cat => (
                                            <button
                                                key={cat.id || cat.label}
                                                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-tight transition-all border ${formData.primaryCategory.includes(cat.label)
                                                    ? "bg-purple-600 text-white border-purple-600 shadow-md"
                                                    : "bg-white text-gray-500 border-gray-100 hover:border-purple-200"
                                                    }`}
                                                onClick={() => {
                                                    const updated = formData.primaryCategory.includes(cat.label)
                                                        ? formData.primaryCategory.filter(c => c !== cat.label)
                                                        : [...formData.primaryCategory, cat.label];
                                                    setFormData({ ...formData, primaryCategory: updated });
                                                }}
                                            >
                                                {cat.label}
                                            </button>
                                        )) : (
                                            <p className="text-xs font-semibold text-gray-400">
                                                {catalogLoading ? "Loading categories..." : "No categories available"}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase text-gray-400">Sub Categories (Specializations)</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {filteredCategories.length > 0 ? filteredCategories.map(spec => (
                                            <button
                                                key={spec.id || spec.name}
                                                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-tight transition-all border ${formData.specializations.includes(spec.name)
                                                    ? "bg-blue-600 text-white border-blue-600 shadow-md"
                                                    : "bg-white text-gray-500 border-gray-100 hover:border-blue-200"
                                                    }`}
                                                onClick={() => {
                                                    const updated = formData.specializations.includes(spec.name)
                                                        ? formData.specializations.filter(s => s !== spec.name)
                                                        : [...formData.specializations, spec.name];
                                                    setFormData({ ...formData, specializations: updated });
                                                }}
                                            >
                                                {spec.name}
                                            </button>
                                        )) : (
                                            <p className="text-xs font-semibold text-gray-400 py-2">
                                                {catalogLoading 
                                                    ? "Loading sub categories..." 
                                                    : formData.primaryCategory.length > 0 
                                                        ? "No sub categories available for selected primary categories"
                                                        : "Please select primary categories first to see sub categories"}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase text-gray-400">Services</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {serviceOptions.length > 0 ? serviceOptions.map(svc => (
                                            <button
                                                key={svc.id || svc.name}
                                                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-tight transition-all border ${formData.services.includes(svc.name)
                                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                                                    : "bg-white text-gray-500 border-gray-100 hover:border-emerald-200"
                                                    }`}
                                                onClick={() => {
                                                    const updated = formData.services.includes(svc.name)
                                                        ? formData.services.filter(s => s !== svc.name)
                                                        : [...formData.services, svc.name];
                                                    setFormData({ ...formData, services: updated });
                                                }}
                                            >
                                                {svc.name}
                                            </button>
                                        )) : (
                                            <p className="text-xs font-semibold text-gray-400 py-2">
                                                {catalogLoading 
                                                    ? "Loading services..." 
                                                    : formData.primaryCategory.length > 0 || formData.specializations.length > 0
                                                        ? "No services available for selected categories"
                                                        : "Please select categories first to see services"}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase text-gray-400">Upload Certifications</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {formData.certifications.map((c, idx) => (
                                            <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border bg-white">
                                                {c.type?.includes("image") ? (
                                                    <img src={c.data} alt={c.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-xs">
                                                        <FileText className="h-8 w-8 mb-1" />
                                                        <span className="px-2 truncate">{c.name}</span>
                                                    </div>
                                                )}
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
                                        <button
                                            type="button"
                                            onClick={() => certsInputRef.current?.click()}
                                            className="aspect-square rounded-2xl bg-gray-50 border-2 border-dashed flex items-center justify-center text-gray-300 hover:border-purple-600 transition-colors"
                                        >
                                            <Plus className="h-6 w-6" />
                                        </button>
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
                                            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-gray-400">IFSC Code</Label>
                                            <Input
                                                placeholder="HDFC0001234"
                                                className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold uppercase"
                                                value={formData.ifscCode}
                                                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-gray-400">UPI ID (Optional)</Label>
                                            <Input
                                                placeholder="e.g., 9876543210@paytm, username@ybl"
                                                className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold"
                                                pattern="[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+"
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
                                                I accept the <span className="text-violet-600">85/15 Payout Commission</span> Policy.
                                            </label>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                            <Checkbox 
                                                id="c2" 
                                                checked={formData.agreedGuidelines}
                                                onCheckedChange={(c) => setFormData({ ...formData, agreedGuidelines: c })} 
                                            />
                                            <label htmlFor="c2" className="text-xs font-bold text-gray-700 leading-snug cursor-pointer">
                                                I agree to follow the <span className="text-violet-600">Safety & Hygiene Guidelines</span> on every visit.
                                            </label>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                            <Checkbox 
                                                id="c3" 
                                                checked={formData.agreedBackgroundCheck}
                                                onCheckedChange={(c) => setFormData({ ...formData, agreedBackgroundCheck: c })} 
                                            />
                                            <label htmlFor="c3" className="text-xs font-bold text-gray-700 leading-snug cursor-pointer">
                                                I understand that my profile will be subject to a <span className="text-violet-600">Background Check</span>.
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
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
