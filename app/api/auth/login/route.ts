import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { UserModel } from "@/lib/models/user.model";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie, toSafeUser } from "@/lib/auth/session";
import { loginSchema } from "@/lib/auth/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  await connectToDatabase();

  const user = await UserModel.findOne({ email }).select("+auth.passwordHash");
  if (!user || !user.auth.passwordHash) {
    return NextResponse.json(
      { error: "No account with that email and password. If you signed up with Google, use that instead." },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.auth.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  user.auth.lastLoginAt = new Date().toISOString();
  await user.save();

  const token = await createSessionToken({ sub: user._id.toString(), email: user.email });
  await setSessionCookie(token);

  return NextResponse.json({ user: toSafeUser(user) });
}
