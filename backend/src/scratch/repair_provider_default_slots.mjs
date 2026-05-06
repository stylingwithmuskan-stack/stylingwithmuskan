import mongoose from "mongoose";
import dotenv from "dotenv";
import ProviderAccount from "../models/ProviderAccount.js";
import ProviderDayAvailability from "../models/ProviderDayAvailability.js";
import { bootstrapProviderAvailability } from "../lib/providerAvailabilityBootstrap.js";
import { invalidateProviderSlotsForNextDays } from "../lib/availability.js";

dotenv.config();

function parseArgs(argv = []) {
  const args = new Set(argv);
  const apply = args.has("--apply");
  const allApproved = args.has("--all-approved");
  const idsArg = argv.find((x) => x.startsWith("--provider-ids="));
  const providerIds = idsArg
    ? idsArg.split("=")[1].split(",").map((x) => x.trim()).filter(Boolean)
    : [];
  return { apply, allApproved, providerIds };
}

async function main() {
  const { apply, allApproved, providerIds } = parseArgs(process.argv.slice(2));
  if (!allApproved && providerIds.length === 0) {
    console.log("Usage:");
    console.log("  node src/scratch/repair_provider_default_slots.mjs --provider-ids=<id1,id2> [--apply]");
    console.log("  node src/scratch/repair_provider_default_slots.mjs --all-approved [--apply]");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB || "swm",
  });

  const query = allApproved
    ? { approvalStatus: "approved", registrationComplete: true }
    : { _id: { $in: providerIds } };

  const providers = await ProviderAccount.find(query).select("_id name approvalStatus registrationComplete").lean();
  console.log(`Matched providers: ${providers.length}`);
  if (!providers.length) {
    await mongoose.disconnect();
    return;
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  for (const provider of providers) {
    const providerId = String(provider._id);
    let result = { created: 0, updated: 0, skipped: 0 };
    if (apply) {
      result = await bootstrapProviderAvailability(providerId, {
        days: 30,
        overwriteSystemDocs: false,
      });
      await invalidateProviderSlotsForNextDays(providerId, 30);
    } else {
      const docs = await ProviderDayAvailability.find({
        providerId,
        date: { $in: dates },
      }).select("availableSlots managedByProvider").lean();
      const byDate = new Map(docs.map((d) => [String(d.date), d]));
      for (const date of dates) {
        const doc = byDate.get(date);
        if (!doc) {
          result.created++;
          continue;
        }
        if (doc.managedByProvider === true) {
          result.skipped++;
          continue;
        }
        if (!Array.isArray(doc.availableSlots) || doc.availableSlots.length === 0) {
          result.updated++;
        } else {
          result.skipped++;
        }
      }
    }

    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;

    console.log({
      providerId,
      name: provider.name,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      mode: apply ? "apply" : "dry-run",
    });

  }

  console.log("Summary:", {
    providers: providers.length,
    created: totalCreated,
    updated: totalUpdated,
    skipped: totalSkipped,
    mode: apply ? "apply" : "dry-run",
  });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[repair_provider_default_slots] failed:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
