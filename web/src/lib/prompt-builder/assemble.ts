import type { AssembledPromptResult, PromptBlockInput } from "./types";

export interface AssembleContext {
  FANDOM_CANON: string;
  SCENE_DETAIL: string;
  EMOTION_NOTES: string;
  SUBJECT_ANALYSIS?: string;
}

function interpolate(template: string, ctx: AssembleContext): string {
  let out = template;
  out = out.replace(/\{\{FANDOM_CANON\}\}/g, ctx.FANDOM_CANON);
  out = out.replace(/\{\{SCENE_DETAIL\}\}/g, ctx.SCENE_DETAIL);
  out = out.replace(/\{\{EMOTION_NOTES\}\}/g, ctx.EMOTION_NOTES);
  if (ctx.SUBJECT_ANALYSIS) {
    out = out.replace(/\{\{SUBJECT_ANALYSIS\}\}/g, ctx.SUBJECT_ANALYSIS);
  }
  return out;
}

/**
 * Composes final prompt from ordered blocks. Higher strength repeats emphasis via prefix weighting.
 */
export function assemblePrompt(
  blocks: PromptBlockInput[],
  ctx: AssembleContext
): AssembledPromptResult {
  const sorted = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);
  const parts: AssembledPromptResult["parts"] = [];

  for (const b of sorted) {
    if (!b.enabled || !b.content.trim()) continue;
    const raw = interpolate(b.content.trim(), ctx);
    const weight = Math.max(0.25, Math.min(2, b.strength));
    const weighted =
      weight >= 1.15
        ? `[Приоритет ${weight.toFixed(2)}] ${raw}`
        : weight <= 0.85
          ? `[Мягко ${weight.toFixed(2)}] ${raw}`
          : raw;
    parts.push({ key: b.blockKey, weight, text: weighted });
  }

  const text = parts.map((p) => p.text).join("\n\n---\n\n");
  return { text, parts };
}
