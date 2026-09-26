import { Id, ISODate, ISODateTime } from "./common";

/** Normalized out of POI (unlike trip-planner's embedded array) since review
 * volume is unbounded and independently authored/moderated over time. POI
 * keeps only the cached aggregate (reviewCount/ratingAvg/trustScore). */
export interface Review {
  _id: Id;
  poiId: Id; // ref -> POI
  authorUserId?: Id; // ref -> User; absent for seeded/imported reviews
  rating: number; // 1-5
  text: string;
  date: ISODate;
  createdAt: ISODateTime;
}
