import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  HardDrive,
  Images,
  LoaderCircle,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState, ErrorBlock, InlineAlert, LoadingBlock } from "@/components/admin/Feedback";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { fieldInputClass, fieldLabelClass } from "@/components/admin/form";
import { PhotoLightbox, type LightboxPhoto } from "@/components/common/PhotoLightbox";
import { VintageButton } from "@/components/common/VintageButton";
import { vintageButtonStyles } from "@/components/common/vintage-button.styles";
import { adminApi } from "@/services/admin";
import { ApiError } from "@/services/api";
import { formatBytes, formatDate, formatDateTime, formatNumber } from "@/utils/format";

const PAGE_SIZE = 24;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function EventPhotosPage() {
  const { id = "" } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [day, setDay] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxPhoto | null>(null);

  const stats = useQuery({
    queryKey: ["admin", "event", id, "statistics"],
    queryFn: () => adminApi.photoStats(id),
    enabled: id.length > 0,
  });

  const photos = useQuery({
    queryKey: ["admin", "event", id, "photos", page, day, deferredSearch, includeDeleted],
    queryFn: () =>
      adminApi.listPhotos(id, {
        page,
        limit: PAGE_SIZE,
        day: day.length > 0 ? day : undefined,
        search: deferredSearch.length > 0 ? deferredSearch : undefined,
        includeDeleted,
      }),
    enabled: id.length > 0,
  });

  const activity = useQuery({
    queryKey: ["admin", "event", id, "activity", 1],
    queryFn: () => adminApi.activity(id, { page: 1, limit: 8 }),
    enabled: id.length > 0,
  });

  const remove = useMutation({
    mutationFn: (photoId: string) => adminApi.deletePhoto(photoId),
    async onSuccess() {
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "event", id, "photos"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "event", id, "statistics"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "event", id, "activity"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "event", id] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
    },
  });

  if (stats.isPending) {
    return <LoadingBlock label="Cargando las fotografías del evento…" />;
  }

  if (stats.isError || !stats.data) {
    return (
      <div className="space-y-4">
        <PageHeader kicker="Fotografías" title="Evento no disponible" />
        <ErrorBlock message="El evento no existe o no tienes acceso." />
        <Link to="/admin/events" className={vintageButtonStyles({ variant: "ghost" })}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a eventos
        </Link>
      </div>
    );
  }

  const data = stats.data;
  const totalPages = photos.data?.meta.totalPages ?? 0;
  const selected = photos.data?.data.find((photo) => photo.id === pendingDelete) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Fotografías del evento"
        title={data.event.name}
        description="Originales confirmados, estadísticas por día y actividad reciente."
        actions={
          <>
            <Link to={`/admin/events/${id}`} className={vintageButtonStyles({ variant: "ghost" })}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Evento
            </Link>
            <Link
              to={`/admin/events/${id}/participants`}
              className={vintageButtonStyles({ variant: "ghost" })}
            >
              <Users aria-hidden="true" className="size-4" />
              Participantes
            </Link>
          </>
        }
      />

      <section className="paper-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={data.event.status} />
          <p className="font-mono text-caption text-muted">{id}</p>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {[
            {
              label: "Participantes",
              value: formatNumber(data.totals.participants),
              icon: Users,
            },
            {
              label: "Anónimos",
              value: formatNumber(data.totals.anonymousParticipants),
              icon: Users,
            },
            {
              label: "Fotos activas",
              value: formatNumber(data.totals.photos),
              icon: Images,
            },
            {
              label: "Fotos hoy",
              value: formatNumber(data.totals.photosToday),
              icon: CalendarDays,
            },
            {
              label: "Espacio usado",
              value: formatBytes(data.totals.storageBytes),
              icon: HardDrive,
            },
            {
              label: "Borradas",
              value: formatNumber(data.totals.deletedPhotos),
              icon: Trash2,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label}>
              <dt className="flex items-center gap-1.5 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-muted">
                <Icon aria-hidden="true" className="size-3" />
                {label}
              </dt>
              <dd className="mt-1 font-display text-[1.6rem] font-semibold leading-none">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <section className="paper-card p-5" aria-labelledby="photos-list-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="editorial-kicker">Archivo</p>
              <h2 id="photos-list-title" className="mt-1 text-heading-sm font-semibold">
                Fotografías
              </h2>
              <p className="mt-1 text-body-sm text-brown">
                {formatNumber(photos.data?.meta.total ?? 0)} resultado
                {(photos.data?.meta.total ?? 0) === 1 ? "" : "s"}.
              </p>
            </div>
            {photos.isFetching ? (
              <span className="flex items-center gap-2 font-mono text-caption uppercase tracking-[0.1em] text-muted">
                <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                Actualizando
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="photo-search" className={fieldLabelClass}>
                Participante
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                />
                <input
                  id="photo-search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Nombre"
                  className={`${fieldInputClass} pl-9`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="photo-day" className={fieldLabelClass}>
                Día
              </label>
              <input
                id="photo-day"
                type="date"
                value={day}
                onChange={(event) => {
                  setDay(event.target.value);
                  setPage(1);
                }}
                className={fieldInputClass}
              />
            </div>

            <label className="flex items-center gap-2 self-end pb-2 text-body-sm text-brown">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => {
                  setIncludeDeleted(event.target.checked);
                  setPage(1);
                }}
                className="size-4 accent-ink"
              />
              Incluir borradas
            </label>
          </div>

          {photos.isPending ? (
            <p className="flex items-center gap-2 py-8 text-body-sm text-brown" role="status">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              Cargando fotografías…
            </p>
          ) : photos.isError ? (
            <InlineAlert className="mt-4" tone="error">
              {messageOf(photos.error, "No se pudieron cargar las fotografías.")}
            </InlineAlert>
          ) : (photos.data?.data.length ?? 0) === 0 ? (
            <EmptyState
              title="Sin fotografías"
              description="Las fotos confirmadas por los participantes aparecerán aquí."
            />
          ) : (
            <>
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.data?.data.map((photo) => (
                  <li
                    key={photo.id}
                    className="overflow-hidden rounded-sm border border-border bg-paper"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          url: photo.url,
                          originalFilename: photo.originalFilename,
                          caption: `${photo.participant.displayName ?? "Anónimo"} · ${formatDate(
                            photo.eventDay,
                          )} · ${formatBytes(photo.fileSize)}`,
                        })
                      }
                      className="focus-film block w-full"
                      aria-label={`Ampliar ${photo.originalFilename}`}
                    >
                      <img
                        src={photo.url}
                        alt={photo.originalFilename}
                        loading="lazy"
                        className={`aspect-square w-full object-cover ${
                          photo.status === "deleted" ? "opacity-45 grayscale" : ""
                        }`}
                      />
                    </button>
                    <div className="space-y-1 p-2">
                      <p
                        className="truncate text-caption text-brown"
                        title={photo.originalFilename}
                      >
                        {photo.originalFilename}
                      </p>
                      <p className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">
                        {formatDate(photo.eventDay)} · {formatBytes(photo.fileSize)}
                      </p>
                      <p className="truncate text-[0.68rem] text-brown">
                        {photo.participant.displayName ?? "Anónimo"}
                      </p>
                      <div className="flex items-center justify-between gap-1 pt-1">
                        <span
                          className={`font-mono text-[0.6rem] uppercase tracking-[0.08em] ${
                            photo.status === "active" ? "text-success" : "text-warning"
                          }`}
                        >
                          {photo.status === "active" ? "Activa" : "Borrada"}
                        </span>
                        <div className="flex gap-1">
                          {photo.status === "active" ? (
                            <a
                              href={adminApi.downloadPhotoUrl(id, photo.id)}
                              className="focus-film grid size-8 place-items-center rounded-sm border border-border text-ink hover:bg-cream"
                              aria-label={`Descargar ${photo.originalFilename}`}
                            >
                              <Download className="size-3.5" />
                            </a>
                          ) : null}
                          {photo.status === "active" ? (
                            <button
                              type="button"
                              onClick={() => setPendingDelete(photo.id)}
                              className="focus-film grid size-8 place-items-center rounded-sm border border-border text-warning hover:bg-warning/10"
                              aria-label={`Borrar ${photo.originalFilename}`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {totalPages > 1 ? (
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                  <VintageButton
                    variant="ghost"
                    onClick={() => setPage((value) => Math.max(value - 1, 1))}
                    disabled={page <= 1 || photos.isFetching}
                  >
                    Anterior
                  </VintageButton>
                  <p className="font-mono text-caption uppercase tracking-[0.1em] text-muted">
                    Página {page} de {totalPages}
                  </p>
                  <VintageButton
                    variant="ghost"
                    onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
                    disabled={page >= totalPages || photos.isFetching}
                  >
                    Siguiente
                  </VintageButton>
                </div>
              ) : null}
            </>
          )}
        </section>

        <aside className="space-y-5">
          <section className="paper-card p-5" aria-labelledby="photos-by-day">
            <h2 id="photos-by-day" className="text-heading-sm font-semibold">
              Por día
            </h2>
            <ul className="mt-3 space-y-2">
              {data.byDay.map((item) => (
                <li
                  key={item.eventDay}
                  className="flex items-center justify-between gap-3 border-b border-border pb-2 text-body-sm last:border-0 last:pb-0"
                >
                  <span>
                    Día {item.dayNumber} · {formatDate(item.eventDay)}
                  </span>
                  <span className="font-mono text-caption text-muted">
                    {formatNumber(item.photos)} fotos · {formatNumber(item.participants)} pers.
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="paper-card p-5" aria-labelledby="photos-top">
            <h2 id="photos-top" className="text-heading-sm font-semibold">
              Más activos
            </h2>
            {data.topParticipants.length === 0 ? (
              <p className="mt-2 text-body-sm text-brown">Todavía no hay fotos confirmadas.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {data.topParticipants.map((item, index) => (
                  <li
                    key={item.participantId}
                    className="flex items-center justify-between gap-3 text-body-sm"
                  >
                    <span className="truncate">
                      {index + 1}. {item.displayName ?? "Anónimo"}
                    </span>
                    <span className="font-mono text-caption text-muted">
                      {formatNumber(item.photos)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="paper-card p-5" aria-labelledby="photos-activity">
            <h2 id="photos-activity" className="text-heading-sm font-semibold">
              Actividad reciente
            </h2>
            {activity.isPending ? (
              <p className="mt-2 flex items-center gap-2 text-caption text-muted">
                <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                Cargando…
              </p>
            ) : activity.isError ? (
              <p className="mt-2 text-caption text-warning">No se pudo cargar la actividad.</p>
            ) : (activity.data?.data.length ?? 0) === 0 ? (
              <p className="mt-2 text-body-sm text-brown">Sin actividad registrada.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {activity.data?.data.map((entry) => (
                  <li
                    key={entry.id}
                    className="border-b border-border pb-2 last:border-0 last:pb-0"
                  >
                    <p className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-brown">
                      {entry.action}
                    </p>
                    <p className="text-caption text-muted">{formatDateTime(entry.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {remove.isError ? (
        <InlineAlert tone="error">
          {messageOf(remove.error, "No se pudo borrar la fotografía.")}
        </InlineAlert>
      ) : null}

      <PhotoLightbox photo={lightbox} onClose={() => setLightbox(null)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Borrar la fotografía"
        description="Se ocultará del evento y el original se encolará para limpieza de Storage. La cuota del participante se libera. El archivo original no se modifica."
        confirmLabel="Borrar foto"
        pending={remove.isPending}
        onClose={() => {
          if (!remove.isPending) {
            setPendingDelete(null);
          }
        }}
        onConfirm={() => {
          if (pendingDelete) {
            remove.mutate(pendingDelete);
          }
        }}
      >
        {selected ? (
          <p className="text-body-sm text-brown">
            {selected.originalFilename} · {selected.participant.displayName ?? "Anónimo"} ·{" "}
            {formatDate(selected.eventDay)}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
