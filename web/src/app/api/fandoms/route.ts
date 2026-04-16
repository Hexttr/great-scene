import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.fandom.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { scenes: true } } },
  });
  return NextResponse.json(rows);
}

const createSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  canonSummary: z.string().min(1),
  visualStyleNotes: z.string().optional(),
});

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const row = await prisma.fandom.create({ data: parsed.data });
  return NextResponse.json(row);
}
