import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureScenePool } from "@/lib/scene-generation";

const schema = z.object({
  fandomId: z.string(),
  geminiApiKey: z.string().min(1),
});

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await ensureScenePool(parsed.data.fandomId, parsed.data.geminiApiKey);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
