import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  similarityScore: z.number().int().min(1).max(5).optional().nullable(),
  cinematicScore: z.number().int().min(1).max(5).optional().nullable(),
  integrationScore: z.number().int().min(1).max(5).optional().nullable(),
  fandomFidelityScore: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const run = await prisma.generationRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  const review = await prisma.qualityReview.create({
    data: {
      generationRunId: id,
      ...parsed.data,
    },
  });
  return NextResponse.json(review);
}
