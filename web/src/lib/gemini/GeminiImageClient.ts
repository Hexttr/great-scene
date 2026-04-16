import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import { geminiKeyAlias } from "./key-alias";

export const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview";
/** Текстовые вызовы (анализ фото, фандома, пул сцен). gemini-2.0-flash отключён для новых ключей — см. модели в документации Gemini API. */
export const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";

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
}

function extractImageBytes(response: GenerateContentResponse): {
  base64: string;
  mimeType: string;
  text?: string;
} | null {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts?.length) return null;

  let text = "";
  for (const p of parts) {
    if (p.text) text += p.text;
    if (p.inlineData?.data && p.inlineData.mimeType?.startsWith("image/")) {
      return { base64: p.inlineData.data, mimeType: p.inlineData.mimeType, text: text || undefined };
    }
  }

  const dataGetter = response as unknown as { data?: string };
  if (dataGetter.data) {
    return { base64: dataGetter.data, mimeType: "image/png", text };
  }

  return null;
}

export async function generateSceneImage(
  params: GenerateSceneImageParams
): Promise<GenerateSceneImageResult> {
  const model = params.model ?? DEFAULT_IMAGE_MODEL;
  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const keyAlias = geminiKeyAlias(params.apiKey);

  const started = Date.now();
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
          {
            text: params.prompt,
          },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
      imageConfig: {
        aspectRatio: params.aspectRatio ?? "3:4",
        imageSize: params.imageSize ?? "2K",
      },
    },
  });

  const elapsed = Date.now() - started;
  const extracted = extractImageBytes(response);
  if (!extracted) {
    const msg =
      response.text?.slice(0, 500) ||
      JSON.stringify(response.candidates?.[0]?.finishReason || "no_image");
    throw new Error(`Model did not return an image (${elapsed}ms): ${msg}`);
  }

  return {
    imageBase64: extracted.base64,
    mimeType: extracted.mimeType,
    modelUsed: model,
    keyAlias,
    rawText: extracted.text,
  };
}
