import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionFromCookies } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { UserModel } from "@/lib/models/user.model";
import { AppShell } from "@/components/shell";

export default async function AppTabsLayout({ children }: { children: ReactNode }) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/auth/login");

  await connectToDatabase();
  const user = await UserModel.findById(session.sub);
  if (!user) redirect("/auth/login");

  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return <AppShell userInitials={initials}>{children}</AppShell>;
}
