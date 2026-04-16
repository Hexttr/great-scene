import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { DEFAULT_TEXT_MODEL } from "@/lib/gemini/GeminiImageClient";

const parsedFandomSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(2),
  canonSummary: z.string().min(5),
  visualStyleNotes: z.string().optional().nullable(),
});

export type AnalyzedFandomFields = z.infer<typeof parsedFandomSchema>;

const JSON_INSTRUCTION = `Ты помощник для лаборатории генерации изображений по фандомам.
Пользователь описал вселенную/фэндом СВОБОДНЫМ ТЕКСТОМ (на любом языке).
Верни ТОЛЬКО валидный JSON без markdown, без пояснений, одним объектом:
{
  "title": "краткое человекочитаемое название для UI (на языке пользователя или русском)",
  "slug": "только латиница a-z цифры и дефисы, нижний регистр, 2-64 символа, без пробелов",
  "canonSummary": "плотный абзац (3-8 предложений) для подстановки в промпт генерации: атмосфера, эстетика, ключевые мотивы, типичные локации и настроение. Без копирайтных имён персонажей если пользователь упоминал канон — опиши обобщённо стиль мира.",
  "visualStyleNotes": "коротко: свет, палитра, кинооптика, настроение кадра; или null если нечего добавить"
}`;

function extractJsonObject(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Приводит строку к безопасному slug (a-z0-9-). */
export function slugifyAscii(input: string): string {
  const t = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 62);
  return t.length >= 2 ? t : "fandom";
}

export async function analyzeFandomFreeform(
  freeform: string,
  options: { geminiApiKey: string }
): Promise<AnalyzedFandomFields> {
  const apiKey = options.geminiApiKey;
  if (!apiKey.trim()) {
    throw new Error("Нужен ключ Gemini");
  }

  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: DEFAULT_TEXT_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: `${JSON_INSTRUCTION}\n\n--- Описание пользователя ---\n${freeform.trim()}` }],
      },
    ],
  });

  const text = res.text ?? "";
  const raw = extractJsonObject(text);
  if (!raw) {
    throw new Error("Модель не вернула JSON. Повторите запрос или сократите текст.");
  }

  let slug = typeof raw.slug === "string" ? slugifyAscii(raw.slug) : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const canonSummary =
    typeof raw.canonSummary === "string" ? raw.canonSummary.trim() : "";
  const visualStyleNotes =
    raw.visualStyleNotes === null || raw.visualStyleNotes === undefined
      ? null
      : typeof raw.visualStyleNotes === "string"
        ? raw.visualStyleNotes.trim() || null
        : null;

  if (!slug && title) {
    slug = slugifyAscii(title);
  }
  if (!slug) {
    slug = `fandom-${Date.now().toString(36)}`;
  }

  const parsed = parsedFandomSchema.safeParse({
    title: title || slug,
    slug,
    canonSummary,
    visualStyleNotes,
  });

  if (!parsed.success) {
    throw new Error(
      `Некорректный ответ модели: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }

  return {
    ...parsed.data,
    slug: slugifyAscii(parsed.data.slug),
  };
}
