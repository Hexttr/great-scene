import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultPromptTemplateExists } from "@/lib/prompt-builder/ensure-default-template";

export async function GET() {
  await ensureDefaultPromptTemplateExists();
  const templates = await prisma.promptTemplate.findMany({
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}
