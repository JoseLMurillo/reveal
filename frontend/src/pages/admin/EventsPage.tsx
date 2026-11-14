import { EVENT_STATUSES, type EventStatus } from "@rollo/shared";
import { useQuery } from "@tanstack/react-query";
import { Camera, ChevronLeft, ChevronRight, Plus, Search, Users } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/admin/Feedback";
import { PageHeader } from "@/components/admin/PageHeader";
import { eventStatusLabel } from "@/utils/event-status";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { fieldInputClass, fieldLabelClass } from "@/components/admin/form";
import { vintageButtonStyles } from "@/components/common/vintage-button.styles";
import { adminApi } from "@/services/admin";
import { formatDateRange, formatNumber } from "@/utils/format";

const PAGE_SIZE = 20;

export function EventsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EventStatus | "">("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const query = useQuery({
    queryKey: ["admin", "events", page, status, deferredSearch],
    queryFn: () =>
      adminApi.listEvents({
        page,
        limit: PAGE_SIZE,
        status: status === "" ? undefined : status,
        search: deferredSearch.trim() || undefined,
      }),
  });

  const events = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Eventos"
        title="Tus rollos"
        description="Cada evento guarda su propia configuración, participantes y fotografías."
        actions={
          <Link to="/admin/events/new" className={vintageButtonStyles()}>
            <Plus aria-hidden="true" className="size-4" />
            Nuevo evento
          </Link>
        }
      />

      <div className="grid gap-3 border border-border bg-paper-raised p-3 sm:grid-cols-[1fr_14rem]">
        <div>
          <label htmlFor="event-search" className={fieldLabelClass}>
            Buscar
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <input
              id="event-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Nombre o slug"
              className={`${fieldInputClass} pl-9`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="event-status" className={fieldLabelClass}>
            Estado
          </label>
          <select
            id="event-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as EventStatus | "");
              setPage(1);
            }}
            className={fieldInputClass}
          >
            <option value="">Todos</option>
            {EVENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {eventStatusLabel(value)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {query.isPending ? (
        <LoadingBlock label="Cargando eventos…" />
      ) : query.isError ? (
        <ErrorBlock
          message="No se pudieron cargar los eventos."
          onRetry={() => void query.refetch()}
        />
      ) : events.length === 0 ? (
        <EmptyState
          title={deferredSearch || status ? "Sin resultados" : "Todavía no hay eventos"}
          description={
            deferredSearch || status
              ? "Prueba con otro nombre o cambia el filtro de estado."
              : "Crea el primer evento para empezar a repartir disparos."
          }
          action={
            <Link to="/admin/events/new" className={vintageButtonStyles()}>
              <Plus aria-hidden="true" className="size-4" />
              Crear evento
            </Link>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto border border-border md:block">
            <table className="w-full min-w-[54rem] border-collapse text-left">
              <caption className="sr-only">Listado de eventos</caption>
              <thead className="bg-cream/45">
                <tr className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-brown">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Evento
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Fechas
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Participantes
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Fotos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-paper-raised">
                {events.map((event) => (
                  <tr key={event.id} className="align-middle">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/events/${event.id}`}
                        className="focus-film rounded-sm font-semibold hover:underline"
                      >
                        {event.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-caption text-muted">{event.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={event.status} />
                    </td>
                    <td className="px-4 py-3 text-body-sm text-brown">
                      {formatDateRange(event.startDate, event.endDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-body-sm">
                      {formatNumber(event.participants)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-body-sm">
                      {formatNumber(event.photos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {events.map((event) => (
              <li key={event.id} className="paper-card p-4">
                <Link to={`/admin/events/${event.id}`} className="focus-film block rounded-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-body font-semibold">{event.name}</h2>
                    <StatusBadge status={event.status} />
                  </div>
                  <p className="mt-1 font-mono text-caption text-muted">{event.slug}</p>
                  <p className="mt-2 text-body-sm text-brown">
                    {formatDateRange(event.startDate, event.endDate)}
                  </p>
                  <div className="mt-3 flex gap-4 text-caption text-brown">
                    <span className="flex items-center gap-1">
                      <Users aria-hidden="true" className="size-3.5" />
                      {formatNumber(event.participants)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Camera aria-hidden="true" className="size-3.5" />
                      {formatNumber(event.photos)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {meta && meta.totalPages > 1 ? (
            <nav
              aria-label="Paginación de eventos"
              className="flex items-center justify-between gap-3 border-t border-border pt-4"
            >
              <p className="font-mono text-caption uppercase tracking-[0.1em] text-muted">
                Página {meta.page} de {meta.totalPages} · {formatNumber(meta.total)} eventos
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={meta.page <= 1}
                  className={vintageButtonStyles({ variant: "ghost" })}
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
                  disabled={meta.page >= meta.totalPages}
                  className={vintageButtonStyles({ variant: "ghost" })}
                >
                  Siguiente
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
