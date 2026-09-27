import { SignJWT, jwtVerify } from "jose";

/** Separate, narrow-purpose signing key from the browser session cookie
 * (AUTH_SECRET) - this token crosses a network boundary into a different
 * process (the Python agent service) and gets echoed back to call into
 * our own /api/agent/* routes, so it's kept short-lived (60s, one chat
 * turn's worth) and scoped with an audience claim rather than reusing the
 * 30-day session token. */
const AGENT_TOKEN_TTL_SECONDS = 60;
const AUDIENCE = "agent-service";

function agentSecretKey() {
  const secret = process.env.AGENT_SERVICE_SECRET;
  if (!secret) throw new Error("Missing AGENT_SERVICE_SECRET environment variable");
  return new TextEncoder().encode(secret);
}

export async function mintAgentServiceToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${AGENT_TOKEN_TTL_SECONDS}s`)
    .sign(agentSecretKey());
}

export async function verifyAgentServiceToken(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, agentSecretKey(), { audience: AUDIENCE });
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
