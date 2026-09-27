import { connectToDatabase } from "@/lib/db/mongoose";
import { AreaModel } from "@/lib/models/area.model";
import { PoiModel } from "@/lib/models/poi.model";
import { TripModel, type TripHydratedDocument } from "@/lib/models/trip.model";
import { PlanModel } from "@/lib/models/plan.model";
import type { EventCard } from "@/types";

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

/** Small, original demo catalog in the same Rajasthan/Golden-Triangle flavor
 * as the reference app - just enough real, queryable Mongo data to make
 * Discover/Plan/Trip feel alive instead of empty states everywhere. */
const AREAS = [
  { areaId: "udaipur", name: "Udaipur", region: "Rajasthan", imageUrl: img("photo-1477587458883-47145ed94245") },
  { areaId: "jaipur", name: "Jaipur", region: "Rajasthan", imageUrl: img("photo-1599661046289-e31897846e41") },
  { areaId: "jodhpur", name: "Jodhpur", region: "Rajasthan", imageUrl: img("photo-1602216056096-3b40cc0c9944") },
  { areaId: "jaisalmer", name: "Jaisalmer", region: "Rajasthan", imageUrl: img("photo-1524492412937-b28074a5d7da") },
  { areaId: "pushkar", name: "Pushkar", region: "Rajasthan", imageUrl: img("photo-1587474260584-136574528ed5") },
  { areaId: "agra", name: "Agra", region: "Uttar Pradesh", imageUrl: img("photo-1548013146-72479768bada") },
];

const POIS: Array<{
  poiId: string;
  areaId: string;
  name: string;
  description: string;
  tags: string[];
  activityType: string;
  durationMin: number;
  price: number;
  rating: number;
  reviewCount: number;
  indoorOutdoor: "indoor" | "outdoor" | "mixed";
  imageUrl: string;
}> = [
  { poiId: "p_city_palace", areaId: "udaipur", name: "City Palace heritage walk", description: "A guided walk through courtyards, mirrored halls and lake views.", tags: ["heritage", "culture"], activityType: "museum", durationMin: 120, price: 900, rating: 4.7, reviewCount: 812, indoorOutdoor: "mixed", imageUrl: img("photo-1524230507669-5ff97982bb5e") },
  { poiId: "p_lake_pichola_boat", areaId: "udaipur", name: "Lake Pichola sunset boat ride", description: "A slow boat past the Lake Palace as the sky turns gold.", tags: ["relaxation", "photography"], activityType: "boat", durationMin: 60, price: 600, rating: 4.8, reviewCount: 1204, indoorOutdoor: "outdoor", imageUrl: img("photo-1587474260584-136574528ed5") },
  { poiId: "p_rooftop_thali", areaId: "udaipur", name: "Rooftop Rajasthani thali", description: "Unlimited traditional thali with a lake-facing rooftop seat.", tags: ["food"], activityType: "food", durationMin: 90, price: 450, rating: 4.5, reviewCount: 530, indoorOutdoor: "outdoor", imageUrl: img("photo-1543353071-873f17a7a088") },
  { poiId: "p_amber_fort", areaId: "jaipur", name: "Amber Fort at sunrise", description: "Beat the crowds with an early-entry guided fort tour.", tags: ["heritage"], activityType: "museum", durationMin: 150, price: 1100, rating: 4.9, reviewCount: 2031, indoorOutdoor: "outdoor", imageUrl: img("photo-1599661046289-e31897846e41") },
  { poiId: "p_hawa_mahal", areaId: "jaipur", name: "Hawa Mahal & old city bazaars", description: "Photograph the Palace of Winds then wander the pink city's lanes.", tags: ["heritage", "shopping"], activityType: "walk", durationMin: 100, price: 350, rating: 4.4, reviewCount: 968, indoorOutdoor: "outdoor", imageUrl: img("photo-1477587458883-47145ed94245") },
  { poiId: "p_cooking_class_jaipur", areaId: "jaipur", name: "Home-kitchen cooking class", description: "Learn dal baati churma from a local family, then eat what you make.", tags: ["food", "workshop"], activityType: "workshop", durationMin: 180, price: 1300, rating: 4.9, reviewCount: 402, indoorOutdoor: "indoor", imageUrl: img("photo-1604908176997-125f25cc6f3d") },
  { poiId: "p_mehrangarh", areaId: "jodhpur", name: "Mehrangarh Fort audio tour", description: "One of India's largest forts, towering over the blue city.", tags: ["heritage", "photography"], activityType: "museum", durationMin: 130, price: 950, rating: 4.8, reviewCount: 1540, indoorOutdoor: "mixed", imageUrl: img("photo-1602216056096-3b40cc0c9944") },
  { poiId: "p_blue_city_walk", areaId: "jodhpur", name: "Blue city rooftop walk", description: "Wind through indigo-washed lanes ending at a rooftop cafe.", tags: ["culture", "photography"], activityType: "walk", durationMin: 90, price: 500, rating: 4.6, reviewCount: 340, indoorOutdoor: "outdoor", imageUrl: img("photo-1477587458883-47145ed94245") },
  { poiId: "p_desert_camp", areaId: "jaisalmer", name: "Sam Dunes camel safari & camp", description: "Camel ride into the dunes, folk music and a night under the stars.", tags: ["adventure", "nature"], activityType: "adventure", durationMin: 300, price: 2400, rating: 4.7, reviewCount: 690, indoorOutdoor: "outdoor", imageUrl: img("photo-1524492412937-b28074a5d7da") },
  { poiId: "p_jaisalmer_fort", areaId: "jaisalmer", name: "Living fort & havelis tour", description: "A fort city still lived in, with carved sandstone havelis.", tags: ["heritage"], activityType: "museum", durationMin: 110, price: 700, rating: 4.6, reviewCount: 455, indoorOutdoor: "mixed", imageUrl: img("photo-1524492412937-b28074a5d7da") },
  { poiId: "p_pushkar_lake", areaId: "pushkar", name: "Pushkar Lake ghats at dawn", description: "A quiet aarti at the ghats before the town wakes up.", tags: ["spiritual", "culture"], activityType: "walk", durationMin: 60, price: 0, rating: 4.6, reviewCount: 300, indoorOutdoor: "outdoor", imageUrl: img("photo-1587474260584-136574528ed5") },
  { poiId: "p_taj_mahal", areaId: "agra", name: "Taj Mahal sunrise entry", description: "Skip-the-line sunrise slot with a certified guide.", tags: ["heritage", "photography"], activityType: "museum", durationMin: 150, price: 1600, rating: 4.9, reviewCount: 3021, indoorOutdoor: "outdoor", imageUrl: img("photo-1548013146-72479768bada") },
];

