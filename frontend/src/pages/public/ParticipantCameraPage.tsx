import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Camera,
  Clock3,
  Images,
  LogOut,
  Pencil,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { InlineAlert, LoadingBlock } from "@/components/admin/Feedback";
import { VintageButton } from "@/components/common/VintageButton";
import { CameraUpload } from "@/components/participant/CameraUpload";
import { FilmCounter } from "@/components/participant/FilmCounter";
import { FilmRoll } from "@/components/participant/FilmRoll";
import { MyPhotos } from "@/components/participant/MyPhotos";
import { useParticipant } from "@/context/ParticipantContext";
import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";
import { formatDateRange, formatDateTime, formatNumber } from "@/utils/format";

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const STATE_COPY = {
  scheduled: {
    title: "La cámara aún no está abierta.",
    body: "El evento todavía no empieza. Vuelve cuando el organizador lo active.",
  },
  finished: {
    title: "El evento ya terminó.",
    body: "La cámara está cerrada, pero tus fotos se conservan para el álbum.",
  },
  out_of_dates: {
    title: "La cámara está cerrada.",
    body: "Hoy está fuera de las fechas del evento. Tus fotos se conservan para el álbum.",
  },
  cancelled: {
    title: "El evento fue cancelado.",
    body: "La cámara está cerrada y no se aceptan más fotografías.",
  },
  draft: {
    title: "El evento aún no está disponible.",
    body: "Vuelve cuando el organizador publique el evento.",
  },
} as const;

