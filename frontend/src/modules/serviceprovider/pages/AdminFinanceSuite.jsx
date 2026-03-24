import React, { useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/modules/user/components/ui/card";
import { Switch } from "@/modules/user/components/ui/switch";
import { Input } from "@/modules/user/components/ui/input";
import { Label } from "@/modules/user/components/ui/label";
import { Button } from "@/modules/user/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/user/components/ui/select";
import { Building2, MessageCircle, Link as LinkIcon, Download, HeartHandshake, Phone, BadgePercent } from "lucide-react";

export default function AdminFinanceSuite() {
    const [waUpdates, setWaUpdates] = useState(true);

    return (
        <div className="flex flex-1 w-full flex-col gap-6 pt-4 md:pt-0">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Admin & FinTech Suite</h1>
                <p className="text-muted-foreground">Manage payments, taxes, communication, and unlock benefits.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* KYC Module */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-purple-600" /> Financial Details & KYC
                        </CardTitle>
                        <CardDescription>Update your taxation and banking details carefully.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="pan">PAN Number</Label>
                            <div className="flex gap-2">
                                <Input id="pan" defaultValue="ABCD1234E" disabled className="bg-muted text-muted-foreground font-mono" />
                                <Button variant="outline"><LinkIcon className="h-4 w-4 mr-2" /> Verify</Button>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="gst">GSTIN (Optional)</Label>
                            <Input id="gst" placeholder="e.g. 05AAAAA0000A1Z5" className="font-mono" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="acc">Bank Account</Label>
                            <div className="grid gap-2">
                                <Input id="acc" defaultValue="XXXX-XXXX-9821" type="password" disabled className="bg-muted" />
                                <Button variant="secondary" className="w-full">Change Primary Bank</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    {/* Communications */}
                    <Card className="shadow-sm border-blue-100 bg-blue-50/20 dark:border-blue-900/40 dark:bg-blue-950/10">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <MessageCircle className="h-5 w-5 text-blue-600" /> App Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between space-x-2">
                                <div className="flex flex-col gap-1">
                                    <Label htmlFor="whatsapp" className="flex items-center gap-2 text-sm">
                                        <Phone className="h-4 w-4 text-green-500" /> WhatsApp Updates
                                    </Label>
                                    <p className="text-[10px] text-muted-foreground">Get instant lead alerts on WhatsApp.</p>
                                </div>
                                <Switch
                                    id="whatsapp"
                                    checked={waUpdates}
                                    onCheckedChange={setWaUpdates}
                                    className="data-[state=checked]:bg-green-500"
                                />
                            </div>

                            <div className="grid gap-2 mt-4 pt-4 border-t">
                                <Label>App Language</Label>
                                <Select defaultValue="en">
                                    <SelectTrigger id="language">
                                        <SelectValue placeholder="Select language" />
                                    </SelectTrigger>
                                    <SelectContent position="popper">
                                        <SelectItem value="en">English (UK)</SelectItem>
                                        <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Partner Benefits */}
                    <Card className="shadow-sm border-purple-200 dark:border-purple-800">
                        <CardHeader className="pb-2 bg-purple-50 dark:bg-purple-900/20 rounded-t-lg">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <HeartHandshake className="h-5 w-5 text-purple-600" /> Partner Benefits
                            </CardTitle>
                            <CardDescription>Exclusive offers to help you grow your business.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 mt-4">
                            <div className="flex items-center gap-4 bg-background p-3 rounded-lg border shadow-sm">
                                <div className="h-10 w-10 shrink-0 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                                    <HeartHandshake className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-sm">Medical Insurance</h4>
                                    <p className="text-xs text-muted-foreground">Family cover starting @ ₹149/mo</p>
                                </div>
                                <Button size="sm" variant="outline">Opt-in</Button>
                            </div>
                            <div className="flex items-center gap-4 bg-background p-3 rounded-lg border shadow-sm">
                                <div className="h-10 w-10 shrink-0 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center">
                                    <BadgePercent className="h-5 w-5 text-purple-600" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-sm">Financing & Loans</h4>
                                    <p className="text-xs text-muted-foreground">Pre-approved up to ₹50,000</p>
                                </div>
                                <Button size="sm" className="bg-purple-600 hover:bg-purple-700">Apply</Button>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg border border-purple-200 bg-purple-50/50 mt-2">
                                <div>
                                    <h4 className="font-bold text-sm text-purple-900 dark:text-purple-300">UC Shop Supplies</h4>
                                    <p className="text-xs text-purple-700/80 dark:text-purple-400">Restock genuine cosmetics at 20% flat discount.</p>
                                </div>
                                <Button size="icon" className="h-8 w-8 bg-black dark:bg-white dark:text-black">
                                    <ArrowRightIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function ArrowRightIcon(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    )
}
