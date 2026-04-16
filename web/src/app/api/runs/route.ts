import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fandomId = searchParams.get("fandomId");
  const take = Math.min(Number(searchParams.get("take") ?? "30"), 100);

  const runs = await prisma.generationRun.findMany({
    where: fandomId ? { fandomId } : undefined,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      assets: true,
      fandom: { select: { title: true, slug: true } },
      scene: { select: { title: true } },
      reviews: true,
    },
  });

  return NextResponse.json(runs);
}
