import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { analyzePhotoBuffer } from "@/lib/photo-analysis";

const bodySchema = z.object({
  geminiApiKey: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const photo = await prisma.userPhoto.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "не найдено" }, { status: 404 });

  const diskPath = path.join(process.cwd(), "public", "uploads", photo.filename);
  const buffer = await readFile(diskPath);

  const analysis = await analyzePhotoBuffer(buffer, photo.mimeType, {
    geminiApiKey: parsed.data.geminiApiKey,
  });

  const ok = analysis.subjectCount === 1 && !analysis.inputWarnings.includes("multiple_or_zero_subjects");
  await prisma.userPhoto.update({
    where: { id },
    data: { status: ok ? "OK" : "REJECTED" },
  });

  const row = await prisma.photoAnalysis.create({
    data: {
      userPhotoId: id,
      subjectCount: analysis.subjectCount,
      genderPresentation: analysis.genderPresentation,
      faceCoverage: analysis.faceCoverage,
      poseSummary: analysis.poseSummary,
      expressionSummary: analysis.expressionSummary,
      warnings: analysis.inputWarnings,
      fullAnalysis: JSON.parse(JSON.stringify(analysis.fullAnalysis)),
    },
  });

  return NextResponse.json({ analysis: row, normalized: analysis });
}
