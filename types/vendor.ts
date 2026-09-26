import { Id, ISODateTime } from "./common";

export type VendorStatus = "open" | "closed" | "full";

/** Local, bookable-listing vendor (gapfill Vendor). Absent for globally-sourced
 * POIs that came from trip-planner's providers (Google Places/Wikimedia/etc). */
export interface Vendor {
  _id: Id;
  name: string;
  contactChannel: string; // e.g. "whatsapp:+91 98290 11111"
  status: VendorStatus;
  onboardingSource: "seed" | "self_signup" | "admin" | string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
