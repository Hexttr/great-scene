import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_TEXT_MODEL } from "@/lib/gemini/GeminiImageClient";

export interface PhotoAnalysisNormalized {
  subjectCount: number;
  genderPresentation: string | null;
  faceCoverage: number | null;
  poseSummary: string | null;
  expressionSummary: string | null;
  subjectFraming: string | null;
  faceVisibility: string | null;
  preserveFeatures: string | null;
  wardrobeHints: string | null;
  inputWarnings: string[];
  /** Raw structured blob for prompt lab */
  fullAnalysis: Record<string, unknown>;
}

const ANALYSIS_SCHEMA_HINT = `Return ONLY valid JSON with keys:
subjectCount (number),
genderPresentation (string: male|female|androgynous|uncertain),
faceCoverage (0-1 estimate),
poseSummary (short string),
expressionSummary (short string),
subjectFraming (string: close_up|medium|full_body|etc),
faceVisibility (string: clear|partial|obscured),
preserveFeatures (string: what must stay recognizable),
wardrobeHints (string or null),
inputWarnings (array of strings for issues: blur, multiple_people, tiny_face, overexposed, etc).`;

export async function analyzePhotoBuffer(
  buffer: Buffer,
  mimeType: string,
  options: { geminiApiKey?: string }
): Promise<PhotoAnalysisNormalized> {
  const warnings: string[] = [];
  let metaW = 0;
  let metaH = 0;

  try {
    const img = sharp(buffer);
    const meta = await img.metadata();
    metaW = meta.width ?? 0;
    metaH = meta.height ?? 0;
    if (metaW < 256 || metaH < 256) warnings.push("low_resolution");
    const stats = await img.clone().resize(64).stats();
    const channels = stats.channels;
    const avg =
      channels.reduce((s, c) => s + (c.mean ?? 0), 0) / Math.max(channels.length, 1);
    if (avg > 240) warnings.push("possibly_overexposed");
    if (avg < 20) warnings.push("possibly_underexposed");
  } catch {
    warnings.push("image_decode_issue");
  }

  const apiKey = options.geminiApiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      subjectCount: 1,
      genderPresentation: "uncertain",
      faceCoverage: null,
      poseSummary: "Unknown (no Gemini key for vision)",
      expressionSummary: null,
      subjectFraming: null,
      faceVisibility: null,
      preserveFeatures: "Preserve facial identity from reference.",
      wardrobeHints: null,
      inputWarnings: [...warnings, "vision_analysis_skipped_no_api_key"],
      fullAnalysis: { heuristicOnly: true },
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const b64 = buffer.toString("base64");

  const prompt = `${ANALYSIS_SCHEMA_HINT}

Analyze this single uploaded photo for cinematic compositing into a fictional scene.
Focus on: how many prominent people (must be exactly 1 for our pipeline), estimated gender presentation for wardrobe/lighting language only (not identity claim), pose, emotion, framing.`;

  const res = await ai.models.generateContent({
    model: DEFAULT_TEXT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: mimeType || "image/jpeg", data: b64 } },
          { text: prompt },
        ],
      },
    ],
  });

  const text = res.text ?? "";
  let parsed: Record<string, unknown> = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    parsed = { parseError: true, raw: text.slice(0, 2000) };
  }

  const subjectCount = Number(parsed.subjectCount ?? 1) || 1;
  if (subjectCount !== 1) warnings.push("multiple_or_zero_subjects");

  const inputWarningsFromModel = Array.isArray(parsed.inputWarnings)
    ? (parsed.inputWarnings as unknown[]).map(String)
    : [];

  return {
    subjectCount,
    genderPresentation:
      typeof parsed.genderPresentation === "string" ? parsed.genderPresentation : "uncertain",
    faceCoverage: typeof parsed.faceCoverage === "number" ? parsed.faceCoverage : null,
    poseSummary: typeof parsed.poseSummary === "string" ? parsed.poseSummary : null,
    expressionSummary:
      typeof parsed.expressionSummary === "string" ? parsed.expressionSummary : null,
    subjectFraming: typeof parsed.subjectFraming === "string" ? parsed.subjectFraming : null,
    faceVisibility: typeof parsed.faceVisibility === "string" ? parsed.faceVisibility : null,
    preserveFeatures:
      typeof parsed.preserveFeatures === "string"
        ? parsed.preserveFeatures
        : "Preserve facial identity from reference.",
    wardrobeHints: typeof parsed.wardrobeHints === "string" ? parsed.wardrobeHints : null,
    inputWarnings: [...new Set([...warnings, ...inputWarningsFromModel])],
    fullAnalysis: { ...parsed, metaWidth: metaW, metaHeight: metaH },
  };
}

export function subjectAnalysisForPrompt(a: PhotoAnalysisNormalized): string {
  const lines = [
    `Subject count: ${a.subjectCount}`,
    a.genderPresentation ? `Presentation (for styling only): ${a.genderPresentation}` : null,
    a.subjectFraming ? `Framing: ${a.subjectFraming}` : null,
    a.faceVisibility ? `Face visibility: ${a.faceVisibility}` : null,
    a.poseSummary ? `Pose: ${a.poseSummary}` : null,
    a.expressionSummary ? `Expression: ${a.expressionSummary}` : null,
    a.preserveFeatures ? `Preserve: ${a.preserveFeatures}` : null,
    a.wardrobeHints ? `Wardrobe hints: ${a.wardrobeHints}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}
