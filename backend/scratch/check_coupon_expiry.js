
const expiryDate = "2026-05-07";
const now = new Date("2026-05-07T11:47:40+05:30");
const expiry = new Date(expiryDate);

console.log("Now:", now.toISOString());
console.log("Expiry:", expiry.toISOString());
console.log("Expiry < Now:", expiry < now);

// Recommended fix: set expiry to end of day
const expiryEndOfDay = new Date(expiryDate);
expiryEndOfDay.setHours(23, 59, 59, 999);
console.log("Expiry End of Day:", expiryEndOfDay.toISOString());
console.log("Expiry End of Day < Now:", expiryEndOfDay < now);
