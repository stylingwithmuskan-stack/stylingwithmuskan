import mongoose from "mongoose";
import { MONGO_URI, MONGO_DB } from "./src/config.js";

async function testAPIEndpoint() {
  const uri = MONGO_URI.includes('?') ? MONGO_URI.replace('?', `${MONGO_DB || 'swm'}?`) : `${MONGO_URI}/${MONGO_DB || 'swm'}`;
  console.log("🔌 Connecting to database...\n");
  await mongoose.connect(uri);

  console.log("=".repeat(80));
  console.log("🧪 SIMULATING API ENDPOINT: /providers/available-slots-by-date");
  console.log("=".repeat(80));

  // Import required modules
  const ProviderAccount = (await import("./src/models/ProviderAccount.js")).default;
  const { resolveRequestedSpecialtySets, providerMatchesRequestedSpecialties } = await import("./src/lib/serviceMatching.js");

  // Simulate user request
  const date = "2026-04-28";
  const city = "indore";
  const zone = "indore";
  const serviceTypes = ["hair"];
  const categories = ["hair-spa", "haircut", "hair-styling"];

  console.log("\n📝 User Request:");
  console.log(`  Date: ${date}`);
  console.log(`  City: ${city}`);
  console.log(`  Zone: ${zone}`);
  console.log(`  Service Types: ${JSON.stringify(serviceTypes)}`);
  console.log(`  Categories: ${JSON.stringify(categories)}`);

  // Step 1: Find providers (same as backend logic)
  console.log("\n" + "=".repeat(80));
  console.log("STEP 1: Finding providers in zone");
  console.log("=".repeat(80));

  const baseQ = {
    approvalStatus: "approved",
    registrationComplete: true,
    isOnline: true,
  };

  let q = { ...baseQ };
  q.city = new RegExp(`^${city}`, "i");
  q.$or = [
    { zones: { $in: [new RegExp(`^${zone}`, "i")] } },
    { pendingZones: { $in: [new RegExp(`^${zone}`, "i")] } },
  ];

  let providers = await ProviderAccount.find(q).lean();
  console.log(`\n✅ Found ${providers.length} providers in zone`);
  providers.forEach((p, idx) => {
    console.log(`  ${idx + 1}. ${p.name} (${p.phone}) - Online: ${p.isOnline}, Approved: ${p.approvalStatus}`);
  });

  // Step 2: Filter by specialties (same as backend logic)
  console.log("\n" + "=".repeat(80));
  console.log("STEP 2: Filtering by service specialties");
  console.log("=".repeat(80));

  if (serviceTypes.length > 0 || categories.length > 0) {
    const requestedSpecialties = await resolveRequestedSpecialtySets({
      categoryValues: categories,
      serviceTypeValues: serviceTypes,
    });

    console.log("\n📋 Requested Specialties:");
    console.log(`  Want Types: ${JSON.stringify(Array.from(requestedSpecialties.wantTypes))}`);
    console.log(`  Want Cats: ${JSON.stringify(Array.from(requestedSpecialties.wantCats))}`);

    console.log("\n🔍 Matching providers:");
    const beforeCount = providers.length;
    
    providers = providers.filter((provider) => {
      const matched = providerMatchesRequestedSpecialties(provider, requestedSpecialties);
      console.log(`  ${provider.name}: ${matched ? '✓ MATCHED' : '✗ NOT MATCHED'}`);
      return matched;
    });

    console.log(`\n📊 Filter Result: ${beforeCount} → ${providers.length} providers`);
  }

  // Step 3: Final result
  console.log("\n" + "=".repeat(80));
  console.log("STEP 3: Final Result");
  console.log("=".repeat(80));

  if (providers.length === 0) {
    console.log("\n❌ NO PROVIDERS AVAILABLE");
    console.log("   User will see: 'No providers available for the selected slot'");
  } else {
    console.log(`\n✅ ${providers.length} PROVIDERS AVAILABLE`);
    console.log("   User will see available time slots!");
    providers.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.name} (${p.phone})`);
    });
  }

  await mongoose.disconnect();
  console.log("\n✅ Test complete!");
  process.exit(0);
}

testAPIEndpoint().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
