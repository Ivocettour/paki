import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { getChannelsStatus } from "@/lib/services/leads/channels";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Canales" };

const OUTCOME_TONE = { ok: "success", ignored: "neutral", error: "danger", rejected: "danger" } as const;

export default async function CanalesPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "consultas.gestionar")) redirect("/");

  const status = await getChannelsStatus();
  const { whatsapp, ai, cron } = status;

  return (
    <>
      <PageHeader
        title="Canales"
        description="Por dónde entran y salen los mensajes, y qué falta configurar."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="WhatsApp"
            action={
              whatsapp.mode === "live" ? (
                <Badge tone={whatsapp.ready ? "success" : "warning"}>{whatsapp.ready ? "Listo" : "Incompleto"}</Badge>
              ) : (
                <Badge tone="neutral">Simulado</Badge>
              )
            }
          />
          <CardBody className="space-y-3 text-[13px] text-fg-secondary">
            {whatsapp.mode === "mock" ? (
              <p>
                No se envía nada a nadie: los mensajes quedan en la bandeja y en el log del servidor.
                Para conectar WhatsApp real definí <code>WHATSAPP_MODE=&quot;live&quot;</code> y las claves de Meta (ver README).
              </p>
            ) : whatsapp.missing.length > 0 ? (
              <p className="text-warning">Faltan variables: {whatsapp.missing.join(", ")}.</p>
            ) : (
              <p className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="size-4" aria-hidden />
                Todo configurado.
              </p>
            )}

            <div>
              <p className="font-medium text-fg">URL del webhook</p>
              <code className="break-all text-[12px]">{whatsapp.webhookUrl}</code>
            </div>

            {whatsapp.verifyToken ? (
              <div>
                <p className="font-medium text-fg">Token de verificación</p>
                <code className="break-all text-[12px]">{whatsapp.verifyToken}</code>
              </div>
            ) : null}

            <div>
              <p className="font-medium text-fg">Plantillas ({whatsapp.templates.length})</p>
              {whatsapp.templates.length === 0 ? (
                <p className="text-warning">
                  Ninguna configurada: fuera de las 24 horas no se le puede escribir a nadie.
                </p>
              ) : (
                <ul className="mt-1 list-disc pl-4">
                  {whatsapp.templates.map((t) => (
                    <li key={t.key}>
                      {t.label} <span className="text-fg-tertiary">({t.name})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Inteligencia artificial"
            action={<Badge tone={ai.mode === "groq" ? "success" : "neutral"}>{ai.mode === "groq" ? "Groq" : "Simulada"}</Badge>}
          />
          <CardBody className="space-y-2 text-[13px] text-fg-secondary">
            {ai.mode === "groq" ? (
              <p>
                Los borradores los escribe <b className="text-fg">{ai.model}</b>. Si la IA falla, se usa un borrador simple y se
                avisa en pantalla.
              </p>
            ) : (
              <p>
                Sin <code>GROQ_API_KEY</code> se usa un asistente simple con plantillas. Funciona, pero no escribe tan bien.
              </p>
            )}
            <p>La IA nunca envía nada: solo prepara borradores que revisa y manda una persona.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Avisos diarios"
            action={<Badge tone={cron.configured ? "success" : "warning"}>{cron.configured ? "Listo" : "Sin configurar"}</Badge>}
          />
          <CardBody className="space-y-2 text-[13px] text-fg-secondary">
            <p>
              El endpoint <code>/api/cron/daily-digest</code> está {cron.configured ? "abierto con tu CRON_SECRET" : "cerrado"}.
            </p>
            {!cron.configured ? (
              <p className="flex items-start gap-1.5 text-warning">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                Definí <code>CRON_SECRET</code> (16 caracteres o más) y programá la llamada diaria.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader title="Últimos avisos recibidos" description="Lo que llegó por los webhooks, para diagnosticar." />
        {status.log.length === 0 ? (
          <p className="px-5 py-6 text-[14px] text-fg-tertiary">Todavía no llegó nada.</p>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {status.log.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-[13px]">
                <Badge tone={OUTCOME_TONE[entry.outcome as keyof typeof OUTCOME_TONE] ?? "neutral"}>{entry.outcome}</Badge>
                <span className="text-fg">
                  {entry.source}
                  {entry.kind ? ` · ${entry.kind}` : ""}
                </span>
                {!entry.signatureOk ? <Badge tone="danger">firma inválida</Badge> : null}
                <span className="text-fg-secondary">{entry.detail}</span>
                <span className="ml-auto text-fg-tertiary">{formatDateTime(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
