import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { analyzeFandomFreeform, slugifyAscii } from "@/lib/fandom-analysis";

export async function GET() {
  const rows = await prisma.fandom.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { scenes: true } } },
  });
  return NextResponse.json(rows);
}

const structuredSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  canonSummary: z.string().min(1),
  visualStyleNotes: z.string().optional(),
});

const freeformSchema = z.object({
  freeform: z.string().min(5, "Коротко опишите фандом (от 5 символов)"),
  geminiApiKey: z.string().min(1, "Нужен ключ Gemini"),
});

async function uniqueSlug(base: string): Promise<string> {
  let s = base.slice(0, 64);
  let n = 0;
  for (;;) {
    const exists = await prisma.fandom.findUnique({ where: { slug: s } });
    if (!exists) return s;
    n += 1;
    s = `${slugifyAscii(base).slice(0, 48)}-${n}`;
  }
}

export async function POST(req: Request) {
  const json = await req.json();

  if (json != null && typeof json === "object" && "freeform" in json) {
    const parsed = freeformSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    try {
      const analyzed = await analyzeFandomFreeform(parsed.data.freeform, {
        geminiApiKey: parsed.data.geminiApiKey,
      });
      const slug = await uniqueSlug(analyzed.slug);
      const row = await prisma.fandom.create({
        data: {
          slug,
          title: analyzed.title,
          canonSummary: analyzed.canonSummary,
          visualStyleNotes: analyzed.visualStyleNotes ?? null,
          freeformSource: parsed.data.freeform,
        },
      });
      return NextResponse.json(row);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ошибка анализа фандома";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const parsed = structuredSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const row = await prisma.fandom.create({ data: parsed.data });
  return NextResponse.json(row);
}
