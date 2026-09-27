#!/usr/bin/env node
/**
 * Loads the curated multi-city catalog (scripts/catalog.json) into MongoDB:
 * 12 destinations, ~150 bookable experiences with real prices, ratings, opening
 * hours and coordinates, and hotels in four tiers per city.
 *
 * Idempotent: everything is upserted by a stable key, so it is safe to run twice.
 * It only ever adds or updates catalog documents, it never deletes anything.
 *
 *   node scripts/seed-catalog.mjs            # uses MONGODB_URI from .env.local
 *   node scripts/seed-catalog.mjs --dry-run  # prints what it would do
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mongoose from "mongoose";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dry = process.argv.includes("--dry-run");

function loadEnv(file) {
  const env = {};
  try {
    for (const line of readFileSync(join(root, file), "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0 && !line.trimStart().startsWith("#")) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* file optional */ }
  return env;
}

const env = { ...loadEnv(".env.local"), ...process.env };
if (!env.MONGODB_URI) throw new Error("MONGODB_URI is not set (.env.local)");

const catalog = JSON.parse(readFileSync(join(root, "scripts", "catalog.json"), "utf8"));
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Coarse activity type the planner's dwell table understands. */
const ACTIVITY_TYPE = {
  heritage: "museum", museum: "museum", viewpoint: "sightseeing", nature: "leisure", wildlife: "adventure", adventure: "adventure",
  food: "food", shopping: "shopping", workshop: "workshop", performance: "entertainment", religious: "spiritual", relaxation: "leisure",
};

const openingHours = (open, close, closedDays) =>
  Object.fromEntries(DAYS.map((d, i) => [d, closedDays.includes(i) ? "closed" : `${open}-${close}`]));

const now = new Date();

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  console.log(`database: ${db.databaseName}${dry ? "  (dry run, nothing will be written)" : ""}`);

  // ---- areas
  const areaOps = catalog.destinations.map((d) => ({
    updateOne: {
      filter: { areaId: d.key },
      update: {
        $set: {
          name: d.name, region: d.region, imageUrl: d.imageUrl, location: { lat: d.lat, lng: d.lng }, tagline: d.tagline,
          description: d.description, tags: d.tags, idealNights: d.idealNights, bestMonths: d.bestMonths, hasAirport: d.airport, hasRail: d.rail,
        },
        $setOnInsert: { areaId: d.key },
      },
      upsert: true,
    },
  }));
  if (!dry) await db.collection("areas").bulkWrite(areaOps);
  const areas = dry ? [] : await db.collection("areas").find({ areaId: { $in: catalog.destinations.map((d) => d.key) } }).toArray();
  const areaByKey = new Map(areas.map((a) => [a.areaId, a]));
  const imgByKey = new Map(catalog.destinations.map((d) => [d.key, d.imageUrl]));

  // ---- pois
  const poiOps = catalog.activities.map((a) => {
    const poiId = `c_${a.dest}_${slug(a.title)}`;
    const a2 = a.attrs;
    const [h1, m1] = a.open.split(":").map(Number);
    const [h2, m2] = a.close.split(":").map(Number);
    const window = h2 * 60 + m2 - (h1 * 60 + m1);
    return {
      updateOne: {
        filter: { poiId },
        update: {
          $set: {
            name: a.title, description: a.description, category: a2.category, tags: a.tags,
            activityType: ACTIVITY_TYPE[a2.category] ?? "sightseeing",
            location: { lat: a.lat, lng: a.lng }, geo: { type: "Point", coordinates: [a.lng, a.lat] },
            areaId: areaByKey.get(a.dest)?._id, locationKey: a.dest, imageUrl: imgByKey.get(a.dest),
            openingHours: openingHours(a.open, a.close, a.closedWeekdays),
            typicalDwellMin: { min: Math.round(a.durationMin * 0.7), typical: a.durationMin, max: Math.round(a.durationMin * 1.4) },
            indoorOutdoor: a.indoorOutdoor,
            groupSuitability: a.kidFriendly ? ["solo", "couple", "family", "large_group"] : ["solo", "couple", "large_group"],
            accessibilityAttributes: { step_free: a.stepFree, seating_available: a2.seating >= 0.3, restroom_onsite: false, sensory_friendly: false },
            cost: { min_expected_spend: a.price, typical_spend: a.price, currency: "INR" },
            bookable: a.price > 0 ? { pricePerHead: a.price, durationMin: a.durationMin, capacityLeft: 12 } : undefined,
            crowdProfile: [], advisoryNotes: [],
            reviewCount: a.ratingCount, ratingAvg: a.rating, trustScore: a.rating / 5, trustMeta: {},
            attrs: { ...a2, kidFriendly: a.kidFriendly, closedWeekdays: a.closedWeekdays, openMin: h1 * 60 + m1, openWindowMin: window },
            vendorName: a.vendor, source: "seed", updatedAt: now,
          },
          $setOnInsert: { poiId, createdAt: now },
        },
        upsert: true,
      },
    };
  });
  if (!dry) await db.collection("pois").bulkWrite(poiOps);

  // ---- hotels
  const hotelOps = catalog.hotels.map((h) => ({
    updateOne: {
      filter: { areaKey: h.dest, tier: h.tier },
      update: { $set: { areaId: areaByKey.get(h.dest)?._id, name: h.name, pricePerNight: h.price, rating: h.rating } },
      upsert: true,
    },
  }));
  if (!dry) await db.collection("hotels").bulkWrite(hotelOps);

  console.log(`areas: ${areaOps.length}   experiences: ${poiOps.length}   hotels: ${hotelOps.length}`);
  if (!dry) {
    for (const c of ["areas", "pois", "hotels"]) console.log(`  ${c.padEnd(8)} now holds ${await db.collection(c).countDocuments()} documents`);
    await db.collection("pois").createIndex({ geo: "2dsphere" }).catch(() => {});
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
