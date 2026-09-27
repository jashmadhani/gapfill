import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { verifyAgentServiceToken } from "@/lib/auth/agent-jwt";
import { UserModel, type UserHydratedDocument } from "@/lib/models/user.model";
import type { User } from "@/types";

const SESSION_COOKIE = "toure_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing AUTH_SECRET environment variable");
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string; // User._id
  email: string;
  [key: string]: unknown;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** API-route helper: resolves the authenticated user's hydrated Mongoose doc,
 * or null if there is no valid session. Connects to the DB itself so routes
 * don't need to remember to call connectToDatabase() first.
 *
 * Pass the route's `req` to also accept the short-lived agent-service Bearer
 * token (see agent-jwt.ts) - the handful of /api/agent/* routes the Python
 * assistant calls back into use this same helper, so they don't need a
 * separate auth path. A present-but-invalid bearer token is rejected outright
 * rather than falling back to the cookie, since a caller presenting one is
 * asserting it's the agent service, not a browser. */
export async function requireUser(req?: NextRequest): Promise<UserHydratedDocument | null> {
  await connectToDatabase();

  const bearer = req?.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (bearer) {
    const agentSession = await verifyAgentServiceToken(bearer);
    return agentSession ? UserModel.findById(agentSession.sub) : null;
  }

  const session = await getSessionFromCookies();
  if (!session) return null;
  return UserModel.findById(session.sub);
}

/** Strips server-only fields (password hash, provider account ids) before a
 * user document is ever sent to the client. */
export function toSafeUser(doc: UserHydratedDocument): User {
  const obj = doc.toObject({ virtuals: false });
  return {
    _id: doc._id.toString(),
    email: obj.email,
    name: obj.name,
    homeCity: obj.homeCity ?? "",
    auth: {
      emailVerified: obj.auth?.emailVerified ?? false,
      linkedAccounts: (obj.auth?.linkedAccounts ?? []).map((a: { provider: string; linkedAt: string }) => ({
        provider: a.provider,
        providerAccountId: "", // never leaves the server
        linkedAt: a.linkedAt,
      })),
      lastLoginAt: obj.auth?.lastLoginAt,
    },
    preferences: obj.preferences,
    phoneNumber: obj.phoneNumber,
    lastKnownLocation: obj.lastKnownLocation,
    avatarUrl: obj.avatarUrl,
    tripIds: (obj.tripIds ?? []).map((id: unknown) => String(id)),
    savedPoiIds: obj.savedPoiIds ?? [],
    createdAt: obj.createdAt?.toISOString?.() ?? obj.createdAt,
    updatedAt: obj.updatedAt?.toISOString?.() ?? obj.updatedAt,
  };
}
