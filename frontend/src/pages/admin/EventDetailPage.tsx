import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarRange,
  Copy,
  ExternalLink,
  Images,
  Pencil,
  Play,
  QrCode,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { CoverManager } from "@/components/admin/CoverManager";
import { ErrorBlock, InlineAlert, LoadingBlock } from "@/components/admin/Feedback";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { VintageButton } from "@/components/common/VintageButton";
import { vintageButtonStyles } from "@/components/common/vintage-button.styles";
import { ApiError } from "@/services/api";
import { adminApi } from "@/services/admin";
import { formatDateRange, formatNumber } from "@/utils/format";

const VISIBILITY_LABELS = {
  private: "Privada",
  participants: "Solo participantes",
  public: "Pública",
} as const;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function EventDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const detail = useQuery({
    queryKey: ["admin", "event", id],
    queryFn: () => adminApi.detail(id),
    enabled: id.length > 0,
  });

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ["admin", "event", id] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
  }

  const transition = useMutation({
    mutationFn: (kind: "schedule" | "activate" | "finish") => {
      if (kind === "schedule") return adminApi.schedule(id);
      if (kind === "activate") return adminApi.activate(id);
      return adminApi.finish(id);
    },
    async onSuccess(updated) {
      queryClient.setQueryData(["admin", "event", id], updated);
      await refresh();
    },
  });

  const cancel = useMutation({
    mutationFn: (reason: string) => adminApi.cancel(id, { reason }),
    async onSuccess(updated) {
      queryClient.setQueryData(["admin", "event", id], updated);
      setCancelOpen(false);
      setCancelReason("");
      await refresh();
    },
  });

  const duplicate = useMutation({
    mutationFn: () => adminApi.duplicate(id),
    async onSuccess(copy) {
      await queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      navigate(`/admin/events/${copy.id}`);
    },
  });

  const remove = useMutation({
    mutationFn: (name: string) => adminApi.remove(id, name),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      navigate("/admin/events", { replace: true });
    },
  });

  if (detail.isPending) {
    return <LoadingBlock label="Cargando el evento…" />;
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="space-y-4">
        <PageHeader kicker="Eventos" title="Evento no disponible" />
        <ErrorBlock message="El evento no existe o no tienes acceso." />
        <Link to="/admin/events" className={vintageButtonStyles({ variant: "ghost" })}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a eventos
        </Link>
      </div>
    );
  }

  const event = detail.data;
  const actionError = transition.error ?? cancel.error ?? duplicate.error ?? remove.error;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Evento"
        title={event.name}
        description={event.description ?? "Sin descripción."}
        actions={
          <>
            <Link to="/admin/events" className={vintageButtonStyles({ variant: "ghost" })}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Eventos
            </Link>
            <Link to={`/admin/events/${event.id}/participants`} className={vintageButtonStyles()}>
              <Users aria-hidden="true" className="size-4" />
              Participantes
            </Link>
            <Link
              to={`/admin/events/${event.id}/photos`}
              className={vintageButtonStyles({ variant: "ghost" })}
            >
              <Images aria-hidden="true" className="size-4" />
              Fotos
            </Link>
            <Link
              to={`/admin/events/${event.id}/album`}
              className={vintageButtonStyles({ variant: "ghost" })}
            >
              <Sparkles aria-hidden="true" className="size-4" />
              Álbum
            </Link>
            <Link
              to={`/admin/events/${event.id}/qr`}
              className={vintageButtonStyles({ variant: "ghost" })}
            >
              <QrCode aria-hidden="true" className="size-4" />
              QR
            </Link>
            {event.status !== "cancelled" ? (
              <Link
                to={`/admin/events/${event.id}/edit`}
                className={vintageButtonStyles({ variant: "ghost" })}
              >
                <Pencil aria-hidden="true" className="size-4" />
                Editar
              </Link>
            ) : null}
          </>
        }
      />

      {actionError ? (
        <InlineAlert tone="error">
          {messageOf(actionError, "La acción no se pudo completar.")}
        </InlineAlert>
      ) : null}

      <section className="paper-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={event.status} />
            <p className="font-mono text-caption text-muted">{event.slug}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {event.status === "draft" ? (
              <VintageButton
                variant="ghost"
                onClick={() => transition.mutate("schedule")}
                disabled={transition.isPending}
              >
                <CalendarRange aria-hidden="true" className="size-4" />
                Programar
              </VintageButton>
            ) : null}

            {event.status === "draft" ||
            event.status === "scheduled" ||
            event.status === "finished" ? (
              <VintageButton
                onClick={() => transition.mutate("activate")}
                disabled={transition.isPending}
              >
                {event.status === "finished" ? (
                  <Undo2 aria-hidden="true" className="size-4" />
                ) : (
                  <Play aria-hidden="true" className="size-4" />
                )}
                {event.status === "finished" ? "Reactivar" : "Activar"}
              </VintageButton>
            ) : null}

            {event.status === "active" ? (
              <VintageButton
                onClick={() => transition.mutate("finish")}
                disabled={transition.isPending}
              >
                <Square aria-hidden="true" className="size-4" />
                Finalizar
              </VintageButton>
            ) : null}

            {event.status === "draft" ||
            event.status === "scheduled" ||
            event.status === "active" ? (
              <VintageButton
                variant="ghost"
                onClick={() => setCancelOpen(true)}
                disabled={cancel.isPending}
              >
                <XCircle aria-hidden="true" className="size-4" />
                Cancelar
              </VintageButton>
            ) : null}

            <VintageButton
              variant="ghost"
              onClick={() => duplicate.mutate()}
              disabled={duplicate.isPending}
            >
              <Copy aria-hidden="true" className="size-4" />
              Duplicar
            </VintageButton>

            <VintageButton variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 aria-hidden="true" className="size-4" />
              Eliminar
            </VintageButton>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <CoverManager event={event} />

          <section className="paper-card p-5" aria-labelledby="event-config">
            <h2 id="event-config" className="text-heading-sm font-semibold">
              Configuración
            </h2>
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
                  Fechas
                </dt>
                <dd className="mt-1 text-body-sm">
                  {formatDateRange(event.startDate, event.endDate)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
                  Zona horaria
                </dt>
                <dd className="mt-1 font-mono text-body-sm">{event.timezone}</dd>
              </div>
              <div>
                <dt className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
                  Cuota diaria
                </dt>
                <dd className="mt-1 text-body-sm">
                  {event.dailyPhotoLimit} fotos por participante
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
                  Límite total
                </dt>
                <dd className="mt-1 text-body-sm">
                  {event.totalPhotoLimit === null
                    ? "Sin límite"
                    : `${formatNumber(event.totalPhotoLimit)} fotos`}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
                  Visibilidad de galería
                </dt>
                <dd className="mt-1 text-body-sm">{VISIBILITY_LABELS[event.galleryVisibility]}</dd>
              </div>
              <div>
                <dt className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
                  Tamaño máximo por archivo
                </dt>
                <dd className="mt-1 text-body-sm">
                  {Math.round(event.maxFileSizeBytes / 1_048_576)} MB
                </dd>
              </div>
            </dl>

            <ul className="mt-5 space-y-2 border-t border-border pt-4 text-body-sm text-brown">
              <li>{event.requireName ? "Se exige nombre." : "No se exige nombre."}</li>
              <li>
                {event.showParticipantNames
                  ? "Los nombres se muestran en superficies públicas."
                  : "Los nombres permanecen ocultos en superficies públicas."}
              </li>
              <li>
                {event.allowSelfRegistration
                  ? "El auto-registro está permitido."
                  : "Solo el administrador crea participantes."}
              </li>
              <li>
                {event.allowPhotoDeletion
                  ? "Los participantes pueden borrar sus fotos."
                  : "Los participantes no pueden borrar sus fotos."}
              </li>
            </ul>
          </section>

          {event.album ? (
            <section className="paper-card p-5">
              <h2 className="text-heading-sm font-semibold">Álbum</h2>
              <p className="mt-2 text-body-sm text-brown">
                {event.album.status === "published" ? "Publicado" : "Borrador"} ·{" "}
                {event.album.visibility === "public" ? "Público" : "Privado"}
              </p>
              <p className="mt-1 font-mono text-caption text-muted">{event.album.slug}</p>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section className="paper-card p-5" aria-labelledby="event-stats">
            <h2 id="event-stats" className="text-heading-sm font-semibold">
              Métricas
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              {[
                ["Participantes", event.counts.participants],
                ["Lugares restantes", event.counts.remainingSlots],
                ["Fotos", event.counts.photos],
                ["Fotos hoy", event.counts.photosToday],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="font-mono text-[0.64rem] uppercase tracking-[0.1em] text-muted">
                    {label}
                  </dt>
                  <dd className="mt-1 font-display text-[1.7rem] font-semibold leading-none">
                    {value === null ? "∞" : formatNumber(Number(value))}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t border-border pt-3 text-caption text-muted">
              Las métricas usan el día local del evento.
            </p>
          </section>

          <section className="paper-card p-5">
            <h2 className="text-heading-sm font-semibold">Enlace público</h2>
            <p className="mt-2 break-all font-mono text-caption text-muted">/e/{event.slug}</p>
            <Link
              to={`/e/${event.slug}`}
              className={vintageButtonStyles({ variant: "ghost", className: "mt-3 w-full" })}
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              Abrir página pública
            </Link>
            <p className="mt-2 text-caption text-muted">
              Los invitados pueden entrar con el QR o con un enlace personal y subir sus fotos desde
              la cámara.
            </p>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancelar el evento"
        description="Se cancelan las reservas activas y el evento deja de ser público. Las fotos confirmadas se conservan para el administrador."
        confirmLabel="Cancelar evento"
        pending={cancel.isPending}
        confirmDisabled={cancelReason.trim().length === 0}
        onClose={() => {
          if (!cancel.isPending) {
            setCancelOpen(false);
          }
        }}
        onConfirm={() => {
          if (cancelReason.trim().length > 0) {
            cancel.mutate(cancelReason.trim());
          }
        }}
      >
        <label
          htmlFor="cancel-reason"
          className="mb-1.5 block font-mono text-caption uppercase tracking-[0.12em] text-brown"
        >
          Motivo
        </label>
        <textarea
          id="cancel-reason"
          rows={3}
          value={cancelReason}
          onChange={(inputEvent) => setCancelReason(inputEvent.target.value)}
          maxLength={280}
          className="min-h-20 w-full rounded-sm border border-border bg-paper px-3 py-2 text-body-sm"
          placeholder="Cancelado por el cliente"
        />
        <p className="mt-1 text-caption text-muted">{cancelReason.length}/280 caracteres.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar el evento para siempre"
        description="Se borran participantes, fotos, sesiones y álbum. Los objetos de Storage se encolan para limpieza. Esta acción es irreversible."
        confirmLabel="Eliminar evento"
        pending={remove.isPending}
        confirmDisabled={confirmName !== event.name}
        onClose={() => {
          if (!remove.isPending) {
            setDeleteOpen(false);
            setConfirmName("");
          }
        }}
        onConfirm={() => remove.mutate(confirmName)}
      >
        <label
          htmlFor="delete-confirm"
          className="mb-1.5 block font-mono text-caption uppercase tracking-[0.12em] text-brown"
        >
          Escribe «{event.name}» para confirmar
        </label>
        <input
          id="delete-confirm"
          value={confirmName}
          onChange={(inputEvent) => setConfirmName(inputEvent.target.value)}
          className="min-h-11 w-full rounded-sm border border-border bg-paper px-3 py-2 text-body-sm"
          autoComplete="off"
        />
      </ConfirmDialog>
    </div>
  );
}
