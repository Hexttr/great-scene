import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assemblePrompt } from "@/lib/prompt-builder/assemble";
import type { PromptBlockInput } from "@/lib/prompt-builder/types";
import { subjectAnalysisForPrompt } from "@/lib/photo-analysis";
import { generateSceneImage, DEFAULT_IMAGE_MODEL } from "@/lib/gemini/GeminiImageClient";
import { geminiKeyAlias } from "@/lib/gemini/key-alias";
import { pickRandomScene } from "@/lib/scene-generation";
import { mockChargeGeneration, getOrCreateLabWallet } from "@/lib/billing/mock";
import { uploadsDir } from "@/lib/storage/uploads";
import { mkdir } from "node:fs/promises";
import { resolveDefaultPromptTemplate } from "@/lib/prompt-builder/ensure-default-template";

const bodySchema = z.object({
  userPhotoId: z.string(),
  fandomId: z.string(),
  sceneId: z.string().optional(),
  promptTemplateId: z.string().optional(),
  /** Override block contents for lab */
  blocks: z
    .array(
      z.object({
        blockKey: z.string(),
        label: z.string().optional().nullable(),
        content: z.string(),
        enabled: z.boolean(),
        strength: z.number(),
        sortOrder: z.number(),
      })
    )
    .optional(),
  geminiApiKey: z.string().min(1),
  model: z.string().optional(),
  aspectRatio: z.string().optional(),
  imageSize: z.string().optional(),
  chargeCents: z.number().int().min(0).optional().default(50),
  skipCharge: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;

  const photo = await prisma.userPhoto.findUnique({ where: { id: b.userPhotoId } });
  if (!photo) return NextResponse.json({ error: "фото не найдено" }, { status: 404 });

  const fandom = await prisma.fandom.findUnique({ where: { id: b.fandomId } });
  if (!fandom) return NextResponse.json({ error: "фандом не найден" }, { status: 404 });

  const analysisRow = await prisma.photoAnalysis.findFirst({
    where: { userPhotoId: photo.id },
    orderBy: { createdAt: "desc" },
  });

  const scene = b.sceneId
    ? await prisma.scene.findFirst({ where: { id: b.sceneId, fandomId: fandom.id } })
    : await pickRandomScene(fandom.id);
  if (!scene) {
    return NextResponse.json(
      {
        error:
          "Нет сцен для этого фандома. Сначала вызовите пополнение пула (кнопка в лаборатории или /api/scenes/ensure-pool).",
      },
      { status: 400 }
    );
  }

  const template = b.promptTemplateId
    ? await prisma.promptTemplate.findUnique({
        where: { id: b.promptTemplateId },
        include: { blocks: { orderBy: { sortOrder: "asc" } } },
      })
    : await resolveDefaultPromptTemplate();

  if (!template) {
    return NextResponse.json(
      { error: "Не удалось подготовить шаблон промпта" },
      { status: 500 }
    );
  }

  const blockInputs: PromptBlockInput[] = b.blocks?.length
    ? b.blocks.map((bl) => ({
        blockKey: bl.blockKey as PromptBlockInput["blockKey"],
        label: bl.label ?? null,
        content: bl.content,
        enabled: bl.enabled,
        strength: bl.strength,
        sortOrder: bl.sortOrder,
      }))
    : template.blocks.map((bl) => ({
        blockKey: bl.blockKey as PromptBlockInput["blockKey"],
        label: bl.label,
        content: bl.content,
        enabled: bl.enabled,
        strength: bl.strength,
        sortOrder: bl.sortOrder,
      }));

  const fa = analysisRow?.fullAnalysis as Record<string, unknown> | null | undefined;
  const normalized = {
    subjectCount: analysisRow?.subjectCount ?? 1,
    genderPresentation: analysisRow?.genderPresentation ?? null,
    faceCoverage: analysisRow?.faceCoverage ?? null,
    poseSummary: analysisRow?.poseSummary ?? null,
    expressionSummary: analysisRow?.expressionSummary ?? null,
    subjectFraming: typeof fa?.subjectFraming === "string" ? fa.subjectFraming : null,
    faceVisibility: typeof fa?.faceVisibility === "string" ? fa.faceVisibility : null,
    preserveFeatures:
      typeof fa?.preserveFeatures === "string" ? fa.preserveFeatures : "Preserve identity from reference.",
    wardrobeHints: typeof fa?.wardrobeHints === "string" ? fa.wardrobeHints : null,
    inputWarnings: (analysisRow?.warnings as string[] | null) ?? [],
    fullAnalysis: fa ?? {},
  };

  const subjectText = subjectAnalysisForPrompt({
    ...normalized,
    fullAnalysis: normalized.fullAnalysis as Record<string, unknown>,
  });

  const fandomCanon = `${fandom.title}. ${fandom.canonSummary}${
    fandom.visualStyleNotes ? ` Visual style: ${fandom.visualStyleNotes}` : ""
  }`;

  const sceneDetail = [
    scene.title,
    scene.scenePromptSeed,
    scene.compositionNotes ? `Composition: ${scene.compositionNotes}` : "",
    scene.lightingNotes ? `Lighting: ${scene.lightingNotes}` : "",
    scene.cameraNotes ? `Camera: ${scene.cameraNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const emotionNotes = scene.emotionNotes ?? normalized.expressionSummary ?? "Grounded, cinematic emotion.";

  const assembled = assemblePrompt(blockInputs, {
    FANDOM_CANON: fandomCanon,
    SCENE_DETAIL: sceneDetail,
    EMOTION_NOTES: emotionNotes,
    SUBJECT_ANALYSIS: subjectText,
  });

  const assembledPrompt = `${assembled.text}\n\n---\nSubject reference notes:\n${subjectText}`;

  const run = await prisma.generationRun.create({
    data: {
      userPhotoId: photo.id,
      fandomId: fandom.id,
      sceneId: scene.id,
      promptTemplateId: template.id,
      assembledPrompt,
      blocksSnapshot: JSON.parse(JSON.stringify(blockInputs)),
      model: b.model ?? DEFAULT_IMAGE_MODEL,
      modelParams: {
        aspectRatio: b.aspectRatio,
        imageSize: b.imageSize,
      },
      geminiKeyAlias: geminiKeyAlias(b.geminiApiKey),
      status: "RUNNING",
    },
  });

  const diskPath = path.join(process.cwd(), "public", "uploads", photo.filename);
  const imageBuf = await readFile(diskPath);
  const b64 = imageBuf.toString("base64");

  const started = Date.now();
  try {
    const out = await generateSceneImage({
      apiKey: b.geminiApiKey,
      model: b.model ?? DEFAULT_IMAGE_MODEL,
      prompt: assembledPrompt,
      referenceImageBase64: b64,
      referenceMimeType: photo.mimeType,
      aspectRatio: b.aspectRatio,
      imageSize: b.imageSize,
    });

    const outName = `gen_${run.id}.png`;
    const outDir = uploadsDir();
    await mkdir(outDir, { recursive: true });
    const outFull = path.join(outDir, outName);
    const rawB64 = out.imageBase64.replace(/^data:image\/\w+;base64,/, "").trim();
    const normalizedB64 = rawB64.replace(/-/g, "+").replace(/_/g, "/");
    await writeFile(outFull, Buffer.from(normalizedB64, "base64"));

    if (!b.skipCharge && b.chargeCents > 0) {
      const wallet = await getOrCreateLabWallet();
      await mockChargeGeneration(wallet.id, run.id, b.chargeCents);
    }

    await prisma.generationRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        latencyMs: Date.now() - started,
        geminiKeyAlias: out.keyAlias,
        costCents: b.skipCharge ? 0 : b.chargeCents,
      },
    });

    const asset = await prisma.generationAsset.create({
      data: {
        generationRunId: run.id,
        mimeType: out.mimeType,
        path: `/api/uploads/${outName}`,
        meta: { rawText: out.rawText } as object,
      },
    });

    return NextResponse.json({
      runId: run.id,
      imageUrl: asset.path,
      latencyMs: Date.now() - started,
      assembledPrompt,
      blocks: blockInputs,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "generation failed";
    await prisma.generationRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage: msg,
        latencyMs: Date.now() - started,
      },
    });
    return NextResponse.json({ error: msg, runId: run.id }, { status: 500 });
  }
}
