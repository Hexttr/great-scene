import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateLabWallet, mockTopUp } from "@/lib/billing/mock";

const schema = z.object({
  amountCents: z.number().int().positive(),
});

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const w = await getOrCreateLabWallet();
  const result = await mockTopUp(w.id, parsed.data.amountCents);
  return NextResponse.json(result);
}
