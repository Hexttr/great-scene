import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fandomId = searchParams.get("fandomId");
  if (!fandomId) {
    return NextResponse.json({ error: "нужен параметр fandomId" }, { status: 400 });
  }
  const scenes = await prisma.scene.findMany({
    where: { fandomId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(scenes);
}
