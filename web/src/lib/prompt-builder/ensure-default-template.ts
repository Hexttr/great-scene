import { prisma } from "@/lib/prisma";
import { getDefaultPromptBlocks } from "./default-blocks";

const KNOWN_DEFAULT_NAMES = ["Базовый шаблон лаборатории", "Default Lab Template"];

/**
 * Если в БД нет ни одного шаблона промпта — создаёт базовый из default-blocks.
 * Идемпотентно: безопасно вызывать при каждой генерации / GET шаблонов.
 */
export async function ensureDefaultPromptTemplateExists() {
  const count = await prisma.promptTemplate.count();
  if (count > 0) return;

  const blocks = getDefaultPromptBlocks();
  await prisma.promptTemplate.create({
    data: {
      name: "Базовый шаблон лаборатории",
      version: 1,
      notes: "Базовые блоки промпта (создано автоматически)",
      blocks: {
        create: blocks.map((b) => ({
          blockKey: b.blockKey,
          label: b.label ?? null,
          content: b.content,
          enabled: b.enabled,
          strength: b.strength,
          sortOrder: b.sortOrder,
        })),
      },
    },
  });
}

/** Шаблон по умолчанию для генерации: сначала известные имена, иначе любой первый. */
export async function resolveDefaultPromptTemplate() {
  await ensureDefaultPromptTemplateExists();

  const byName = await prisma.promptTemplate.findFirst({
    where: { OR: KNOWN_DEFAULT_NAMES.map((name) => ({ name })) },
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
  });
  if (byName) return byName;

  return prisma.promptTemplate.findFirst({
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
  });
}
