import mongoose from "mongoose";
import ProviderAccount from "./src/models/ProviderAccount.js";
import { providerMatchesRequestedSpecialties, resolveRequestedSpecialtySets } from "./src/lib/serviceMatching.js";
import { MONGO_URI, MONGO_DB } from "./src/config.js";

async function testFix() {
  const uri = MONGO_URI.includes('?') ? MONGO_URI.replace('?', `${MONGO_DB || 'swm'}?`) : `${MONGO_URI}/${MONGO_DB || 'swm'}`;
  console.log("🔌 Connecting to database...\n");
  await mongoose.connect(uri);

  console.log("=".repeat(80));
  console.log("🧪 TESTING FIX: Provider Matching Logic");
  console.log("=".repeat(80));

  // Get provider with data in documents
  const provider = await ProviderAccount.findOne({ 
    phone: "9200000003" 
  }).lean();

  if (!provider) {
    console.log("❌ Provider not found!");
    process.exit(1);
  }

  console.log("\n📋 Provider Data:");
  console.log(`  Name: ${provider.name}`);
  console.log(`  Phone: ${provider.phone}`);
  console.log(`  Approval Status: ${provider.approvalStatus}`);
  console.log(`  Is Online: ${provider.isOnline}`);
  console.log("\n📦 Data Location Check:");
  console.log(`  Root Level Categories: ${JSON.stringify(provider.categories || 'undefined')}`);
  console.log(`  Root Level Service Types: ${JSON.stringify(provider.serviceTypes || 'undefined')}`);
  console.log(`  Documents.primaryCategory: ${JSON.stringify(provider.documents?.primaryCategory?.slice(0, 3) || 'undefined')}...`);
  console.log(`  Documents.specializations: ${JSON.stringify(provider.documents?.specializations?.slice(0, 3) || 'undefined')}...`);
  console.log(`  Documents.services: ${JSON.stringify(provider.documents?.services?.slice(0, 3) || 'undefined')}...`);

  // Test Case 1: Hair services
  console.log("\n" + "=".repeat(80));
  console.log("🧪 TEST CASE 1: User books Hair services");
  console.log("=".repeat(80));
  
  const requestedSpecialties1 = await resolveRequestedSpecialtySets({
    serviceTypeValues: ["hair"],
    categoryValues: ["hair-spa", "haircut", "hair-styling"]
  });

  console.log("\n📝 Requested Specialties:");
  console.log(`  Service Types: ${JSON.stringify(Array.from(requestedSpecialties1.wantTypes))}`);
  console.log(`  Categories: ${JSON.stringify(Array.from(requestedSpecialties1.wantCats))}`);

  const matched1 = providerMatchesRequestedSpecialties(provider, requestedSpecialties1);
  console.log(`\n✅ Match Result: ${matched1 ? '✓ MATCHED' : '✗ NOT MATCHED'}`);

  if (matched1) {
    console.log("🎉 SUCCESS! Provider is now discoverable for hair services!");
  } else {
    console.log("❌ FAILED! Provider still not matching.");
  }

  // Test Case 2: Skin services
  console.log("\n" + "=".repeat(80));
  console.log("🧪 TEST CASE 2: User books Skin services");
  console.log("=".repeat(80));
  
  const requestedSpecialties2 = await resolveRequestedSpecialtySets({
    serviceTypeValues: ["skin"],
    categoryValues: ["facial", "cleanup", "waxing"]
  });

  console.log("\n📝 Requested Specialties:");
  console.log(`  Service Types: ${JSON.stringify(Array.from(requestedSpecialties2.wantTypes))}`);
  console.log(`  Categories: ${JSON.stringify(Array.from(requestedSpecialties2.wantCats))}`);

  const matched2 = providerMatchesRequestedSpecialties(provider, requestedSpecialties2);
  console.log(`\n✅ Match Result: ${matched2 ? '✓ MATCHED' : '✗ NOT MATCHED'}`);

  if (matched2) {
    console.log("🎉 SUCCESS! Provider is now discoverable for skin services!");
  } else {
    console.log("❌ FAILED! Provider still not matching.");
  }

  // Test Case 3: Makeup services
  console.log("\n" + "=".repeat(80));
  console.log("🧪 TEST CASE 3: User books Makeup services");
  console.log("=".repeat(80));
  
  const requestedSpecialties3 = await resolveRequestedSpecialtySets({
    serviceTypeValues: ["makeup"],
    categoryValues: ["bridal-makeup", "party-makeup"]
  });

  console.log("\n📝 Requested Specialties:");
  console.log(`  Service Types: ${JSON.stringify(Array.from(requestedSpecialties3.wantTypes))}`);
  console.log(`  Categories: ${JSON.stringify(Array.from(requestedSpecialties3.wantCats))}`);

  const matched3 = providerMatchesRequestedSpecialties(provider, requestedSpecialties3);
  console.log(`\n✅ Match Result: ${matched3 ? '✓ MATCHED' : '✗ NOT MATCHED'}`);

  if (matched3) {
    console.log("🎉 SUCCESS! Provider is now discoverable for makeup services!");
  } else {
    console.log("❌ FAILED! Provider still not matching.");
  }

  // Test all approved & online providers
  console.log("\n" + "=".repeat(80));
  console.log("🧪 TEST CASE 4: All Approved & Online Providers in Indore");
  console.log("=".repeat(80));

  const allProviders = await ProviderAccount.find({
    city: /indore/i,
    approvalStatus: "approved",
    isOnline: true
  }).lean();

  console.log(`\nTotal Approved & Online Providers: ${allProviders.length}`);

  const requestedSpecialties4 = await resolveRequestedSpecialtySets({
    serviceTypeValues: ["hair"],
    categoryValues: ["hair-spa", "haircut"]
  });

  let matchedCount = 0;
  allProviders.forEach((p, idx) => {
    const matched = providerMatchesRequestedSpecialties(p, requestedSpecialties4);
    console.log(`\n  Provider #${idx + 1}: ${p.name} (${p.phone})`);
    console.log(`    Match: ${matched ? '✓ YES' : '✗ NO'}`);
    if (matched) matchedCount++;
  });

  console.log(`\n📊 Summary: ${matchedCount}/${allProviders.length} providers matched for hair services`);

  if (matchedCount > 0) {
    console.log("\n🎉 FIX SUCCESSFUL! Providers are now discoverable!");
  } else {
    console.log("\n❌ FIX FAILED! No providers matched.");
  }

  await mongoose.disconnect();
  console.log("\n✅ Test complete!");
  process.exit(0);
}

testFix().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
