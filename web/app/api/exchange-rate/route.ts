import { NextResponse } from "next/server";
import { z } from "zod";

import { isSupportedCurrency } from "@/lib/money";
import { ActionFailure, requireActionUser, requireMembership } from "@/lib/server/authz";
import { lookupExchangeRate } from "@/lib/server/exchange-rate";

const currency = z.string().length(3).toUpperCase().refine(isSupportedCurrency);
const querySchema = z.object({
  groupId: z.string().min(1).max(64),
  from: currency,
  to: currency
});
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ message: "Choose valid currencies and a group." }, { status: 400, headers });
  try {
    const user = await requireActionUser();
    await requireMembership(parsed.data.groupId, user.id);
  } catch (error) {
    if (error instanceof ActionFailure) return NextResponse.json({ message: error.message }, { status: 403, headers });
    console.error("Exchange-rate access check failed", error);
    return NextResponse.json({ message: "Unable to check your access. Try again." }, { status: 503, headers });
  }
  try {
    return NextResponse.json(await lookupExchangeRate(parsed.data.from, parsed.data.to), { headers });
  } catch {
    return NextResponse.json({ message: "An automatic rate is unavailable. Enter the exchange rate from your bank or payment receipt." }, { status: 503, headers });
  }
}
