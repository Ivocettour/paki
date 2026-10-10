import Link from "next/link";
import { Inbox, MessageCircle, Plus, Smartphone } from "lucide-react";
import { listInbox } from "@/lib/services/leads/queries";
import { inboxFiltersSchema } from "@/lib/validations/leads";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { PriorityBadge, StageBadge } from "@/components/leads/badges";
import { initials, timeAgo, cn } from "@/lib/utils";
import { InboxFilters } from "./inbox-filters";

export const metadata = { title: "Consultas" };

export default async function ConsultasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = inboxFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : inboxFiltersSchema.parse({});

  const [result, user] = await Promise.all([listInbox(filters), getCurrentUser()]);
  const canManage = can(user?.role, "consultas.gestionar");

  return (
    <>
      <PageHeader
        title="Consultas"
        description="Los mensajes de la tienda y de WhatsApp, en un solo lugar."
        action={
          <div className="flex gap-2">
            {canManage ? (
              <Link href="/consultas/simulador">
                <Button variant="secondary">Simular un mensaje</Button>
              </Link>
            ) : null}
            <Link href="/consultas/recibido">
              <Button>
                <Plus className="size-4" aria-hidden />
                Anotar mensaje recibido
              </Button>
            </Link>
            <Link href="/seguimiento/nuevo">
              <Button variant="secondary">Cargar contacto</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:max-w-xl">
        <StatCard label="Sin responder" value={String(result.unanswered)} />
        <StatCard label="Nuevas hoy" value={String(result.newToday)} />
      </div>

      <InboxFilters seesAll={result.seesAll} />

      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={filters.show === "sin_responder" ? "No hay consultas sin responder" : "Todavía no hay consultas"}
            description={
              filters.show === "sin_responder"
                ? "Estás al día. Cuando alguien escriba desde la tienda o por WhatsApp, va a aparecer acá."
                : "Las consultas de la tienda y de WhatsApp van a aparecer acá."
            }
          />
        ) : (
          <ul className="divide-y divide-line-subtle">
            {result.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/consultas/${item.id}`}
                  className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-muted"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold",
                      item.needsReply ? "bg-accent text-white" : "bg-surface-subtle text-fg-secondary",
                    )}
                  >
                    {initials(item.fullName.split(" ")[0] ?? "", item.fullName.split(" ")[1] ?? "")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="text-[15px] font-semibold text-fg">{item.fullName}</span>
                      {item.needsReply ? (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                          Esperando respuesta
                        </span>
                      ) : null}
                      <StageBadge stage={item.stage} />
                      <PriorityBadge priority={item.priority} reason={item.priorityReason} />
                    </div>

                    <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-fg-secondary">
                      {item.lastMessage?.direction === "SALIENTE" ? (
                        <span className="shrink-0 text-fg-tertiary">Vos:</span>
                      ) : null}
                      <span className="truncate">{item.lastMessage?.body ?? "Sin mensajes"}</span>
                    </p>

                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-fg-tertiary">
                      {item.deviceName ? (
                        <span className="inline-flex items-center gap-1">
                          <Smartphone className="size-3.5" aria-hidden />
                          {item.deviceName}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="size-3.5" aria-hidden />
                        {item.phone ?? item.email}
                      </span>
                      {result.seesAll ? <span>{item.assigneeName ?? "Sin asignar"}</span> : null}
                    </p>
                  </div>

                  <span className="shrink-0 text-[12px] text-fg-tertiary">
                    {item.lastMessageAt ? timeAgo(item.lastMessageAt) : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {result.total > 0 ? (
          <div className="border-t border-line-subtle">
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              basePath="/consultas"
            />
          </div>
        ) : null}
      </Card>
    </>
  );
}
