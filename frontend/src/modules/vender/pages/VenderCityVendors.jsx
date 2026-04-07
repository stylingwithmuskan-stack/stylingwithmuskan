import React, { useEffect, useMemo, useState } from "react";
import { Users, MapPin, Phone, Mail, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/user/components/ui/card";
import { Button } from "@/modules/user/components/ui/button";
import { Badge } from "@/modules/user/components/ui/badge";
import { Input } from "@/modules/user/components/ui/input";
import { useVenderAuth } from "@/modules/vender/contexts/VenderAuthContext";

export default function VenderCityVendors() {
    const { getCityVendors, hydrated, isLoggedIn, vendor } = useVenderAuth();
    const [vendors, setVendors] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    const loadVendors = async () => {
        try {
            setLoading(true);
            if (!hydrated || !isLoggedIn) return;
            const items = await getCityVendors();
            setVendors(Array.isArray(items) ? items : []);
        } catch {
            setVendors([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadVendors(); }, [hydrated, isLoggedIn]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return vendors;
        return vendors.filter(v =>
            (v.name || "").toLowerCase().includes(q) ||
            (v.email || "").toLowerCase().includes(q) ||
            (v.phone || "").includes(q)
        );
    }, [vendors, search]);

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[150px]">
                    <h1 className="text-xl md:text-3xl font-black tracking-tight flex items-center gap-1.5 md:gap-2">
                        <Users className="h-5 w-5 md:h-7 md:w-7 text-primary" /> City Vendors
                    </h1>
                    <p className="text-[9px] md:text-sm text-muted-foreground font-medium mt-0.5">
                        Vendors operating in {vendor?.city || "your city"}
                    </p>
                </div>
                <Button onClick={loadVendors} variant="outline" size="sm" className="gap-1.5 rounded-lg font-bold text-xs h-8 shrink-0">
                    <RefreshCw className="h-3 w-3" /> <span className="hidden sm:inline">Refresh</span>
                </Button>
            </div>

            <div className="flex items-center gap-3 w-full md:max-w-sm">
                <Input
                    placeholder="Search by name, email, phone"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-xl h-9 text-[11px] md:text-sm font-medium border-emerald-100"
                />
            </div>

            {loading ? (
                <Card className="shadow-sm">
                    <CardContent className="py-16 text-center text-sm text-muted-foreground">Loading vendors...</CardContent>
                </Card>
            ) : filtered.length === 0 ? (
                <Card className="shadow-sm">
                    <CardContent className="py-16 text-center">
                        <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-bold text-muted-foreground">No vendors found</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Vendors in this city will appear here once approved</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-2 md:gap-3">
                    {filtered.map(v => (
                        <Card key={v._id || v.id || v.email} className="shadow-sm hover:shadow-md transition-all">
                            <CardContent className="p-3 md:p-5">
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-sm md:text-base font-bold flex items-center gap-1.5 md:gap-2 text-foreground">
                                        <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary shrink-0" /> <span className="truncate">{v.name || "Vendor"}</span>
                                        <Badge variant="outline" className="text-[8px] md:text-[9px] font-black px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0 ml-auto sm:ml-0">
                                            Approved
                                        </Badge>
                                    </h3>
                                    <div className="flex flex-col gap-1.5 mt-0.5 md:mt-1">
                                        <div className="flex items-center gap-2 text-[11px] md:text-sm text-muted-foreground">
                                            <MapPin className="h-3 w-3 md:h-4 w-4 shrink-0" />
                                            <span className="truncate">{v.city || "-"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] md:text-sm text-muted-foreground">
                                            <Phone className="h-3 w-3 md:h-4 w-4 shrink-0" />
                                            <span>{v.phone || "-"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] md:text-sm text-muted-foreground">
                                            <Mail className="h-3 w-3 md:h-4 w-4 shrink-0" />
                                            <span className="truncate">{v.email || "-"}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
