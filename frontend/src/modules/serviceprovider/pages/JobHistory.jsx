import React, { useState } from "react";
import {
    ChevronLeft,
    MoreVertical,
    Bell,
    Wallet,
    Search,
    MapPin,
    Calendar,
    Clock
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/modules/user/components/ui/tabs";
import { Card, CardContent } from "@/modules/user/components/ui/card";
import { Badge } from "@/modules/user/components/ui/badge";
import { Button } from "@/modules/user/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function JobHistory() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("upcoming");

    // Mock data for various job states
    const jobsData = {
        upcoming: [],
        pending: [
            { id: 101, service: "Hair Coloring - Global", customer: "Priya Verma", time: "Tomorrow, 11:00 AM", location: "Sector 45", status: "Pending", credits: 120 },
        ],
        completed: [
            { id: 201, service: "Makeup - Bridal", customer: "Anjali Gupta", time: "24 Feb, 03:00 PM", location: "DLF Phase 4", status: "Completed", credits: 450, earned: "₹4,500" },
            { id: 202, service: "Hair Styling - Party", customer: "Komal Singh", time: "22 Feb, 10:30 AM", location: "Golf Course Rd", status: "Completed", credits: 80, earned: "₹1,200" },
        ],
        cancelled: [
            { id: 301, service: "Facial - Detox", customer: "Suman Rao", time: "20 Feb, 05:00 PM", location: "Sushant Lok 1", status: "Cancelled", reason: "Customer not available" },
        ]
    };

    const renderJobList = (jobs, label) => {
        if (jobs.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    <div className="bg-gray-50 rounded-full p-6 mb-4">
                        <Search className="h-10 w-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">You don't have any {label} job</h3>
                    <p className="text-gray-500 mt-2 max-w-[250px]">Once you accept a lead or complete a job, it will appear here.</p>
                </div>
            );
        }

        return (
            <div className="grid gap-4 mt-4">
                {jobs.map(job => (
                    <Card key={job.id} className="overflow-hidden border-gray-100 shadow-sm border-l-4 border-l-purple-600">
                        <CardContent className="p-0">
                            <div className="p-4 bg-white">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-lg text-gray-900">{job.service}</h4>
                                    <Badge className={
                                        job.status === "Completed" ? "bg-green-100 text-green-700" :
                                            job.status === "Cancelled" ? "bg-red-100 text-red-700" :
                                                "bg-blue-100 text-blue-700"
                                    }>
                                        {job.status}
                                    </Badge>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <MapPin className="h-4 w-4 text-gray-400" />
                                        <span>{job.location}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Clock className="h-4 w-4 text-gray-400" />
                                        <span>{job.time}</span>
                                    </div>
                                    <div className="pt-2 flex items-center justify-between border-t border-dashed mt-2">
                                        <span className="text-xs font-semibold text-gray-500 uppercase">Customer: {job.customer}</span>
                                        {job.earned && <span className="font-bold text-purple-700">{job.earned}</span>}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col bg-white min-h-screen -m-4 md:m-0 overflow-hidden">
            {/* Header matching screenshot */}
            <div className="p-4 flex items-center justify-between border-b bg-white">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded-full">
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <h2 className="text-xl font-bold">Job history</h2>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-gray-50 rounded-lg px-3 py-1.5 flex items-center gap-2 border">
                        <span className="font-bold text-sm">54</span>
                        <Wallet className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="relative p-1.5 bg-gray-50 border rounded-lg">
                        <Bell className="h-5 w-5 text-gray-600" />
                        <span className="absolute top-0 right-0 h-4 w-4 bg-purple-600 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white">2</span>
                    </div>
                </div>
            </div>

            {/* Filter Tabs matching screenshot */}
            <div className="flex-1 overflow-auto">
                <Tabs defaultValue="upcoming" className="w-full" onValueChange={setActiveTab}>
                    <div className="border-b overflow-x-auto scrollbar-hide">
                        <TabsList className="bg-white h-12 w-full justify-start gap-4 px-4">
                            <TabsTrigger value="upcoming" className="data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:shadow-none rounded-none bg-transparent px-2 font-bold transition-none">Upcoming</TabsTrigger>
                            <TabsTrigger value="pending" className="data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:shadow-none rounded-none bg-transparent px-2 font-bold transition-none">Pending</TabsTrigger>
                            <TabsTrigger value="completed" className="data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:shadow-none rounded-none bg-transparent px-2 font-bold transition-none">Completed</TabsTrigger>
                            <TabsTrigger value="cancelled" className="data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:shadow-none rounded-none bg-transparent px-2 font-bold transition-none">Cancelled</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="p-4 pb-20">
                        <TabsContent value="upcoming" className="mt-0">
                            {renderJobList(jobsData.upcoming, "upcoming")}
                        </TabsContent>
                        <TabsContent value="pending" className="mt-0">
                            {renderJobList(jobsData.pending, "pending")}
                        </TabsContent>
                        <TabsContent value="completed" className="mt-0">
                            {renderJobList(jobsData.completed, "completed")}
                        </TabsContent>
                        <TabsContent value="cancelled" className="mt-0">
                            {renderJobList(jobsData.cancelled, "cancelled")}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
