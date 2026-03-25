import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Clock,
    Plane,
    CheckCircle2,
    AlertCircle,
    MoreHorizontal,
    Info
} from "lucide-react";
import { Button } from "@/modules/user/components/ui/button";
import { Switch } from "@/modules/user/components/ui/switch";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/modules/user/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, addHours, isBefore, isWeekend } from "date-fns";
import { api } from "@/modules/user/lib/api";
import { useProviderAuth } from "@/modules/serviceprovider/contexts/ProviderAuthContext";
import { useUserModuleData } from "@/modules/user/contexts/UserModuleDataContext";
import { useNavigate } from "react-router-dom";

const timeSlots = [
    "07:00 AM", "07:30 AM", "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
    "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM",
    "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM", "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM"
];

export default function AvailabilityCalendar() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const { officeSettings } = useUserModuleData();

    // Day-based availability states
    const [dateSlots, setDateSlots] = useState({});
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [savingSlots, setSavingSlots] = useState(false);

    // Leave states
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveType, setLeaveType] = useState("Full Day");
    const [leaveStartDate, setLeaveStartDate] = useState("");
    const [leaveStartTime, setLeaveStartTime] = useState("");
    const [leaveEndDate, setLeaveEndDate] = useState("");
    const [leaveEndTime, setLeaveEndTime] = useState("");
    const [leaveReason, setLeaveReason] = useState("");
    const [leaves, setLeaves] = useState([]);
    const { isLoggedIn, logout } = useProviderAuth();
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        if (!isLoggedIn) return;
        api.provider.leaves.list().then(({ leaves }) => {
            if (!cancelled) setLeaves(leaves || []);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [isLoggedIn]);

    useEffect(() => {
        let cancelled = false;
        if (!isLoggedIn || !selectedDate) return;
        setLoadingSlots(true);
        api.provider.availability.get(selectedDate).then(({ slots }) => {
            if (cancelled) return;
            setDateSlots(prev => ({ ...prev, [selectedDate]: slots || {} }));
        }).catch((e) => {
            if (e?.status === 401) {
                toast.error("Session expired, please login again");
                logout();
                navigate("/provider/login", { replace: true });
                return;
            }
            // If API fails, keep the default UI behavior.
        }).finally(() => {
            if (!cancelled) setLoadingSlots(false);
        });
        return () => { cancelled = true; };
    }, [isLoggedIn, selectedDate]);

    const monthDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        const days = [];
        for (let i = 0; i < first.getDay(); i++) days.push(null);
        for (let d = 1; d <= last.getDate(); d++) {
            const date = new Date(year, month, d);
            const key = format(date, "yyyy-MM-dd");
            days.push({
                date: d,
                key,
                isToday: key === format(new Date(), "yyyy-MM-dd"),
                dayOfWeek: date.getDay()
            });
        }
        return days;
    }, [currentMonth]);

    const currentDaySlots = useMemo(() => {
        const slotsFromApi = dateSlots[selectedDate];
        if (slotsFromApi && Object.keys(slotsFromApi).length > 0) return slotsFromApi;

        // Dynamic Default Range from Admin Settings
        const startMin = officeSettings?.providerStartTime ? (parseInt(officeSettings.providerStartTime.split(":")[0]) * 60 + parseInt(officeSettings.providerStartTime.split(":")[1])) : 540; // 9 AM
        const endMin = officeSettings?.providerEndTime ? (parseInt(officeSettings.providerEndTime.split(":")[0]) * 60 + parseInt(officeSettings.providerEndTime.split(":")[1])) : 1020; // 5 PM

        return timeSlots.reduce((acc, slot) => {
            const m = String(slot || "").trim().match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
            if (!m) {
                acc[slot] = false;
                return acc;
            }
            let hh = parseInt(m[1], 10);
            const mm = parseInt(m[2], 10);
            const ap = m[3].toUpperCase();
            if (ap === "AM" && hh === 12) hh = 0;
            else if (ap === "PM" && hh !== 12) hh += 12;
            const slotMin = hh * 60 + mm;

            acc[slot] = slotMin >= startMin && slotMin <= endMin;
            return acc;
        }, {});
    }, [dateSlots, selectedDate, officeSettings, timeSlots]);

    const parseSlotToDate = (dateKey, slotLabel) => {
        try {
            const m = String(slotLabel || "").trim().match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
            if (!m) return null;
            let hh = parseInt(m[1], 10);
            const mm = parseInt(m[2], 10);
            const ap = m[3].toUpperCase();
            if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
            if (ap === "AM") {
                if (hh === 12) hh = 0;
            } else {
                if (hh !== 12) hh += 12;
            }
            const dt = new Date(`${dateKey}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);
            return isNaN(dt.getTime()) ? null : dt;
        } catch {
            return null;
        }
    };

    const todayKey = format(new Date(), "yyyy-MM-dd");
    const isPastDay = selectedDate < todayKey;
    const cutoff = addHours(new Date(), 4);
    const isSlotLocked = (slotLabel) => {
        if (selectedDate !== todayKey) return false;
        const dt = parseSlotToDate(selectedDate, slotLabel);
        if (!dt) return false;
        return isBefore(dt, cutoff);
    };

    const activeApprovedLeave = useMemo(() => {
        const sel = selectedDate;
        for (const l of (leaves || [])) {
            if (l?.status !== "approved") continue;
            const startKey = format(new Date(l.startAt), "yyyy-MM-dd");
            const endKey = (l.endDate && /^\d{4}-\d{2}-\d{2}$/.test(l.endDate)) ? l.endDate : startKey;
            if (sel >= startKey && sel <= endKey) return l;
        }
        return null;
    }, [leaves, selectedDate]);

    const saveSlots = async (date, slots) => {
        if (!isLoggedIn) return;
        setSavingSlots(true);
        try {
            await api.provider.availability.set(date, slots);
            toast.success("Availability saved");
        } catch (e) {
            if (e?.status === 401) {
                toast.error("Session expired, please login again");
                logout();
                navigate("/provider/login", { replace: true });
                return;
            }
            toast.error(e?.message || "Failed to save availability");
        } finally {
            setSavingSlots(false);
        }
    };

    const toggleSlot = async (slot) => {
        if (isPastDay) {
            toast.error("You cannot edit past dates");
            return;
        }
        if (activeApprovedLeave) {
            toast.error("You are on approved leave for this date");
            return;
        }
        if (isSlotLocked(slot)) {
            toast.error("This slot is locked (within 4 hours)");
            return;
        }
        const next = {
            ...currentDaySlots,
            [slot]: !currentDaySlots[slot]
        };
        setDateSlots(prev => ({ ...prev, [selectedDate]: next }));
        await saveSlots(selectedDate, next);
    };

    const handleBulkToggle = async (val) => {
        if (isPastDay) {
            toast.error("You cannot edit past dates");
            return;
        }
        if (activeApprovedLeave) {
            toast.error("You are on approved leave for this date");
            return;
        }
        const locked = timeSlots.filter((s) => isSlotLocked(s));
        if (locked.length > 0) {
            toast.error("Some slots are locked (within 4 hours). Edit future slots only.");
            return;
        }
        const next = timeSlots.reduce((acc, slot) => {
            acc[slot] = val;
            return acc;
        }, {});
        setDateSlots(prev => ({ ...prev, [selectedDate]: next }));
        toast.success(`Turned ${val ? 'ON' : 'OFF'} all slots for this day`);
        await saveSlots(selectedDate, next);
    };

    const handleLeaveSubmit = async () => {
        if (!leaveStartDate || !leaveStartTime) return;
        try {
            const startAt = `${leaveStartDate}T${leaveStartTime}:00`;
            const start = new Date(startAt);
            const now = new Date();
            const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
            if (isNaN(start.getTime())) {
                toast.error("Please select a valid start date & time");
                return;
            }
            if (diffHours < 24) {
                toast.error("Leave must be at least 24 hours in advance");
                return;
            }

            const payload = {
                type: leaveType,
                startAt: startAt,
                endDate: leaveEndDate ? (leaveEndTime ? `${leaveEndDate}T${leaveEndTime}:00` : leaveEndDate) : undefined,
                reason: leaveReason
            };

            const res = await api.provider.leaves.create(payload);
            const { leaves: latest } = await api.provider.leaves.list();
            setLeaves(latest || []);
            setShowLeaveModal(false);
            setLeaveStartDate(""); setLeaveStartTime(""); setLeaveEndDate(""); setLeaveEndTime(""); setLeaveReason("");
            const status = res?.leave?.status || "pending";
            toast.success(status === "approved" ? "Leave approved" : "Leave request submitted - Pending approval");
        } catch (e) {
            toast.error(e?.message || "Failed to submit leave");
        }
    };

    const totalHours = Object.values(currentDaySlots).filter(Boolean).length;

    return (
        <div className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-50 via-background to-background min-h-screen pb-32 overflow-y-auto -m-4 md:m-0">
            <div className="max-w-4xl mx-auto p-4 space-y-6">

                {/* Header - Beautician Style */}
                <div className="pt-4 flex justify-between items-end">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Schedule & Availability</h1>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Configure your service hours</p>
                    </div>
                    <Button onClick={() => setShowLeaveModal(true)} variant="outline" className="h-10 px-6 rounded-2xl border-slate-200 text-xs font-black gap-2 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                        <Plane className="w-4 h-4" /> REQUEST LEAVE
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Calendar & History */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Calendar Card */}
                        <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-xl shadow-slate-200/50">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black uppercase text-slate-900 tracking-widest">
                                    {format(currentMonth, "MMMM yyyy")}
                                </h3>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all"><ChevronLeft className="w-4 h-4" /></button>
                                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all"><ChevronRight className="w-4 h-4" /></button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-1 mb-4">
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                                    <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase py-2">{d}</div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1.5">
                                {monthDays.map((day, i) => {
                                    if (!day) return <div key={i} />;
                                    const isSelected = selectedDate === day.key;
                                    const hasData = dateSlots[day.key];
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedDate(day.key)}
                                            className={`aspect-square rounded-2xl text-[13px] font-black flex flex-col items-center justify-center transition-all relative ${isSelected ? "bg-slate-900 text-white shadow-lg scale-105 z-10" :
                                                hasData ? "bg-purple-50 text-purple-700 border border-purple-100" :
                                                    "bg-slate-50 text-slate-700 hover:bg-slate-100"
                                                } ${day.isToday && !isSelected ? "ring-2 ring-purple-600/30 ring-offset-2" : ""}`}
                                        >
                                            {day.date}
                                            {hasData && !isSelected && <div className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-purple-400" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Leave History Card */}
                        {leaves.length > 0 && (
                            <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Leaves</h4>
                                    <MoreHorizontal className="h-4 w-4 text-slate-300" />
                                </div>
                                <div className="space-y-3">
                                    {leaves.map(l => (
                                        <div key={l._id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group hover:border-purple-200 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:rotate-6 transition-transform">
                                                    <Plane className="w-4 h-4 text-slate-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">
                                                        {format(new Date(l.startAt), "MMM dd, yyyy")}
                                                        {l.endDate && /^\d{4}-\d{2}-\d{2}$/.test(l.endDate) && l.endDate !== format(new Date(l.startAt), "yyyy-MM-dd") && ` - ${format(new Date(l.endDate), "MMM dd, yyyy")}`}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{l.reason || "Professional Break"}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full border shadow-sm ${l.status === "approved" ? "bg-green-50 text-green-600 border-green-100" :
                                                    l.status === "pending" ? "bg-amber-50 text-amber-600 border-amber-100 animate-pulse" :
                                                        "bg-slate-100 text-slate-400 border-slate-200"
                                                }`}>
                                                {l.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Slot Toggles */}
                    <div className="lg:col-span-4">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedDate}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-2xl shadow-slate-200/60 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar"
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                                            {format(new Date(selectedDate), "MMM dd")} slots
                                        </h3>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <div className="h-1.5 w-1.5 bg-green-500 rounded-full" />
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{totalHours} Hours Live</p>
                                        </div>
                                        {(loadingSlots || savingSlots) && (
                                            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                {loadingSlots ? "Loading saved availability..." : "Saving changes..."}
                                            </p>
                                        )}
                                        {isPastDay && (
                                            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                Past dates cannot be edited
                                            </p>
                                        )}
                                        {activeApprovedLeave && (
                                            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-amber-600">
                                                On approved leave for this date
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex gap-1">
                                        {/* On All Confirmation */}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button disabled={loadingSlots || savingSlots || isPastDay || !!activeApprovedLeave} className="text-[9px] font-black uppercase px-2 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:pointer-events-none">ON ALL</button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="text-xl font-black">Enable All Slots?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-slate-500 font-medium">
                                                        This will mark you as available for all 16 time slots on {format(new Date(selectedDate), "PPP")}.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="gap-2">
                                                    <AlertDialogCancel className="rounded-xl font-bold border-slate-100">Wait, No</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleBulkToggle(true)} className="rounded-xl font-bold bg-slate-900">Yes, Turn ON</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>

                                        {/* Off All Confirmation */}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button disabled={loadingSlots || savingSlots || isPastDay || !!activeApprovedLeave} className="text-[9px] font-black uppercase px-2 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:pointer-events-none">OFF ALL</button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="text-xl font-black">Disable All Slots?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-slate-500 font-medium">
                                                        This will mark you as unavailable for the entire day. Any active leads for this day may be reassigned.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="gap-2">
                                                    <AlertDialogCancel className="rounded-xl font-bold border-slate-100">Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleBulkToggle(false)} className="rounded-xl font-bold bg-red-600 hover:bg-red-700">Confirm OFF</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {timeSlots.map(slot => {
                                        const isActive = currentDaySlots[slot];
                                        return (
                                            <div
                                                key={slot}
                                                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${isActive ? 'bg-purple-50/50 border-purple-200' : 'bg-white border-slate-100'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Clock className={`h-3.5 w-3.5 ${isActive ? 'text-purple-600 font-bold' : 'text-slate-300'}`} />
                                                    <span className={`text-xs font-bold ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{slot}</span>
                                                </div>
                                                <Switch
                                                    checked={isActive}
                                                    onCheckedChange={() => toggleSlot(slot)}
                                                    className="data-[state=checked]:bg-purple-600 scale-90"
                                                    disabled={loadingSlots || savingSlots || isPastDay || !!activeApprovedLeave || isSlotLocked(slot)}
                                                    title={isSlotLocked(slot) ? "Cannot change availability within 4 hours of the slot time" : ""}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-6 p-4 bg-slate-900 rounded-[24px] flex gap-3 shadow-lg ring-1 ring-white/10">
                                    <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                        <Info className="w-4 h-4 text-purple-400" />
                                    </div>
                                    <p className="text-[10px] text-slate-300 font-bold leading-relaxed uppercase tracking-widest">
                                        Available hours help you rank higher in search results.
                                    </p>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Leave Request Modal - Modified Logic */}
            <AnimatePresence>
                {showLeaveModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLeaveModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 40 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 40 }}
                            className="relative w-full max-w-sm bg-white border border-slate-100 rounded-[40px] p-8 shadow-3xl z-10 max-h-[95vh] flex flex-col"
                        >
                            <div className="flex flex-col items-center mb-6">
                                <div className="h-16 w-16 bg-purple-50 rounded-3xl flex items-center justify-center text-purple-600 mb-4 shadow-sm rotate-12">
                                    <Plane className="h-8 w-8" />
                                </div>
                                <h3 className="font-black text-2xl text-slate-900 tracking-tighter">Request Time Off</h3>
                            </div>

                            <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <button
                                        onClick={() => setLeaveType("Full Day")}
                                        className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${leaveType === "Full Day" ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                                    >
                                        Full Day
                                    </button>
                                    <button
                                        onClick={() => setLeaveType("Half Day")}
                                        className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${leaveType === "Half Day" ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                                    >
                                        Half Day
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Start Date</label>
                                        <input
                                            type="date"
                                            value={leaveStartDate}
                                            onChange={e => setLeaveStartDate(e.target.value)}
                                            className="w-full h-14 px-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-inner"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Start Time</label>
                                        <input
                                            type="time"
                                            value={leaveStartTime}
                                            onChange={e => setLeaveStartTime(e.target.value)}
                                            className="w-full h-14 px-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-inner"
                                        />
                                    </div>
                                </div>

                                {leaveType === "Full Day" && (
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">End Date (Optional)</label>
                                            <input
                                                type="date"
                                                value={leaveEndDate}
                                                onChange={e => setLeaveEndDate(e.target.value)}
                                                className="w-full h-14 px-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none shadow-inner focus:ring-2 focus:ring-purple-500 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">End Time (Optional)</label>
                                            <input
                                                type="time"
                                                value={leaveEndTime}
                                                onChange={e => setLeaveEndTime(e.target.value)}
                                                className="w-full h-14 px-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none shadow-inner focus:ring-2 focus:ring-purple-500 transition-all"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Reason</label>
                                    <textarea
                                        value={leaveReason}
                                        onChange={e => setLeaveReason(e.target.value)}
                                        placeholder="Brief explanation..."
                                        className="w-full h-24 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none resize-none focus:ring-2 focus:ring-purple-500 transition-all shadow-inner"
                                    />
                                </div>

                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <p className="text-[10px] text-amber-800 font-bold leading-tight uppercase tracking-tighter">
                                    Leaves must be applied at least 24 hours prior. Weekend or more than 3 days requires admin approval.
                                    </p>
                                </div>

                                <Button onClick={handleLeaveSubmit} disabled={!leaveStartDate || !leaveStartTime} className="w-full h-14 rounded-2xl font-black text-sm bg-slate-900 text-white shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                    SUBMIT REQUEST
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            `}} />
        </div>
    );
}
