-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('CONSULTA', 'PRECIO_ENVIADO', 'RESERVADO', 'VENDIDO', 'EN_PAUSA', 'PERDIDO');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEB', 'WHATSAPP', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('ENTRANTE', 'SALIENTE');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('RECIBIDO', 'ENVIADO', 'ENTREGADO', 'LEIDO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDIENTE', 'ENVIADO', 'DESCARTADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ENVIAR_MENSAJE';
ALTER TYPE "AuditAction" ADD VALUE 'MODIFICAR_SEGUIMIENTO';
ALTER TYPE "AuditAction" ADD VALUE 'REASIGNAR_CONSULTA';
ALTER TYPE "AuditAction" ADD VALUE 'CREAR_CONTACTO';
ALTER TYPE "AuditAction" ADD VALUE 'NOTA_INTERNA';
ALTER TYPE "AuditAction" ADD VALUE 'GENERAR_AVISOS';

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "source" "LeadSource" NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'CONSULTA',
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigneeId" TEXT,
    "deviceId" TEXT,
    "interestNote" TEXT,
    "nextContactAt" TIMESTAMP(3),
    "nextContactNote" TEXT,
    "pauseReason" TEXT,
    "lostReason" TEXT,
    "aiPriority" "LeadPriority",
    "aiPriorityReason" TEXT,
    "manualPriority" "LeadPriority",
    "lastInboundAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "needsReply" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_messages" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "channel" "LeadSource" NOT NULL,
    "body" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "externalId" TEXT,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_drafts" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_stage_changes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStage" "LeadStage",
    "toStage" "LeadStage" NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_stage_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "forDate" DATE NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dueToday" INTEGER NOT NULL DEFAULT 0,
    "overdue" INTEGER NOT NULL DEFAULT 0,
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "signatureOk" BOOLEAN NOT NULL,
    "kind" TEXT,
    "externalId" TEXT,
    "outcome" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_phone_key" ON "leads"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "leads_email_key" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_stage_idx" ON "leads"("stage");

-- CreateIndex
CREATE INDEX "leads_assigneeId_idx" ON "leads"("assigneeId");

-- CreateIndex
CREATE INDEX "leads_nextContactAt_idx" ON "leads"("nextContactAt");

-- CreateIndex
CREATE INDEX "leads_lastMessageAt_idx" ON "leads"("lastMessageAt");

-- CreateIndex
CREATE INDEX "leads_needsReply_idx" ON "leads"("needsReply");

-- CreateIndex
CREATE UNIQUE INDEX "lead_messages_externalId_key" ON "lead_messages"("externalId");

-- CreateIndex
CREATE INDEX "lead_messages_leadId_createdAt_idx" ON "lead_messages"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "lead_drafts_leadId_status_idx" ON "lead_drafts"("leadId", "status");

-- CreateIndex
CREATE INDEX "lead_notes_leadId_createdAt_idx" ON "lead_notes"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "lead_stage_changes_leadId_createdAt_idx" ON "lead_stage_changes"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "staff_notifications_userId_kind_forDate_key" ON "staff_notifications"("userId", "kind", "forDate");

-- CreateIndex
CREATE INDEX "webhook_logs_createdAt_idx" ON "webhook_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_messages" ADD CONSTRAINT "lead_messages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_messages" ADD CONSTRAINT "lead_messages_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_drafts" ADD CONSTRAINT "lead_drafts_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_stage_changes" ADD CONSTRAINT "lead_stage_changes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_stage_changes" ADD CONSTRAINT "lead_stage_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Anti-duplicados: a una misma persona no se le puede mandar dos veces el mismo
-- texto (normalizado). Frena el doble clic y los envíos simultáneos. Prisma no
-- declara índices parciales, por eso vive solo acá.
CREATE UNIQUE INDEX "lead_messages_out_unique_text"
  ON "lead_messages" ("leadId", "normalizedText")
  WHERE "direction" = 'SALIENTE' AND "status" <> 'FALLIDO';

-- Una consulta necesita al menos un medio de contacto.
ALTER TABLE "leads"
  ADD CONSTRAINT "leads_has_contact"
  CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL);

ALTER TABLE "staff_notifications"
  ADD CONSTRAINT "staff_notifications_counts_non_negative"
  CHECK ("dueToday" >= 0 AND "overdue" >= 0);
