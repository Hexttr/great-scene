import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/** Ensures a single lab wallet exists. */
export async function getOrCreateLabWallet(): Promise<{ id: string; balanceCents: number }> {
  let w = await prisma.wallet.findFirst({ where: { label: "lab" } });
  if (!w) {
    w = await prisma.wallet.create({ data: { label: "lab", balanceCents: 0 } });
  }
  return { id: w.id, balanceCents: w.balanceCents };
}

export async function mockTopUp(walletId: string, amountCents: number) {
  if (amountCents <= 0) throw new Error("Amount must be positive");
  return prisma.$transaction(async (tx) => {
    const w = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });
    const balanceAfter = w.balanceCents + amountCents;
    const tr = await tx.transaction.create({
      data: {
        walletId,
        type: "MOCK_TOPUP",
        amountCents,
        balanceAfter,
        reference: `mock_topup_${Date.now()}`,
        metadata: { source: "lab" } as Prisma.InputJsonValue,
      },
    });
    await tx.wallet.update({
      where: { id: walletId },
      data: { balanceCents: balanceAfter },
    });
    return { transaction: tr, balanceCents: balanceAfter };
  });
}

export async function mockChargeGeneration(
  walletId: string,
  generationRunId: string,
  amountCents: number
) {
  if (amountCents <= 0) throw new Error("Charge must be positive");
  return prisma.$transaction(async (tx) => {
    const w = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });
    if (w.balanceCents < amountCents) {
      throw new Error("Insufficient balance");
    }
    const balanceAfter = w.balanceCents - amountCents;
    const tr = await tx.transaction.create({
      data: {
        walletId,
        type: "GENERATION_CHARGE",
        amountCents: -amountCents,
        balanceAfter,
        reference: generationRunId,
        metadata: { generationRunId } as Prisma.InputJsonValue,
      },
    });
    await tx.wallet.update({
      where: { id: walletId },
      data: { balanceCents: balanceAfter },
    });
    await tx.generationCharge.create({
      data: {
        walletId,
        generationRunId,
        amountCents,
        transactionId: tr.id,
      },
    });
    return { transaction: tr, balanceCents: balanceAfter };
  });
}
