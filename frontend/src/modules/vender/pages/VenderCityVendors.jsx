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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                        <Users className="h-7 w-7 text-primary" /> City Vendors
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">
                        Vendors operating in {vendor?.city || "your city"}
                    </p>
                </div>
                <Button onClick={loadVendors} variant="outline" className="gap-2 rounded-xl font-bold">
                    <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
            </div>

            <div className="flex items-center gap-3 max-w-sm">
                <Input
                    placeholder="Search by name, email, phone"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-xl h-10"
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
                <div className="grid gap-3">
                    {filtered.map(v => (
                        <Card key={v._id || v.id || v.email} className="shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Users className="h-4 w-4 text-primary" /> {v.name || "Vendor"}
                                    <Badge variant="outline" className="text-[9px] font-black px-1.5 h-4 bg-emerald-100 text-emerald-700 border-emerald-200">
                                        Approved
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground space-y-2">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    <span>{v.city || "-"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4" />
                                    <span>{v.phone || "-"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    <span>{v.email || "-"}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
