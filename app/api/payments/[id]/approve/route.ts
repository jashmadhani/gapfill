import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { GateError, approve } from "@/lib/payments";
import { PaymentIntentModel } from "@/lib/models/payment-intent.model";

type Ctx = { params: Promise<{ id: string }> };

// Cookie session only (no request passed to requireUser): the assistant's token cannot reach this route.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const intent = await PaymentIntentModel.findOne({ intentId: id });
  if (!intent) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  const me = user._id.toString();
  try {
    return NextResponse.json(await approve(intent, me));

  } catch (e) {
    if (e instanceof GateError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
