-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('PENDING', 'OK', 'REJECTED');

-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SceneSourceType" AS ENUM ('GENERATED', 'MANUAL', 'IMPORTED');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('MOCK_TOPUP', 'MOCK_CHARGE', 'GENERATION_CHARGE', 'PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "UserPhoto" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "status" "PhotoStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoAnalysis" (
    "id" TEXT NOT NULL,
    "userPhotoId" TEXT NOT NULL,
    "subjectCount" INTEGER NOT NULL,
    "genderPresentation" TEXT,
    "faceCoverage" DOUBLE PRECISION,
    "poseSummary" TEXT,
    "expressionSummary" TEXT,
    "warnings" JSONB,
    "fullAnalysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fandom" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "canonSummary" TEXT NOT NULL,
    "visualStyleNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fandom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "fandomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scenePromptSeed" TEXT NOT NULL,
    "compositionNotes" TEXT,
    "emotionNotes" TEXT,
    "lightingNotes" TEXT,
    "cameraNotes" TEXT,
    "status" "SceneStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceType" "SceneSourceType" NOT NULL DEFAULT 'GENERATED',
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptBlockInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "label" TEXT,
    "content" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PromptBlockInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationRun" (
    "id" TEXT NOT NULL,
    "userPhotoId" TEXT NOT NULL,
    "fandomId" TEXT NOT NULL,
    "sceneId" TEXT,
    "promptTemplateId" TEXT,
    "assembledPrompt" TEXT NOT NULL,
    "blocksSnapshot" JSONB,
    "model" TEXT NOT NULL,
    "modelParams" JSONB,
    "geminiKeyAlias" TEXT,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "costCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationAsset" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'output',
    "mimeType" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityReview" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "similarityScore" INTEGER,
    "cinematicScore" INTEGER,
    "integrationScore" INTEGER,
    "fandomFidelityScore" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'lab',
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "externalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationCharge" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fandom_slug_key" ON "Fandom"("slug");

-- CreateIndex
CREATE INDEX "Scene_fandomId_idx" ON "Scene"("fandomId");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_fandomId_fingerprint_key" ON "Scene"("fandomId", "fingerprint");

-- CreateIndex
CREATE INDEX "PromptBlockInstance_templateId_idx" ON "PromptBlockInstance"("templateId");

-- CreateIndex
CREATE INDEX "GenerationRun_fandomId_idx" ON "GenerationRun"("fandomId");

-- CreateIndex
CREATE INDEX "GenerationRun_createdAt_idx" ON "GenerationRun"("createdAt");

-- CreateIndex
CREATE INDEX "GenerationAsset_generationRunId_idx" ON "GenerationAsset"("generationRunId");

-- CreateIndex
CREATE INDEX "QualityReview_generationRunId_idx" ON "QualityReview"("generationRunId");

-- CreateIndex
CREATE INDEX "Transaction_walletId_idx" ON "Transaction"("walletId");

-- CreateIndex
CREATE INDEX "PaymentIntent_walletId_idx" ON "PaymentIntent"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationCharge_generationRunId_key" ON "GenerationCharge"("generationRunId");

-- CreateIndex
CREATE INDEX "GenerationCharge_walletId_idx" ON "GenerationCharge"("walletId");

-- AddForeignKey
ALTER TABLE "PhotoAnalysis" ADD CONSTRAINT "PhotoAnalysis_userPhotoId_fkey" FOREIGN KEY ("userPhotoId") REFERENCES "UserPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_fandomId_fkey" FOREIGN KEY ("fandomId") REFERENCES "Fandom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptBlockInstance" ADD CONSTRAINT "PromptBlockInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PromptTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRun" ADD CONSTRAINT "GenerationRun_userPhotoId_fkey" FOREIGN KEY ("userPhotoId") REFERENCES "UserPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRun" ADD CONSTRAINT "GenerationRun_fandomId_fkey" FOREIGN KEY ("fandomId") REFERENCES "Fandom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRun" ADD CONSTRAINT "GenerationRun_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRun" ADD CONSTRAINT "GenerationRun_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationAsset" ADD CONSTRAINT "GenerationAsset_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityReview" ADD CONSTRAINT "QualityReview_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationCharge" ADD CONSTRAINT "GenerationCharge_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationCharge" ADD CONSTRAINT "GenerationCharge_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationCharge" ADD CONSTRAINT "GenerationCharge_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
