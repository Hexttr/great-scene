import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import { geminiKeyAlias } from "./key-alias";

export const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview";
/** Текстовые вызовы (анализ фото, фандома, пул сцен). gemini-2.0-flash отключён для новых ключей — см. модели в документации Gemini API. */
export const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";

/** Долгая генерация изображения; по умолчанию в SDK часто ~60s. */
export const IMAGE_GEN_HTTP_TIMEOUT_MS = 180_000;

export interface GenerateSceneImageParams {
  apiKey: string;
  model?: string;
  prompt: string;
  referenceImageBase64: string;
  referenceMimeType: string;
  aspectRatio?: string;
  imageSize?: string;
}

export interface GenerateSceneImageResult {
  imageBase64: string;
  mimeType: string;
  modelUsed: string;
  keyAlias: string;
  rawText?: string;
  /** Сколько попыток понадобилось (1–4) */
  attemptsUsed: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Ищем изображение во всех кандидатах и частях ответа. */
function extractImageBytes(response: GenerateContentResponse): {
  base64: string;
  mimeType: string;
  text?: string;
} | null {
  const candidates = response.candidates ?? [];
  for (const cand of candidates) {
    const parts = cand.content?.parts;
    if (!parts?.length) continue;
    let text = "";
    for (const p of parts) {
      if (p.text) text += p.text;
      const md = p.inlineData;
      if (md?.data && md.mimeType?.startsWith("image/")) {
        return { base64: md.data, mimeType: md.mimeType, text: text || undefined };
      }
    }
  }

  const dataGetter = response as unknown as { data?: string };
  if (dataGetter.data) {
    return { base64: dataGetter.data, mimeType: "image/png", text: undefined };
  }
  return null;
}

function finishReasonSummary(response: GenerateContentResponse): string {
  const c = response.candidates?.[0];
  const fr = c?.finishReason;
  const fm = (c as { finishMessage?: string } | undefined)?.finishMessage;
  const parts = [fr, fm].filter(Boolean);
  return parts.length ? parts.join(" ") : "no_image";
}

const RETRY_SUFFIX_RU =
  "\n\nСгенерируй один кинематографичный кадр; без текста и логотипов на изображении.";

const RETRY_SUFFIX_EN =
  "\n\nOutput a single photorealistic cinematic still frame only. No text overlays, no watermark.";

type AttemptStrategy = {
  imageSize: string;
  aspectRatio: string;
  promptExtra: string;
};

function buildStrategies(params: GenerateSceneImageParams): AttemptStrategy[] {
  const baseAr = params.aspectRatio ?? "3:4";
  const baseSize = params.imageSize ?? "2K";
  return [
    { imageSize: baseSize, aspectRatio: baseAr, promptExtra: "" },
    { imageSize: baseSize, aspectRatio: baseAr, promptExtra: RETRY_SUFFIX_RU },
    { imageSize: "1K", aspectRatio: baseAr, promptExtra: RETRY_SUFFIX_EN },
    { imageSize: "1K", aspectRatio: "4:3", promptExtra: RETRY_SUFFIX_EN },
  ];
}

async function generateSceneImageOnce(
  ai: GoogleGenAI,
  model: string,
  params: GenerateSceneImageParams,
  strategy: AttemptStrategy
): Promise<{ response: GenerateContentResponse; extracted: ReturnType<typeof extractImageBytes> }> {
  const prompt = params.prompt + strategy.promptExtra;
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: params.referenceMimeType,
              data: params.referenceImageBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      httpOptions: {
        timeout: IMAGE_GEN_HTTP_TIMEOUT_MS,
      },
      responseModalities: [Modality.IMAGE, Modality.TEXT],
      imageConfig: {
        aspectRatio: strategy.aspectRatio,
        imageSize: strategy.imageSize,
      },
    },
  });
  const extracted = extractImageBytes(response);
  return { response, extracted };
}

/**
 * Генерация кадра с повторными попытками: IMAGE_OTHER / NO_IMAGE часто лечатся
 * повтором, снижением размера (2K→1K) и сменой соотношения сторон.
 * @see https://ai.google.dev/api/generate-content (FinishReason IMAGE_OTHER)
 */
export async function generateSceneImage(
  params: GenerateSceneImageParams
): Promise<GenerateSceneImageResult> {
  const model = params.model ?? DEFAULT_IMAGE_MODEL;
  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const keyAlias = geminiKeyAlias(params.apiKey);
  const strategies = buildStrategies(params);

  let lastDetail = "";
  const startedAll = Date.now();

  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    try {
      const { response, extracted } = await generateSceneImageOnce(ai, model, params, strategy);
      if (extracted) {
        return {
          imageBase64: extracted.base64,
          mimeType: extracted.mimeType,
          modelUsed: model,
          keyAlias,
          rawText: extracted.text,
          attemptsUsed: i + 1,
        };
      }
      lastDetail = finishReasonSummary(response);
    } catch (e) {
      lastDetail = e instanceof Error ? e.message : String(e);
    }

    if (i < strategies.length - 1) {
      await sleep(600 * Math.pow(2, i));
    }
  }

  const elapsed = Date.now() - startedAll;
  throw new Error(
    `Модель не вернула изображение после ${strategies.length} попыток (${elapsed}ms). Последняя причина: ${lastDetail}`
  );
}
