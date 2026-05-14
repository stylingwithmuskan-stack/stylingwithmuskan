const mongoose = require('mongoose');
const Booking = require('./src/models/Booking');
const ProviderAccount = require('./src/models/ProviderAccount');

async function check() {
    try {
        const uri = "mongodb+srv://stylingwithmuskan_db_user:stylewithmuskan6118@cluster0.ls0uuhc.mongodb.net/swm";
        await mongoose.connect(uri);
        
        const booking = await Booking.findOne().sort({ createdAt: -1 });
        console.log("--- LATEST BOOKING ---");
        console.log("ID:", booking?._id);
        console.log("Status:", booking?.status);
        console.log("CityID:", booking?.cityId);
        console.log("ZoneID:", booking?.zoneId);
        console.log("Gender Preference:", booking?.gender);
        
        // Target phones from your request
        const providers = await ProviderAccount.find({ phone: { $in: ["7458947838", "7610416911"] } });
        console.log("\n--- TARGET PROVIDERS ---");
        providers.forEach(p => {
            console.log("Name:", p.name);
            console.log("Phone:", p.phone);
            console.log("Status:", p.approvalStatus);
            console.log("CityID:", p.cityId);
            console.log("ZoneIDs:", p.zoneIds);
            console.log("Gender:", p.gender);
            console.log("Online Status:", p.isOnline);
            
            // Basic eligibility check
            const cityMatch = String(p.cityId) === String(booking?.cityId);
            const zoneMatch = booking?.zoneId ? p.zoneIds.includes(String(booking.zoneId)) : true;
            const genderMatch = !booking?.gender || booking.gender === "any" || p.gender === booking.gender;
            
            console.log(`>> Eligibility: City=${cityMatch}, Zone=${zoneMatch}, Gender=${genderMatch}`);
        });
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

check();
