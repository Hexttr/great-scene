import { NextResponse } from "next/server";
import { getOrCreateLabWallet } from "@/lib/billing/mock";

export async function GET() {
  const w = await getOrCreateLabWallet();
  return NextResponse.json(w);
}
