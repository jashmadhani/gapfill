import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { UserModel } from "@/lib/models/user.model";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie, toSafeUser } from "@/lib/auth/session";
import { registerSchema } from "@/lib/auth/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  await connectToDatabase();

  const existing = await UserModel.findOne({ email }).lean();
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const user = await UserModel.create({
    name,
    email,
    auth: {
      passwordHash,
      linkedAccounts: [],
      emailVerified: false,
      lastLoginAt: now,
    },
  });

  const token = await createSessionToken({ sub: user._id.toString(), email: user.email });
  await setSessionCookie(token);

  return NextResponse.json({ user: toSafeUser(user) }, { status: 201 });
}