export function ParticipantCameraPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { sessionToken, me, isLoading, error, renewError, clearSession, refetch } =
    useParticipant();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(me?.participant.displayName ?? "");

  useEffect(() => {
    setName(me?.participant.displayName ?? "");
  }, [me?.participant.displayName]);

  const updateName = useMutation({
    mutationFn: (displayName: string) => publicApi.updateMe(sessionToken ?? "", { displayName }),
    onSuccess() {
      setEditingName(false);
      refetch();
    },
  });

  if (!sessionToken) {
    return <Navigate to={`/e/${slug}`} replace />;
  }

  if (isLoading) {
    return (
      <section className="container-editorial py-16">
        <LoadingBlock label="Preparando tu cámara…" />
      </section>
    );
  }

  if (!me) {
    return (
      <section className="container-editorial flex min-h-[60dvh] items-center py-16">
        <div className="max-w-xl space-y-4">
          <p className="editorial-kicker">Tu cámara</p>
          <h1 className="text-display-md font-semibold">No pudimos abrir tu sesión.</h1>
          <p className="text-body text-brown">
            {renewError
              ? messageOf(renewError, "Tu enlace personal ya no es válido.")
              : messageOf(error, "Puede que tu sesión haya expirado.")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to={`/e/${slug}`} className={vintageLink()}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Volver al evento
            </Link>
            <button
              type="button"
              onClick={() => {
                clearSession();
                navigate(`/e/${slug}`, { replace: true });
              }}
              className={vintageLink()}
            >
              Usar otro enlace
            </button>
          </div>
        </div>
      </section>
    );
  }

  const { participant, event, quota, permissions } = me;
  const stateCopy =
    event.effectiveStatus === "active" && !permissions.canUpload
      ? STATE_COPY.out_of_dates
      : event.effectiveStatus === "active"
        ? null
        : (STATE_COPY[event.effectiveStatus] ?? null);

  return (
    <section className="container-editorial py-10 sm:py-14">
      <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="editorial-kicker flex items-center gap-2">
            <Camera aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Tu cámara · {event.name}
          </p>
          <h1 className="mt-2 text-display-md font-semibold">
            {participant.displayName ?? "Invitado anónimo"}
          </h1>
          <p className="mt-2 text-body-sm text-brown">
            {formatDateRange(event.startDate, event.endDate)} · Día {quota.dayNumber} del evento
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={`/e/${slug}/gallery`} className={vintageLink()}>
            <Images aria-hidden="true" className="size-4" />
            Galería
          </Link>
          <Link to={`/e/${slug}/vote`} className={vintageLink()}>
            <Trophy aria-hidden="true" className="size-4" />
            Votar
          </Link>
          {permissions.canChangeName ? (
            <VintageButton variant="ghost" onClick={() => setEditingName((value) => !value)}>
              <Pencil aria-hidden="true" className="size-4" />
              Cambiar nombre
            </VintageButton>
          ) : null}
          <VintageButton
            variant="ghost"
            onClick={() => {
              clearSession();
              navigate(`/e/${slug}`, { replace: true });
            }}
          >
            <LogOut aria-hidden="true" className="size-4" />
            Salir del dispositivo
          </VintageButton>
        </div>
      </div>

      {editingName ? (
        <form
          className="mt-5 rounded-sm border border-border bg-paper-raised p-4"
          onSubmit={(formEvent) => {
            formEvent.preventDefault();
            const trimmed = name.trim();

            if (trimmed.length > 0) {
              updateName.mutate(trimmed);
            }
          }}
        >
          <label
            htmlFor="camera-name"
            className="block font-mono text-caption uppercase tracking-[0.12em] text-brown"
          >
            Tu nombre
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              id="camera-name"
              value={name}
              onChange={(inputEvent) => setName(inputEvent.target.value)}
              maxLength={60}
              autoComplete="name"
              className="min-h-11 flex-1 rounded-sm border border-border bg-paper px-3 py-2 text-body-sm"
            />
            <VintageButton
              type="submit"
              disabled={updateName.isPending || name.trim().length === 0}
            >
              Guardar
            </VintageButton>
            <VintageButton variant="ghost" onClick={() => setEditingName(false)}>
              Cancelar
            </VintageButton>
          </div>
          {updateName.isError ? (
            <InlineAlert className="mt-3">
              {messageOf(updateName.error, "No se pudo cambiar el nombre.")}
            </InlineAlert>
          ) : null}
        </form>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <FilmCounter
            remainingDay={quota.remainingDay}
            dailyLimit={quota.dailyLimit}
            usedDay={quota.usedDay}
            reservedDay={quota.reservedDay}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="paper-card p-4">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
                Usadas hoy
              </p>
              <p className="mt-1 font-display text-[1.8rem] font-semibold leading-none">
                {formatNumber(quota.usedDay)}
              </p>
            </div>
            <div className="paper-card p-4">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
                Restantes en total
              </p>
              <p className="mt-1 font-display text-[1.8rem] font-semibold leading-none">
                {quota.remainingTotal === null ? "∞" : formatNumber(quota.remainingTotal)}
              </p>
            </div>
          </div>

          <div className="paper-card p-5">
            <p className="flex items-center gap-2 font-mono text-caption uppercase tracking-[0.12em] text-brown">
              <Clock3 aria-hidden="true" className="size-3.5" />
              Renovación de la cuota
            </p>
            <p className="mt-2 text-body-sm">
              {formatDateTime(quota.resetsAt)} <span className="text-muted">(tu hora local)</span>
            </p>
            <p className="mt-1 text-caption text-muted">
              El día del evento se calcula con la zona horaria {event.timezone}. La cuota se
              reinicia a medianoche en esa zona.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <FilmRoll
            dailyLimit={quota.dailyLimit}
            usedDay={quota.usedDay}
            reservedDay={quota.reservedDay}
          />

          {stateCopy ? (
            <div className="paper-card p-6">
              <p className="editorial-kicker">Cámara cerrada</p>
              <h2 className="mt-2 text-heading-md font-semibold">{stateCopy.title}</h2>
              <p className="mt-2 text-body-sm text-brown">{stateCopy.body}</p>
            </div>
          ) : (
            <CameraUpload onUploaded={refetch} />
          )}

          <div className="rounded-sm border border-brown/25 bg-cream/35 px-4 py-3 text-caption text-brown">
            <p className="flex items-start gap-2">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
                strokeWidth={1.75}
              />
              Tu sesión está guardada en este navegador. Si borras los datos del sitio, tendrás que
              volver a abrir tu enlace personal.
            </p>
          </div>

          {participant.anonymous ? (
            <p className="rounded-sm border border-warning/30 bg-warning/5 px-4 py-3 text-caption text-warning">
              Estás participando de forma anónima. El organizador no verá tu nombre junto a tus
              fotos.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <MyPhotos />
      </div>
    </section>
  );
}

function vintageLink(): string {
  return "focus-film inline-flex min-h-11 items-center gap-2 rounded-sm border border-ink bg-ink px-4 py-2 text-body-sm font-semibold text-paper-raised transition-colors hover:bg-brown";
}