function toGeoPoint(seed: number) {
  return { lat: 24 + (seed % 7), lng: 73 + (seed % 5) };
}

export async function ensureSeedData() {
  await connectToDatabase();
  const areaCount = await AreaModel.countDocuments();
  if (areaCount === 0) {
    await AreaModel.insertMany(AREAS);
  }
  const poiCount = await PoiModel.countDocuments();
  if (poiCount === 0) {
    const areas = await AreaModel.find();
    const areaIdByKey = new Map(areas.map((a) => [a.areaId, a._id]));
    await PoiModel.insertMany(
      POIS.map((p, i) => ({
        poiId: p.poiId,
        name: p.name,
        description: p.description,
        category: p.tags[0] ?? "experience",
        tags: p.tags,
        activityType: p.activityType,
        location: toGeoPoint(i),
        geo: { type: "Point" as const, coordinates: [73 + (i % 5), 24 + (i % 7)] as [number, number] },
        areaId: areaIdByKey.get(p.areaId),
        imageUrl: p.imageUrl,
        openingHours: { monday: "09:00-18:00", tuesday: "09:00-18:00", wednesday: "09:00-18:00", thursday: "09:00-18:00", friday: "09:00-18:00", saturday: "09:00-18:00", sunday: "09:00-18:00" },
        typicalDwellMin: { min: Math.round(p.durationMin * 0.7), typical: p.durationMin, max: Math.round(p.durationMin * 1.4) },
        indoorOutdoor: p.indoorOutdoor,
        groupSuitability: ["solo", "couple", "family", "large_group"],
        accessibilityAttributes: { step_free: i % 3 === 0, seating_available: true, restroom_onsite: i % 2 === 0, sensory_friendly: false },
        cost: { min_expected_spend: p.price, typical_spend: p.price, currency: "INR" },
        bookable: p.price > 0 ? { vendorId: undefined, pricePerHead: p.price, durationMin: p.durationMin, capacityLeft: 12 } : undefined,
        crowdProfile: [],
        advisoryNotes: [],
        reviewCount: p.reviewCount,
        ratingAvg: p.rating,
        trustScore: p.rating / 5,
        trustMeta: {},
        source: "seed" as const,
      }))
    );
  }
}

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function timeOnDay(dateIso: string, hhmm: string) {
  return `${dateIso}T${hhmm}:00.000Z`;
}

