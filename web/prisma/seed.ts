import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getDefaultPromptBlocks } from "../src/lib/prompt-builder/default-blocks";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL missing for seed");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hp = await prisma.fandom.upsert({
    where: { slug: "harry-potter" },
    update: {},
    create: {
      slug: "harry-potter",
      title: "Wizarding World (inspired)",
      canonSummary:
        "Gothic-cozy British magical school, candlelit halls, floating candles, house scarves, wand-light, forbidden forest mist, emotional underdog heroism.",
      visualStyleNotes: "Warm tungsten + cool moonlight, practical torches, rain on castle glass, handheld intimacy.",
    },
  });

  await prisma.fandom.upsert({
    where: { slug: "iron-man" },
    update: {},
    create: {
      slug: "iron-man",
      title: "Armored hero tech (inspired)",
      canonSummary:
        "High-end workshop, holographic UI, Malibu glass architecture, hot metal sparks, LED rim light on brushed alloy, aerial night city vistas.",
      visualStyleNotes: "Anamorphic flares, contrasty speculars, cool steel vs warm skin tones.",
    },
  });

  const blocks = getDefaultPromptBlocks();
  const existing = await prisma.promptTemplate.findFirst({
    where: {
      OR: [{ name: "Default Lab Template" }, { name: "Базовый шаблон лаборатории" }],
    },
  });
  if (!existing) {
    await prisma.promptTemplate.create({
      data: {
        name: "Базовый шаблон лаборатории",
        version: 1,
        notes: "Начальные блоки промпта для лаборатории (seed)",
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

  await seedLabWallet();

  console.log("Seed OK — fandoms:", hp.title);
}

async function seedLabWallet() {
  let w = await prisma.wallet.findFirst({ where: { label: "lab" } });
  if (!w) {
    w = await prisma.wallet.create({
      data: { label: "lab", balanceCents: 10_000 },
    });
    await prisma.transaction.create({
      data: {
        walletId: w.id,
        type: "MOCK_TOPUP",
        amountCents: 10_000,
        balanceAfter: 10_000,
        reference: "seed_initial",
      },
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .then(async () => pool.end())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
