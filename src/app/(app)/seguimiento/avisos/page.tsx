import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BellRing } from "lucide-react";
import { listDigests } from "@/lib/services/leads/digest";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";
import { GenerateDigestButton } from "./generate-button";

export const metadata = { title: "Avisos diarios" };

export default async function AvisosPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "consultas.gestionar")) redirect("/seguimiento");

  const digests = await listDigests();
  const cronReady = (process.env.CRON_SECRET ?? "").length >= 16;

  return (
    <>
      <Link href="/seguimiento" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-fg-secondary hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        Volver al seguimiento
      </Link>

      <PageHeader
        title="Avisos diarios"
        description="Cada responsable recibe lo que vence hoy y lo vencido. Si no hay nada, no se manda nada."
        action={<GenerateDigestButton />}
      />

      <Card className="mb-5">
        <CardBody className="space-y-2 text-[13px] text-fg-secondary">
          <p>
            <b className="text-fg">Por ahora los avisos quedan registrados acá</b> y no se mandan por
            correo: todavía no hay un proveedor de correo conectado.
          </p>
          <p>
            Para que se generen solos cada mañana, un programador externo tiene que llamar a este
            endpoint (en Vercel, con un Cron Job a las 11:00 UTC = 8:00 de Buenos Aires):
          </p>
          <pre className="overflow-x-auto rounded-[10px] bg-surface-subtle px-3 py-2 text-[12px] text-fg">
            curl -X POST -H &quot;Authorization: Bearer $CRON_SECRET&quot; {"<tu-dominio>"}/api/cron/daily-digest
          </pre>
          <p className={cronReady ? "text-success" : "text-warning"}>
            {cronReady
              ? "CRON_SECRET está configurado."
              : "CRON_SECRET no está configurado (16 caracteres o más): el endpoint está cerrado."}
          </p>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Últimos avisos" />
        {digests.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="Todavía no se generó ningún aviso"
            description="Usá “Generar los avisos de hoy” para ver cómo quedan."
          />
        ) : (
          <ul className="divide-y divide-line-subtle">
            {digests.map((digest) => (
              <li key={digest.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[14px] font-medium text-fg">
                    {digest.userName} · {digest.subject}
                  </p>
                  <span className="text-[12px] text-fg-tertiary">{formatDateTime(digest.createdAt)}</span>
                </div>
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[13px] text-accent">Ver el aviso</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-[10px] bg-surface-subtle px-3.5 py-3 text-[13px] text-fg">
                    {digest.body}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
