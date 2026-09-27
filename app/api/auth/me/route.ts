import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { UserModel } from "@/lib/models/user.model";
import { getSessionFromCookies, toSafeUser } from "@/lib/auth/session";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  await connectToDatabase();
  const user = await UserModel.findById(session.sub);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  return NextResponse.json({ user: toSafeUser(user) });
}
