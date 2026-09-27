import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/db/mongoose";
import { UserModel } from "@/lib/models/user.model";
import { exchangeGoogleCode, fetchGoogleUserInfo } from "@/lib/auth/google";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { uploadAvatarFromUrl } from "@/lib/imagekit";

const STATE_COOKIE = "toure_oauth_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (oauthError || !code || !state || state !== expectedState) {
    return NextResponse.redirect(`${origin}/auth/login?error=google_auth_failed`);
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const profile = await fetchGoogleUserInfo(tokens.access_token);

    await connectToDatabase();

    const now = new Date().toISOString();
    let user = await UserModel.findOne({
      "auth.linkedAccounts": {
        $elemMatch: { provider: "google", providerAccountId: profile.sub },
      },
    });

    if (!user) {
      user = await UserModel.findOne({ email: profile.email.toLowerCase() });
      if (user) {
        user.auth.linkedAccounts.push({
          provider: "google",
          providerAccountId: profile.sub,
          linkedAt: now,
        });
      }
    }

    if (!user) {
      user = new UserModel({
        name: profile.name || profile.email,
        email: profile.email.toLowerCase(),
        auth: {
          linkedAccounts: [{ provider: "google", providerAccountId: profile.sub, linkedAt: now }],
          emailVerified: profile.email_verified,
          lastLoginAt: now,
        },
      });
    } else {
      user.auth.lastLoginAt = now;
      if (profile.email_verified) user.auth.emailVerified = true;
    }

    if (profile.picture && !user.avatarImageKitFileId) {
      try {
        const uploaded = await uploadAvatarFromUrl(profile.picture, user._id.toString());
        user.avatarUrl = uploaded.url;
        user.avatarImageKitFileId = uploaded.fileId;
      } catch (avatarError) {
        console.error("Avatar upload to ImageKit failed, continuing without it:", avatarError);
      }
    }

    await user.save();

    const token = await createSessionToken({ sub: user._id.toString(), email: user.email });
    await setSessionCookie(token);

    return NextResponse.redirect(`${origin}/discover`);
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    return NextResponse.redirect(`${origin}/auth/login?error=google_auth_failed`);
  }
}
