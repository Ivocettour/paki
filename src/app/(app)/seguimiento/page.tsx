import Link from "next/link";
import { KanbanSquare, Plus } from "lucide-react";
import { getBoard, getMyDay, listAssignable, type BoardCard } from "@/lib/services/leads/queries";
import { boardFiltersSchema } from "@/lib/validations/leads";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { dueInfo } from "@/lib/domain/follow-up";
import { LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS, LEAD_STAGE_ORDER } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { DueChip, PriorityBadge } from "@/components/leads/badges";
import { cn } from "@/lib/utils";
import { BoardFilters } from "./board-filters";

export const metadata = { title: "Seguimiento" };

/// Tarjetas visibles por columna: el resto se ve en la bandeja.
const COLUMN_LIMIT = 12;

export default async function SeguimientoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = boardFiltersSchema.safeParse(flat);
  const filters = parsed.success ? parsed.data : {};

  const [board, myDay, user] = await Promise.all([getBoard(filters), getMyDay(), getCurrentUser()]);
  const canManage = can(user?.role, "consultas.gestionar");
  const people = board.seesAll ? await listAssignable() : [];

  const byStage = new Map<string, BoardCard[]>();
  for (const stage of LEAD_STAGE_ORDER) byStage.set(stage, []);
  for (const card of board.cards) byStage.get(card.stage)!.push(card);

  const dayToday = myDay.list.filter((l) => dueInfo(l.nextContactAt).status === "today").length;
  const dayOverdue = myDay.list.length - dayToday;

  return (
    <>
      <PageHeader
        title="Seguimiento"
        description="Cada consulta tiene una etapa, un responsable y una fecha de próximo contacto. Nadie se pierde."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/seguimiento/nuevo">
              <Button>
                <Plus className="size-4" aria-hidden />
                Cargar contacto
              </Button>
            </Link>
            {canManage ? (
              <>
                <Link href="/seguimiento/equipo">
                  <Button variant="secondary">Equipo y carga</Button>
                </Link>
                <Link href="/seguimiento/avisos">
                  <Button variant="secondary">Avisos diarios</Button>
                </Link>
              </>
            ) : null}
          </div>
        }
      />

      <Card className="mb-5">
        <CardHeader
          title={myDay.mine ? "Mi día" : "Hoy en el equipo"}
          action={
            <div className="flex gap-2 text-[12px] font-medium">
              <span className={cn("rounded-full px-2.5 py-0.5", dayToday ? "bg-warning-soft text-warning" : "bg-surface-subtle text-fg-tertiary")}>
                {dayToday} para hoy
              </span>
              <span className={cn("rounded-full px-2.5 py-0.5", dayOverdue ? "bg-danger-soft text-danger" : "bg-surface-subtle text-fg-tertiary")}>
                {dayOverdue} vencidos
              </span>
            </div>
          }
        />
        {myDay.list.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-fg-secondary">
            No tenés contactos vencidos ni para hoy. Buen momento para avanzar con los que están en pausa.
          </p>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {myDay.list.slice(0, 6).map((lead) => (
              <li key={lead.id}>
                <Link href={`/consultas/${lead.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-surface-muted">
                  <span className="text-[14px] font-medium text-fg">{lead.fullName}</span>
                  <span className="text-[13px] text-fg-secondary">
                    {LEAD_STAGE_LABELS[lead.stage]}
                    {lead.deviceName ? ` · ${lead.deviceName}` : ""}
                    {lead.nextContactNote ? ` · ${lead.nextContactNote}` : ""}
                    {!myDay.mine && lead.assigneeName ? ` · ${lead.assigneeName}` : ""}
                  </span>
                  <DueChip next={lead.nextContactAt} className="ml-auto" />
                </Link>
              </li>
            ))}
            {myDay.list.length > 6 ? (
              <li className="px-5 py-3 text-[13px] text-fg-tertiary">…y {myDay.list.length - 6} más en el tablero.</li>
            ) : null}
          </ul>
        )}
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Abiertas" value={String(board.open)} hint="sin contar vendidas ni perdidas" />
        <StatCard label="Para hoy" value={String(board.today)} tone={board.today ? "warning" : "neutral"} />
        <StatCard label="Vencidas" value={String(board.overdue)} tone={board.overdue ? "danger" : "neutral"} />
      </div>

      <BoardFilters seesAll={board.seesAll} people={people} />

      {board.cards.length === 0 ? (
        <Card>
          <EmptyState
            icon={KanbanSquare}
            title="No hay consultas para mostrar"
            description="Cuando alguien consulte desde la tienda o por WhatsApp, va a aparecer en la primera columna."
          />
        </Card>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="grid min-w-[1100px] grid-cols-6 gap-3">
            {LEAD_STAGE_ORDER.map((stage) => {
              const cards = byStage.get(stage) ?? [];
              return (
                <section key={stage} aria-label={LEAD_STAGE_LABELS[stage]} className="min-w-0 rounded-[18px] bg-surface-subtle p-2.5">
                  <h2 className="mb-2.5 flex items-center justify-between px-1.5 pt-1 text-[13px] font-semibold text-fg">
                    {LEAD_STAGE_LABELS[stage]}
                    <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[12px] font-medium text-fg-secondary">
                      {cards.length}
                    </span>
                  </h2>

                  <ul className="space-y-2">
                    {cards.slice(0, COLUMN_LIMIT).map((card) => {
                      const due = dueInfo(card.nextContactAt).status;
                      return (
                        <li key={card.id}>
                          <Link
                            href={`/consultas/${card.id}`}
                            className={cn(
                              "block rounded-[14px] border bg-surface-raised p-3 transition-shadow hover:shadow-[var(--shadow-card)]",
                              due === "overdue" ? "border-danger/50" : due === "today" ? "border-warning/60" : "border-line-subtle",
                            )}
                          >
                            <p className="truncate text-[14px] font-medium text-fg">{card.fullName}</p>
                            {card.deviceName ? <p className="truncate text-[12px] text-fg-secondary">{card.deviceName}</p> : null}
                            <p className="mt-1 text-[11px] text-fg-tertiary">
                              {LEAD_SOURCE_LABELS[card.source as keyof typeof LEAD_SOURCE_LABELS]}
                              {card.assigneeName ? ` · ${card.assigneeName}` : ""}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <DueChip next={card.nextContactAt} />
                              {card.needsReply ? (
                                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Sin responder</span>
                              ) : null}
                              <PriorityBadge priority={card.priority} />
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  {cards.length > COLUMN_LIMIT ? (
                    <p className="px-1.5 pt-2 text-[12px] text-fg-tertiary">
                      …y {cards.length - COLUMN_LIMIT} más. Mirá todas en{" "}
                      <Link href="/consultas?show=todas" className="text-accent hover:underline">
                        Consultas
                      </Link>
                      .
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
