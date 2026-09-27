import type { AreaHydratedDocument } from "@/lib/models/area.model";
import type { PoiHydratedDocument } from "@/lib/models/poi.model";
import type { TripHydratedDocument } from "@/lib/models/trip.model";
import type { PlanHydratedDocument } from "@/lib/models/plan.model";
import type { Area, PlanDocument, POI, Trip } from "@/types";

/** Mongoose docs carry ObjectIds/Dates that don't match the wire-facing
 * interfaces in `@/types` (which are pure JSON: strings all the way down).
 * These are the one bridge point per model, mirroring `toSafeUser`. */

export function toSafeArea(doc: AreaHydratedDocument): Area {
  const obj = doc.toObject();
  return {
    _id: doc._id.toString(),
    areaId: obj.areaId,
    name: obj.name,
    region: obj.region,
    imageUrl: obj.imageUrl,
    advisorySummary: obj.advisorySummary,
  };
}

export function toSafePoi(doc: PoiHydratedDocument): POI {
  const obj = doc.toObject();
  return {
    _id: doc._id.toString(),
    poiId: obj.poiId,
    name: obj.name,
    description: obj.description,
    category: obj.category,
    tags: obj.tags,
    activityType: obj.activityType,
    location: obj.location,
    geo: obj.geo,
    locationKey: obj.locationKey,
    areaId: obj.areaId ? String(obj.areaId) : undefined,
    imageUrl: obj.imageUrl,
    openingHours: obj.openingHours,
    typicalDwellMin: obj.typicalDwellMin,
    indoorOutdoor: obj.indoorOutdoor,
    groupSuitability: obj.groupSuitability,
    accessibilityAttributes: obj.accessibilityAttributes,
    cost: obj.cost,
    bookable: obj.bookable
      ? {
          vendorId: obj.bookable.vendorId ? String(obj.bookable.vendorId) : "",
          pricePerHead: obj.bookable.pricePerHead,
          durationMin: obj.bookable.durationMin,
          capacityLeft: obj.bookable.capacityLeft,
        }
      : undefined,
    crowdProfile: obj.crowdProfile,
    advisoryNotes: obj.advisoryNotes,
    reviewCount: obj.reviewCount,
    ratingAvg: obj.ratingAvg,
    trustScore: obj.trustScore,
    trustMeta: obj.trustMeta,
    computedQualityScore: obj.computedQualityScore,
    source: obj.source,
    createdAt: obj.createdAt?.toISOString?.() ?? obj.createdAt,
    updatedAt: obj.updatedAt?.toISOString?.() ?? obj.updatedAt,
  };
}

export function toSafeTrip(doc: TripHydratedDocument): Trip {
  const obj = doc.toObject();
  return {
    _id: doc._id.toString(),
    tripId: obj.tripId,
    userId: String(obj.userId),
    title: obj.title,
    code: obj.code,
    destination: obj.destination,
    coverImageUrl: obj.coverImageUrl,
    route: obj.route ?? [],
    startDate: obj.startDate,
    endDate: obj.endDate,
    groupType: obj.groupType,
    group: obj.group,
    themeTags: obj.themeTags ?? [],
    totalBudget: obj.totalBudget,
    totalSpent: obj.totalSpent,
    currency: obj.currency,
    payments: obj.payments,
    status: obj.status,
    liveState: obj.liveState,
    coordinator: obj.coordinator,
    checklist: obj.checklist ?? [],
    risks: obj.risks ?? [],
    changes: obj.changes ?? [],
    timeline: obj.timeline ?? [],
    postTripSummary: obj.postTripSummary,
    createdAt: obj.createdAt?.toISOString?.() ?? obj.createdAt,
    updatedAt: obj.updatedAt?.toISOString?.() ?? obj.updatedAt,
  };
}

export function toSafePlan(doc: PlanHydratedDocument): PlanDocument {
  const obj = doc.toObject();
  return {
    _id: doc._id.toString(),
    planId: obj.planId,
    tripId: String(obj.tripId),
    userId: String(obj.userId),
    version: obj.version,
    parentPlanId: obj.parentPlanId,
    status: obj.status,
    days: obj.days ?? [],
    totalCost: obj.totalCost,
    narrative: obj.narrative,
    changeReason: obj.changeReason,
    alternatives: obj.alternatives ?? [],
    conflicts: obj.conflicts ?? [],
    notes: obj.notes ?? [],
    chatHistory: obj.chatHistory ?? [],
    createdAt: obj.createdAt?.toISOString?.() ?? obj.createdAt,
    modifiedAt: obj.modifiedAt?.toISOString?.() ?? obj.modifiedAt,
  };
}
