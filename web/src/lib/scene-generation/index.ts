import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TEXT_MODEL } from "@/lib/gemini/GeminiImageClient";

export const MAX_SCENES_PER_FANDOM = 50;
export const BATCH_SIZE = 10;

export function sceneFingerprint(title: string, seed: string): string {
  return createHash("sha256")
    .update(`${title.trim().toLowerCase()}|${seed.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

interface SceneJson {
  title: string;
  scenePromptSeed: string;
  compositionNotes?: string;
  emotionNotes?: string;
  lightingNotes?: string;
  cameraNotes?: string;
}

export async function generateSceneBatchJson(
  apiKey: string,
  fandom: { title: string; canonSummary: string; visualStyleNotes: string | null }
): Promise<SceneJson[]> {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are a film visual development artist. For the fictional universe below, invent exactly ${BATCH_SIZE} NEW epic cinematic scene briefs suitable for inserting a real photographed person as the hero. Avoid copyrighted character names; use archetypes and setting tone.

Universe: ${fandom.title}
Canon / look: ${fandom.canonSummary}
Visual style notes: ${fandom.visualStyleNotes ?? "—"}

Return ONLY a JSON array of ${BATCH_SIZE} objects with keys:
title (short),
scenePromptSeed (2-4 sentences: action, environment, dramatic beat),
compositionNotes,
emotionNotes,
lightingNotes,
cameraNotes.`;

  const res = await ai.models.generateContent({
    model: DEFAULT_TEXT_MODEL,
    contents: prompt,
  });

  const text = res.text ?? "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Scene model did not return JSON array");
  const arr = JSON.parse(match[0]) as SceneJson[];
  if (!Array.isArray(arr) || arr.length < 1) throw new Error("Invalid scenes JSON");
  return arr.slice(0, BATCH_SIZE);
}

export async function ensureScenePool(
  fandomId: string,
  apiKey: string
): Promise<{ created: number; total: number; capped: boolean }> {
  const fandom = await prisma.fandom.findUnique({ where: { id: fandomId } });
  if (!fandom) throw new Error("Fandom not found");

  const total = await prisma.scene.count({ where: { fandomId } });
  if (total >= MAX_SCENES_PER_FANDOM) {
    return { created: 0, total, capped: true };
  }

  const batch = await generateSceneBatchJson(apiKey, fandom);
  let created = 0;
  for (const s of batch) {
    if (total + created >= MAX_SCENES_PER_FANDOM) break;
    const fp = sceneFingerprint(s.title, s.scenePromptSeed);
    try {
      await prisma.scene.create({
        data: {
          fandomId,
          title: s.title,
          scenePromptSeed: s.scenePromptSeed,
          compositionNotes: s.compositionNotes ?? null,
          emotionNotes: s.emotionNotes ?? null,
          lightingNotes: s.lightingNotes ?? null,
          cameraNotes: s.cameraNotes ?? null,
          fingerprint: fp,
          sourceType: "GENERATED",
        },
      });
      created++;
    } catch {
      // duplicate fingerprint — skip
    }
  }

  const newTotal = await prisma.scene.count({ where: { fandomId } });
  return { created, total: newTotal, capped: newTotal >= MAX_SCENES_PER_FANDOM };
}

export async function pickRandomScene(fandomId: string) {
  const scenes = await prisma.scene.findMany({
    where: { fandomId, status: "ACTIVE" },
  });
  if (scenes.length === 0) return null;
  return scenes[Math.floor(Math.random() * scenes.length)]!;
}
