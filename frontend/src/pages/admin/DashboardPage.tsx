import type { AdminDashboard } from "@rollo/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Camera, Image, Plus, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/admin/Feedback";
import { vintageButtonStyles } from "@/components/common/vintage-button.styles";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { adminApi } from "@/services/admin";
import { formatDateRange, formatDateTime, formatNumber } from "@/utils/format";

const ACTIVITY_LABELS: Record<string, string> = {
  "admin.login": "inició sesión",
  "admin.logout": "cerró sesión",
  "admin.password_changed": "cambió su contraseña",
  "event.created": "creó un evento",
  "event.updated": "actualizó un evento",
  "event.scheduled": "programó un evento",
  "event.activated": "activó un evento",
  "event.finished": "finalizó un evento",
  "event.cancelled": "canceló un evento",
  "event.duplicated": "duplicó un evento",
  "event.deleted": "eliminó un evento",
  "event.cover_updated": "cambió la portada",
  "event.cover_removed": "quitó la portada",
};

function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action.replaceAll(".", " ");
}

function Totals({ data }: { data: AdminDashboard["totals"] }) {
  const cards = [
    { label: "Eventos", value: data.events, icon: CalendarDays },
    { label: "Activos", value: data.activeEvents, icon: Sparkles },
    { label: "Participantes", value: data.participants, icon: Users },
    { label: "Fotos", value: data.photos, icon: Image },
    { label: "Fotos hoy", value: data.photosToday, icon: Camera },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-paper-raised p-4">
            <dt className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
              <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              {card.label}
            </dt>
            <dd className="mt-2 font-display text-[1.9rem] font-semibold leading-none">
              {formatNumber(card.value)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function DashboardPage() {
  const { admin } = useAdminAuth();
  const dashboard = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: adminApi.dashboard,
  });

  return (
    <div className="space-y-7">
      <PageHeader
        kicker="Panel"
        title={admin ? `Hola, ${admin.displayName}` : "Panel"}
        description="Una vista rápida de los rollos que estás cuidando."
        actions={
          <Link to="/admin/events/new" className={vintageButtonStyles()}>
            <Plus aria-hidden="true" className="size-4" />
            Nuevo evento
          </Link>
        }
      />

      {dashboard.isPending ? (
        <LoadingBlock label="Cargando el panel…" />
      ) : dashboard.isError ? (
        <ErrorBlock
          message="No se pudo cargar el panel."
          onRetry={() => void dashboard.refetch()}
        />
      ) : (
        <>
          <Totals data={dashboard.data.totals} />

          <div className="grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
            <section aria-labelledby="dashboard-events">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="dashboard-events" className="text-heading-sm font-semibold">
                  Eventos
                </h2>
                <Link
                  to="/admin/events"
                  className="focus-film inline-flex items-center gap-1 rounded-sm font-mono text-caption uppercase tracking-[0.12em] text-brown hover:text-ink"
                >
                  Ver todos
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>

              {dashboard.data.events.length === 0 ? (
                <EmptyState
                  title="Todavía no hay eventos"
                  description="Crea el primer rollo, configura la cuota diaria y comparte su QR cuando esté listo."
                  action={
                    <Link to="/admin/events/new" className={vintageButtonStyles()}>
                      <Plus aria-hidden="true" className="size-4" />
                      Crear evento
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-border border-y border-border">
                  {dashboard.data.events.map((event) => (
                    <li key={event.id}>
                      <Link
                        to={`/admin/events/${event.id}`}
                        className="focus-film group grid gap-3 rounded-sm py-4 transition-colors hover:bg-cream/30 sm:grid-cols-[1fr_auto] sm:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {event.coverUrl ? (
                            <img
                              src={event.coverUrl}
                              alt=""
                              className="size-14 shrink-0 rounded-sm border border-border object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="grid size-14 shrink-0 place-items-center rounded-sm border border-border bg-cream/40 text-brown">
                              <Image aria-hidden="true" className="size-5" strokeWidth={1.5} />
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-body font-semibold group-hover:underline">
                                {event.name}
                              </h3>
                              <StatusBadge status={event.status} />
                            </div>
                            <p className="mt-1 truncate font-mono text-caption text-muted">
                              {formatDateRange(event.startDate, event.endDate)} · {event.slug}
                            </p>
                          </div>
                        </div>
                        <dl className="flex items-center gap-4 pl-[4.25rem] text-caption text-brown sm:justify-end sm:pl-0">
                          <div>
                            <dt className="sr-only">Participantes</dt>
                            <dd className="flex items-center gap-1">
                              <Users aria-hidden="true" className="size-3.5" />
                              {formatNumber(event.participants)}
                            </dd>
                          </div>
                          <div>
                            <dt className="sr-only">Fotos</dt>
                            <dd className="flex items-center gap-1">
                              <Camera aria-hidden="true" className="size-3.5" />
                              {formatNumber(event.photos)}
                            </dd>
                          </div>
                          <div>
                            <dt className="sr-only">Fotos de hoy</dt>
                            <dd className="font-mono uppercase tracking-[0.08em]">
                              +{formatNumber(event.photosToday)} hoy
                            </dd>
                          </div>
                          <div>
                            <dt className="sr-only">Lugares restantes</dt>
                            <dd className="font-mono uppercase tracking-[0.08em]">
                              {event.remainingSlots === null
                                ? "Sin cupo"
                                : `${formatNumber(event.remainingSlots)} plazas`}
                            </dd>
                          </div>
                        </dl>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="dashboard-activity" className="paper-card p-5">
              <h2 id="dashboard-activity" className="text-heading-sm font-semibold">
                Actividad reciente
              </h2>
              {dashboard.data.recentActivity.length === 0 ? (
                <p className="mt-3 text-body-sm text-brown">
                  Las acciones administrativas aparecerán aquí.
                </p>
              ) : (
                <ol className="mt-4 space-y-4">
                  {dashboard.data.recentActivity.map((entry) => (
                    <li key={entry.id} className="border-l border-border pl-3">
                      <p className="text-body-sm">
                        <span className="font-medium">{activityLabel(entry.action)}</span>
                        {entry.eventName ? (
                          <span className="text-brown"> · {entry.eventName}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">
                        {formatDateTime(entry.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
