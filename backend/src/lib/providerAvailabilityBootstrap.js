import ProviderDayAvailability from "../models/ProviderDayAvailability.js";
import { DEFAULT_TIME_SLOTS } from "./slots.js";

function toIsoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function nextDates(days = 30, fromDate = new Date()) {
  const out = [];
  const safeDays = Math.max(Number(days || 0), 0);
  for (let i = 0; i < safeDays; i++) {
    const d = new Date(fromDate);
    d.setDate(fromDate.getDate() + i);
    out.push(toIsoDate(d));
  }
  return out;
}

export function getDefaultProviderSlots() {
  return [...DEFAULT_TIME_SLOTS];
}

export async function bootstrapProviderAvailability(providerId, opts = {}) {
  const id = String(providerId || "").trim();
  if (!id) return { created: 0, updated: 0, skipped: 0 };

  const days = Math.max(Number(opts.days || 30), 1);
  const dates = nextDates(days, opts.fromDate || new Date());
  const fullSlots = getDefaultProviderSlots();
  const overwriteSystemDocs = opts.overwriteSystemDocs === true;

  const existing = await ProviderDayAvailability.find({
    providerId: id,
    date: { $in: dates },
  }).lean();
  const byDate = new Map(existing.map((doc) => [String(doc.date), doc]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const date of dates) {
    const doc = byDate.get(date);
    if (!doc) {
      await ProviderDayAvailability.findOneAndUpdate(
        { providerId: id, date },
        {
          $set: {
            providerId: id,
            date,
            availableSlots: fullSlots,
            managedByProvider: false,
            source: "system_default",
          },
        },
        { upsert: true, new: false }
      );
      created++;
      continue;
    }

    const providerManaged = doc.managedByProvider === true;
    if (providerManaged) {
      skipped++;
      continue;
    }

    const hasSlots = Array.isArray(doc.availableSlots) && doc.availableSlots.length > 0;
    if (hasSlots && !overwriteSystemDocs) {
      skipped++;
      continue;
    }

    await ProviderDayAvailability.findOneAndUpdate(
      { providerId: id, date },
      {
        $set: {
          availableSlots: fullSlots,
          managedByProvider: false,
          source: "system_default",
        },
      },
      { new: false }
    );
    updated++;
  }

  return { created, updated, skipped };
}

