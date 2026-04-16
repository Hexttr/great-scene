import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await prisma.generationRun.findUnique({
    where: { id },
    include: {
      assets: true,
      fandom: true,
      scene: true,
      reviews: true,
      userPhoto: true,
    },
  });
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    ...run,
    userPhoto: { ...run.userPhoto, url: `/uploads/${run.userPhoto.filename}` },
  });
}