/** Builds one demo trip + its active plan for a user who has none yet, so
 * Trip/Plan/Ask never open to a cold, empty state on first login. Mirrors
 * the shape gapfill's seeded single tour has, but as real Mongo documents
 * scoped to this user. */
export async function ensureDemoTripForUser(userId: string): Promise<TripHydratedDocument> {
  await connectToDatabase();
  await ensureSeedData();
  const existing = await TripModel.findOne({ userId }).sort({ createdAt: -1 });
  if (existing) return existing;

  const udaipur = await PoiModel.find({ areaId: (await AreaModel.findOne({ areaId: "udaipur" }))?._id });
  const jaipur = await PoiModel.find({ areaId: (await AreaModel.findOne({ areaId: "jaipur" }))?._id });

  const today = new Date().toISOString().slice(0, 10);
  const startDate = addDays(today, -1); // trip already under way, for a lively Trip-tab demo
  const endDate = addDays(startDate, 4);

  const trip = await TripModel.create({
    tripId: `trip_${Date.now()}`,
    userId,
    title: "Udaipur & Jaipur, 5 days",
    code: `TC-${Math.floor(1000 + Math.random() * 9000)}`,
    destination: "Rajasthan",
    coverImageUrl: udaipur[0]?.imageUrl,
    route: [
      { areaId: "udaipur", name: "Udaipur", nights: 2, fromDate: startDate },
      { areaId: "jaipur", name: "Jaipur", nights: 2, fromDate: addDays(startDate, 2) },
    ],
    startDate,
    endDate,
    groupType: "couple",
    group: { adults: 2, children: 0, members: [{ name: "You" }, { name: "Partner" }] },
    themeTags: ["heritage", "food"],
    totalBudget: 60000,
    totalSpent: 18500,
    currency: "INR",
    payments: { total: 60000, paid: 45000, balance: 15000 },
    status: "active",
    liveState: {
      currentDayIndex: 1,
      currentTime: new Date().toISOString(),
      weatherBad: false,
      budgetRemaining: 41500,
    },
    coordinator: { name: "Meera Singh", phone: "+91 98290 11111", languages: ["English", "Hindi"] },
    checklist: [
      { key: "id_proof", label: "Carry a government ID for hotel check-ins", done: true },
      { key: "packing", label: "Pack for 8-30°C swing (early mornings are cold)", done: true },
      { key: "balance", label: "Pay remaining balance before day 3", done: false },
      { key: "sim", label: "Pick up a local SIM or eSIM", done: false },
    ],
    risks: [
      { kind: "weather", level: "low", text: "Light showers possible in Udaipur this afternoon.", itemId: "d1_boat" },
    ],
    changes: [],
    timeline: [],
  });

  const day1: EventCard[] = [
    { itemId: "d1_palace", type: "activity", startTime: timeOnDay(startDate, "09:00"), endTime: timeOnDay(startDate, "11:00"), durationMin: 120, poiId: udaipur.find((p) => p.poiId === "p_city_palace")?._id?.toString(), title: "City Palace heritage walk", activityType: "museum", minExpectedSpend: 900, typicalSpend: 900, fitReason: "Matches your heritage interest", accessibilityIcons: [], locked: false, status: "confirmed", booking: { bookingRef: "GF-772013", pricePaid: 1800, headCount: 2, bookedAt: new Date().toISOString() } },
    { itemId: "d1_lunch", type: "meal", startTime: timeOnDay(startDate, "13:00"), endTime: timeOnDay(startDate, "14:00"), durationMin: 60, title: "Lakeside thali lunch", activityType: "food", minExpectedSpend: 450, typicalSpend: 450, accessibilityIcons: [], locked: false, status: "confirmed" },
    { itemId: "d1_rest", type: "rest", startTime: timeOnDay(startDate, "15:30"), endTime: timeOnDay(startDate, "16:15"), durationMin: 45, title: "Rest at the hotel", activityType: "rest", minExpectedSpend: 0, typicalSpend: 0, fitReason: "Everyone's on their feet a lot this morning", accessibilityIcons: [], locked: true, status: "confirmed" },
    { itemId: "d1_boat", type: "activity", startTime: timeOnDay(startDate, "17:30"), endTime: timeOnDay(startDate, "18:30"), durationMin: 60, poiId: udaipur.find((p) => p.poiId === "p_lake_pichola_boat")?._id?.toString(), title: "Lake Pichola sunset boat ride", activityType: "boat", minExpectedSpend: 600, typicalSpend: 600, accessibilityIcons: [], locked: false, status: "confirmed", booking: { bookingRef: "GF-772014", pricePaid: 1200, headCount: 2, bookedAt: new Date().toISOString() } },
  ];
  const day2Date = addDays(startDate, 1);
  const day2: EventCard[] = [
    { itemId: "d2_breakfast", type: "meal", startTime: timeOnDay(day2Date, "08:30"), endTime: timeOnDay(day2Date, "09:15"), durationMin: 45, title: "Hotel breakfast", activityType: "food", minExpectedSpend: 0, typicalSpend: 0, accessibilityIcons: [], locked: true, status: "confirmed" },
    { itemId: "d2_travel", type: "travel", startTime: timeOnDay(day2Date, "10:00"), endTime: timeOnDay(day2Date, "15:00"), durationMin: 300, title: "Private car to Jaipur", activityType: "transfer", minExpectedSpend: 3200, typicalSpend: 3200, accessibilityIcons: [], locked: true, status: "confirmed" },
    { itemId: "d2_checkin", type: "accommodation", startTime: timeOnDay(day2Date, "15:30"), endTime: timeOnDay(day2Date, "16:00"), durationMin: 30, title: "Check in · Haveli Dharampura", activityType: "hotel", minExpectedSpend: 0, typicalSpend: 0, accessibilityIcons: [], locked: true, status: "confirmed" },
  ];
  const day3Date = addDays(startDate, 2);
  const day3: EventCard[] = [
    { itemId: "d3_amber", type: "activity", startTime: timeOnDay(day3Date, "06:30"), endTime: timeOnDay(day3Date, "09:00"), durationMin: 150, poiId: jaipur.find((p) => p.poiId === "p_amber_fort")?._id?.toString(), title: "Amber Fort at sunrise", activityType: "museum", minExpectedSpend: 1100, typicalSpend: 1100, accessibilityIcons: [], locked: false, status: "suggested" },
    { itemId: "d3_cooking", type: "activity", startTime: timeOnDay(day3Date, "18:00"), endTime: timeOnDay(day3Date, "21:00"), durationMin: 180, poiId: jaipur.find((p) => p.poiId === "p_cooking_class_jaipur")?._id?.toString(), title: "Home-kitchen cooking class", activityType: "workshop", minExpectedSpend: 1300, typicalSpend: 1300, accessibilityIcons: [], locked: false, status: "suggested" },
  ];
  const day4Date = addDays(startDate, 3);
  const day4: EventCard[] = [
    { itemId: "d4_hawa", type: "activity", startTime: timeOnDay(day4Date, "09:30"), endTime: timeOnDay(day4Date, "11:10"), durationMin: 100, poiId: jaipur.find((p) => p.poiId === "p_hawa_mahal")?._id?.toString(), title: "Hawa Mahal & old city bazaars", activityType: "walk", minExpectedSpend: 350, typicalSpend: 350, accessibilityIcons: [], locked: false, status: "suggested" },
  ];

  await PlanModel.create({
    planId: `plan_${Date.now()}`,
    tripId: trip._id,
    userId,
    version: 1,
    status: "active",
    days: [day1, day2, day3, day4],
    totalCost: 18500,
    narrative: "A relaxed 5-day loop: two heritage-and-food days in Udaipur, then Jaipur's forts and bazaars.",
    alternatives: [],
    conflicts: [
      { level: "warning", text: "Day 4 has no lunch stop planned yet." },
    ],
    notes: [
      "Kept mornings light after a late travel day into Jaipur.",
      "Grouped heritage sites together to avoid backtracking across town.",
    ],
    chatHistory: [
      { role: "assistant", text: "Hi! I'm your trip assistant. Ask me to swap something, check spend, or tell me your day changed and I'll adjust the plan.", at: new Date().toISOString() },
    ],
  });

  return trip;
}
