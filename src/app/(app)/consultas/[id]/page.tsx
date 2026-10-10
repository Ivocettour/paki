import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone, Smartphone } from "lucide-react";
import { getLeadDetail, listAssignable } from "@/lib/services/leads/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { availableTemplates, enforceWindow } from "@/lib/integrations/whatsapp/client";
import { decideSendMode } from "@/lib/integrations/whatsapp/rules";
import { firstName } from "@/lib/domain/phone";
import { businessDay } from "@/lib/domain/installments";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import {
  DEVICE_CONDITION_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_LABELS,
  MESSAGE_STATUS_LABELS,
  formatStorage,
} from "@/lib/constants";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DueChip, PriorityBadge, StageBadge } from "@/components/leads/badges";
import { InventoryStatusBadge } from "@/components/ui/status";
import { FollowForm } from "./follow-form";
import { NotesPanel } from "./notes-panel";
import { ReassignForm } from "./reassign-form";
import { ManualReply } from "./manual-reply";
import { ReplyPanel, type TemplateOption } from "./reply-panel";

export const metadata = { title: "Consulta" };

export default async function ConsultaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let lead;
  try {
    lead = await getLeadDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NO_ENCONTRADO") notFound();
    throw error;
  }

  const [user, people] = await Promise.all([
    getCurrentUser(),
    lead.canReassign ? listAssignable() : Promise.resolve([]),
  ]);

  const templates = availableTemplates();
  const sendMode = decideSendMode({
    lastInboundAt: lead.lastWhatsappInboundAt,
    enforceWindow: enforceWindow(),
    templateAvailable: templates.length > 0,
  }).mode;

  const templateOptions: TemplateOption[] = templates.map((t) => ({
    key: t.entry.key,
    label: t.entry.label,
    hint: t.entry.hint,
    text: t.template.text,
    fields: t.entry.fields,
  }));

  const nextDate = lead.nextContactAt ? businessDay(lead.nextContactAt) : "";

  return (
    <>
      <Link href="/consultas" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-fg-secondary hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        Volver a consultas
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-fg sm:text-[32px]">{lead.fullName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StageBadge stage={lead.stage} />
            <PriorityBadge
              priority={lead.manualPriority ?? lead.aiPriority}
              reason={lead.manualPriority ? "Fijada a mano" : lead.aiPriorityReason}
            />
            <DueChip next={lead.nextContactAt} />
            <span className="text-[13px] text-fg-tertiary">
              {LEAD_SOURCE_LABELS[lead.source]} · {lead.assigneeName ?? "Sin asignar"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Conversación" description={`${lead.messages.length} ${lead.messages.length === 1 ? "mensaje" : "mensajes"}`} />
            <CardBody className="space-y-3">
              {lead.messages.length === 0 ? (
                <p className="text-[14px] text-fg-tertiary">Todavía no hay mensajes.</p>
              ) : (
                lead.messages.map((message) => {
                  const mine = message.direction === "SALIENTE";
                  return (
                    <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-[18px] px-4 py-2.5",
                          mine ? "bg-accent text-white" : "bg-surface-subtle text-fg",
                        )}
                      >
                        <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{message.body}</p>
                        <p className={cn("mt-1 text-[11px]", mine ? "text-white/70" : "text-fg-tertiary")}>
                          {mine ? `${message.senderName ?? "Local"} · ` : `${LEAD_SOURCE_LABELS[message.channel]} · `}
                          {formatDateTime(message.createdAt)}
                          {mine ? ` · ${MESSAGE_STATUS_LABELS[message.status]}` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Responder"
              description="Por WhatsApp. Un borrador no se envía hasta que lo mandás vos."
            />
            <CardBody>
              <ReplyPanel
                leadId={lead.id}
                leadFirstName={firstName(lead.fullName)}
                senderFirstName={firstName(user?.fullName ?? "")}
                hasPhone={Boolean(lead.phone)}
                mode={sendMode}
                draft={lead.draft}
                templates={templateOptions}
              />
            </CardBody>
          </Card>

          {lead.phone ? (
            <Card>
              <CardHeader
                title="Responder desde mi WhatsApp"
                description="Para cuando el envío desde el sistema no está disponible."
              />
              <CardBody>
                <ManualReply
                  leadId={lead.id}
                  phone={lead.phone}
                  initialText={lead.draft?.body ?? ""}
                  draftId={lead.draft?.id ?? null}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Contacto" />
            <CardBody className="space-y-3 text-[14px]">
              {lead.phone ? (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2.5 text-fg hover:text-accent">
                  <Phone className="size-4 text-fg-tertiary" aria-hidden />
                  {lead.phone}
                </a>
              ) : null}
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2.5 text-fg hover:text-accent">
                  <Mail className="size-4 text-fg-tertiary" aria-hidden />
                  {lead.email}
                </a>
              ) : null}

              {lead.device ? (
                <div className="rounded-[12px] border border-line-subtle p-3.5">
                  <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-fg-tertiary">
                    <Smartphone className="size-3.5" aria-hidden />
                    Consultó por
                  </p>
                  <p className="font-medium text-fg">{lead.device.title}</p>
                  <p className="text-[13px] text-fg-secondary">
                    {[lead.device.storageGb ? formatStorage(lead.device.storageGb) : null, lead.device.color, DEVICE_CONDITION_LABELS[lead.device.condition]]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="tabular font-semibold">{formatCurrency(lead.device.salePrice)}</span>
                    <InventoryStatusBadge status={lead.device.inventoryStatus} />
                  </div>
                  <Link href={`/inventario/${lead.device.id}`} className="mt-2 inline-flex items-center gap-1 text-[13px] text-accent hover:underline">
                    Ver en el inventario
                    <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                </div>
              ) : null}

              {lead.canReassign ? (
                <div className="pt-1">
                  <p className="mb-1.5 text-[12px] font-medium text-fg-tertiary">Responsable</p>
                  <ReassignForm leadId={lead.id} current={lead.assigneeId} people={people} />
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Seguimiento" description={`En “${LEAD_STAGE_LABELS[lead.stage]}” desde el ${formatDateTime(lead.stageChangedAt)}`} />
            <CardBody>
              <FollowForm
                leadId={lead.id}
                initial={{
                  stage: lead.stage,
                  nextContactDate: nextDate,
                  nextContactNote: lead.nextContactNote ?? "",
                  pauseReason: lead.pauseReason ?? "",
                  lostReason: lead.lostReason ?? "",
                  manualPriority: lead.manualPriority,
                  interestNote: lead.interestNote ?? "",
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notas internas" description="Solo las ve el equipo." />
            <CardBody>
              <NotesPanel leadId={lead.id} notes={lead.notes} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Historial de etapas" />
            <CardBody>
              <ul className="space-y-2.5 text-[13px]">
                {lead.stageChanges.map((change) => (
                  <li key={change.id} className="flex items-baseline justify-between gap-3">
                    <span className="text-fg">
                      {change.fromStage ? `${LEAD_STAGE_LABELS[change.fromStage]} → ` : "Entró como "}
                      <b>{LEAD_STAGE_LABELS[change.toStage]}</b>
                    </span>
                    <span className="shrink-0 text-fg-tertiary">
                      {formatDateTime(change.createdAt)}
                      {change.userName ? ` · ${change.userName}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
