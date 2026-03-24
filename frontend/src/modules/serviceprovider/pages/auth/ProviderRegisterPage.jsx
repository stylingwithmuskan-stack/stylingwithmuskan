import React, { useState, useRef } from "react";
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
    CheckCircle2
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

const steps = [
    { title: "Personal", icon: CheckCircle2 },
    { title: "KYC", icon: ShieldCheck },
    { title: "Professional", icon: Briefcase },
    { title: "Bank", icon: Banknote },
    { title: "Review", icon: FileText }
];

export default function ProviderRegisterPage() {
    const navigate = useNavigate();
    const { register, provider } = useProviderAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

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
        profilePhoto: null,
        aadharFront: null,
        aadharBack: null,
        panCard: null,
        certifications: [],
        primaryCategory: [],
        specializations: [],
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        agreed: false
    });

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
                try { v.setAttribute("playsinline", "true"); } catch {}
                try { v.setAttribute("muted", "true"); } catch {}
                try { v.muted = true; } catch {}
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
                    try { await v.play(); } catch {}
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
        } catch {}
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

    const nextStep = () => {
        if (currentStep < 5) setCurrentStep(currentStep + 1);
        else handleSubmit();
    };

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const handleSubmit = () => {
        setIsLoading(true);
        setTimeout(() => {
            register(formData);
            setIsLoading(false);
            setIsSuccess(true);
        }, 2000);
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

                                <div className="flex flex-col items-center py-4">
                                    <input
                                        type="file"
                                        ref={profileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        capture="user"
                                        onChange={(e) => handleFileChange("profilePhoto", e.target.files[0])}
                                    />
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
                                        <div className="absolute -bottom-2 -right-2 bg-purple-600 text-white p-2 rounded-xl shadow-lg" onClick={(e) => { e.stopPropagation(); profileInputRef.current?.click(); }}>
                                            <Plus className="h-4 w-4" />
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

                                <div className="grid gap-6 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-gray-400">Mobile Number</Label>
                                        <Input
                                            type="tel"
                                            placeholder="10-digit mobile number"
                                            className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-gray-400">Full Name</Label>
                                        <Input
                                            placeholder="Enter as per Aadhar"
                                            className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label className="text-xs font-black uppercase text-gray-400">Address</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            <Input
                                                placeholder="Flat/Building/Landmark"
                                                className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600"
                                                value={formData.addressLine1}
                                                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                                            />
                                            <Input
                                                placeholder="Area/Colony"
                                                className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600"
                                                value={formData.area}
                                                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                                            />
                                            <Input
                                                placeholder="City"
                                                className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold focus:ring-violet-600"
                                                value={formData.city}
                                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-12 mt-2 whitespace-nowrap"
                                            onClick={() => {
                                                if (!navigator.geolocation) return alert("Geolocation not supported");
                                                navigator.geolocation.getCurrentPosition(
                                                    async (pos) => {
                                                        try {
                                                            await import("@/modules/user/lib/api").then(({ api }) =>
                                                                api.provider.updateLocation(pos.coords.latitude, pos.coords.longitude)
                                                            );
                                                            alert("Location updated");
                                                        } catch (e) {
                                                            alert(e?.message || "Failed to update location");
                                                        }
                                                    },
                                                    () => alert("Permission denied or location unavailable"),
                                                    { enableHighAccuracy: true, timeout: 8000 }
                                                );
                                            }}
                                        >
                                            Use Current Location
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-gray-400">Email Address</Label>
                                        <Input
                                            type="email"
                                            placeholder="name@example.com"
                                            className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-gray-400">Date of Birth</Label>
                                        <Input type="date" className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-gray-400">Experience (Years)</Label>
                                        <Select>
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
                                        {["Salon for Women", "Salon for Men", "Makeup", "Skin Treatment", "Nail Art"].map(cat => (
                                            <button
                                                key={cat}
                                                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-tight transition-all border ${formData.primaryCategory.includes(cat)
                                                    ? "bg-purple-600 text-white border-purple-600 shadow-md"
                                                    : "bg-white text-gray-500 border-gray-100 hover:border-purple-200"
                                                    }`}
                                                onClick={() => {
                                                    const updated = formData.primaryCategory.includes(cat)
                                                        ? formData.primaryCategory.filter(c => c !== cat)
                                                        : [...formData.primaryCategory, cat];
                                                    setFormData({ ...formData, primaryCategory: updated });
                                                }}
                                            >
                                                {cat}
                                            </button>
                                        ))}
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
                                        <Input placeholder="e.g. HDFC Bank" className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-gray-400">Account Number</Label>
                                        <Input type="password" placeholder="•••• •••• •••• 1234" className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-gray-400">IFSC Code</Label>
                                            <Input placeholder="HDFC0001234" className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold uppercase" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-gray-400">UPI ID (Optional)</Label>
                                            <Input placeholder="username@upi" className="h-12 rounded-xl bg-gray-50 border-gray-100 font-bold" />
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
                                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                                        <div className="bg-gray-50 p-3 px-4 flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase text-gray-400">Profile Summary</span>
                                            <button onClick={() => setCurrentStep(1)} className="text-[10px] font-black uppercase text-violet-600">Edit</button>
                                        </div>
                                        <div className="p-4 flex gap-4">
                                            {formData.profilePhoto && (
                                                <img src={formData.profilePhoto} className="h-20 w-16 rounded-xl object-cover border" alt="Preview" />
                                            )}
                                            <div className="flex-1 space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Name</span>
                                                    <span className="font-bold">{formData.name || "Muskan Poswal"}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">KYC Status</span>
                                                    <span className={`font-bold ${formData.aadharFront && formData.panCard ? "text-green-600" : "text-amber-600"}`}>
                                                        {formData.aadharFront && formData.panCard ? "Verified" : "Pending Uploads"}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Categories</span>
                                                    <span className="font-bold">
                                                        {formData.primaryCategory.length > 0 ? formData.primaryCategory.join(", ") : "Salon for Women, Makeup"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                            <Checkbox id="c1" onCheckedChange={(c) => setFormData({ ...formData, agreed: c })} />
                                            <label htmlFor="c1" className="text-xs font-bold text-gray-700 leading-snug cursor-pointer">
                                                I accept the <span className="text-violet-600">85/15 Payout Commission</span> Policy.
                                            </label>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                            <Checkbox id="c2" />
                                            <label htmlFor="c2" className="text-xs font-bold text-gray-700 leading-snug cursor-pointer">
                                                I agree to follow the <span className="text-violet-600">Safety & Hygiene Guidelines</span> on every visit.
                                            </label>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                            <Checkbox id="c3" />
                                            <label htmlFor="c3" className="text-xs font-bold text-gray-700 leading-snug cursor-pointer">
                                                I understand that my profile will be subject to a <span className="text-violet-600">Background Check</span>.
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
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
                                className="flex-[2] h-14 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-lg shadow-xl shadow-violet-200 transition-all border-none"
                                disabled={isLoading}
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
