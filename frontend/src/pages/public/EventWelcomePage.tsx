import { zodResolver } from "@hookform/resolvers/zod";
import type { PublicEvent, RegisterParticipantInput } from "@rollo/shared";
import { displayNameSchema } from "@rollo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Clock3, Link2, LockKeyhole, QrCode } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { InlineAlert, LoadingBlock } from "@/components/admin/Feedback";
import { VintageButton } from "@/components/common/VintageButton";
import { useParticipant } from "@/context/ParticipantContext";
import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";
import { formatDateRange, formatDateTime } from "@/utils/format";

const nameSchema = z.object({
  displayName: z.string().trim().max(60, "El nombre no puede superar los 60 caracteres."),
});

type NameValues = z.infer<typeof nameSchema>;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function registrationMessage(event: PublicEvent): string | null {
  if (event.registration.enabled === false) {
    return null;
  }

  if (event.registration.reason === "limit_reached") {
    return "El cupo de participantes está completo.";
  }

  if (event.registration.reason === "event_not_active") {
    return "El registro se abre cuando el evento esté activo.";
  }

  if (event.registration.reason === "event_out_of_dates") {
    return "El evento está fuera de sus fechas.";
  }

  return null;
}

export function EventWelcomePage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const {
    me,
    sessionToken,
    isLoading: sessionLoading,
    clearSession,
    saveSession,
  } = useParticipant();

  const eventQuery = useQuery({
    queryKey: ["public", "event", slug],
    queryFn: () => publicApi.event(slug),
    enabled: slug.length > 0,
    retry: false,
  });

  const event = eventQuery.data;
  const mustName = event?.requireName === true;

  const schema = useMemo(
    () =>
      z.object({
        displayName: mustName ? displayNameSchema : nameSchema.shape.displayName,
      }),
    [mustName],
  );

  const form = useForm<NameValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: "" },
  });

  const register = useMutation({
    mutationFn: (values: NameValues) => {
      const name = values.displayName.trim();
      const input: RegisterParticipantInput = name.length > 0 ? { displayName: name } : {};

      return publicApi.register(slug, input);
    },
    onSuccess(result) {
      // El código se guarda para poder renovar la sesión sin pedir el enlace.
      saveSession(result.session.token, result.access.code);
      navigate(`/e/${slug}/camera`, { replace: true });
    },
  });

  if (eventQuery.isPending) {
    return (
      <section className="container-editorial py-16">
        <LoadingBlock label="Abriendo el evento…" />
      </section>
    );
  }

  if (eventQuery.isError || !event) {
    const isMissing = eventQuery.error instanceof ApiError && eventQuery.error.status === 404;

    return (
      <section className="container-editorial flex min-h-[60dvh] items-center py-16">
        <div className="max-w-xl space-y-5">
          <p className="editorial-kicker flex items-center gap-2">
            <QrCode aria-hidden="true" className="size-4" />
            Evento
          </p>
          <h1 className="text-display-md font-semibold">
            {isMissing ? "Este enlace no está disponible." : "No pudimos abrir el evento."}
          </h1>
          <p className="text-body text-brown">
            {isMissing
              ? "Puede que el evento aún no se haya publicado, que haya sido cancelado o que el enlace esté incompleto."
              : messageOf(eventQuery.error, "Revisa tu conexión e inténtalo de nuevo.")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className="focus-film rounded-sm text-body-sm underline underline-offset-4"
            >
              Volver al inicio
            </Link>
            {!isMissing ? (
              <button
                type="button"
                onClick={() => void eventQuery.refetch()}
                className="focus-film rounded-sm text-body-sm underline underline-offset-4"
              >
                Reintentar
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const existingParticipant = sessionToken !== null && me !== null ? me.participant : null;
  const notice = registrationMessage(event);

  return (
    <section className="container-editorial grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
      <div>
        <p className="editorial-kicker flex items-center gap-2">
          <QrCode aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Estás invitado
        </p>

        <h1 className="mt-4 max-w-[15ch] text-display-lg font-semibold leading-[0.98]">
          {event.name}
        </h1>

        {event.description ? (
          <p className="mt-5 max-w-reading text-body-lg text-brown">{event.description}</p>
        ) : null}

        <dl className="mt-8 grid max-w-xl gap-px border-y border-border bg-border sm:grid-cols-2">
          <div className="bg-paper px-4 py-3">
            <dt className="font-mono text-caption uppercase tracking-[0.12em] text-muted">
              Fechas
            </dt>
            <dd className="mt-1 flex items-center gap-2 text-body-sm">
              <CalendarDays aria-hidden="true" className="size-4 text-brown" />
              {formatDateRange(event.startDate, event.endDate)}
            </dd>
          </div>
          <div className="bg-paper px-4 py-3">
            <dt className="font-mono text-caption uppercase tracking-[0.12em] text-muted">
              Cuota diaria
            </dt>
            <dd className="mt-1 flex items-center gap-2 text-body-sm">
              <Clock3 aria-hidden="true" className="size-4 text-brown" />
              {event.dailyPhotoLimit} fotos por persona
            </dd>
          </div>
        </dl>

        <p className="mt-5 max-w-reading text-body-sm text-brown">
          La cuota se renueva a medianoche en la zona horaria del evento y se calcula en el
          servidor.
          {event.quotaResetsAt
            ? ` Próxima renovación: ${formatDateTime(event.quotaResetsAt)} (tu hora local).`
            : ""}
        </p>

        <div className="mt-8 flex items-center gap-3 rounded-sm border border-brown/25 bg-cream/35 px-4 py-3 text-body-sm text-brown">
          <LockKeyhole aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
          Tus fotos se guardan sin filtros ni recortes. Solo se compartirán según la visibilidad que
          eligió el organizador.
        </div>
      </div>

      <div className="space-y-4">
        {sessionLoading ? (
          <div className="paper-card p-5">
            <LoadingBlock label="Recuperando tu sesión…" />
          </div>
        ) : existingParticipant ? (
          <div className="paper-card p-6">
            <p className="editorial-kicker">Sesión activa</p>
            <h2 className="mt-2 text-heading-md font-semibold">
              Hola de nuevo, {existingParticipant.displayName ?? "invitado anónimo"}.
            </h2>
            <p className="mt-2 text-body-sm text-brown">
              Este navegador ya tiene acceso a {event.name}. Puedes volver a tu cámara sin abrir el
              enlace de nuevo.
            </p>
            <VintageButton className="mt-5 w-full" onClick={() => navigate(`/e/${slug}/camera`)}>
              Volver a mi cámara
              <ArrowRight aria-hidden="true" className="size-4" />
            </VintageButton>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <VintageButton variant="ghost" onClick={() => navigate(`/e/${slug}/gallery`)}>
                Galería
              </VintageButton>
              <VintageButton variant="ghost" onClick={() => navigate(`/e/${slug}/vote`)}>
                Votar
              </VintageButton>
            </div>
            <button
              type="button"
              onClick={() => {
                clearSession();
                form.reset();
              }}
              className="focus-film mt-3 w-full rounded-sm text-caption text-muted underline underline-offset-4 hover:text-ink"
            >
              Entrar con otra identidad en este dispositivo
            </button>
          </div>
        ) : event.registration.enabled === false ? (
          <div className="paper-card p-6">
            <p className="editorial-kicker">Solo por invitación</p>
            <h2 className="mt-2 text-heading-md font-semibold">
              Este evento no acepta auto-registro.
            </h2>
            <p className="mt-2 text-body-sm text-brown">
              Abre el enlace personal que te compartió el organizador. Cada enlace es único y no se
              puede recuperar desde esta página.
            </p>
            <p className="mt-4 flex items-center gap-2 font-mono text-caption uppercase tracking-[0.1em] text-muted">
              <Link2 aria-hidden="true" className="size-3.5" />
              Formato: /e/{slug}/a/tu-código
            </p>
          </div>
        ) : notice !== null || !event.canRegister ? (
          <div className="paper-card p-6">
            <p className="editorial-kicker">Registro cerrado</p>
            <h2 className="mt-2 text-heading-md font-semibold">
              {notice ?? "No es posible registrarse en este momento."}
            </h2>
            <p className="mt-2 text-body-sm text-brown">
              {event.registration.remaining !== null
                ? `Lugares disponibles: ${event.registration.remaining} de ${event.registration.limit}.`
                : "El organizador controla el acceso a este evento."}
            </p>
          </div>
        ) : (
          <form
            className="paper-card p-6"
            onSubmit={form.handleSubmit((values) => register.mutate(values))}
            noValidate
          >
            <p className="editorial-kicker">Entrar al evento</p>
            <h2 className="mt-2 text-heading-md font-semibold">
              {mustName ? "¿Cómo te llamas?" : "Elige cómo participar."}
            </h2>
            <p className="mt-2 text-body-sm text-brown">
              {mustName
                ? "El organizador pidió un nombre para ordenar el álbum. Podrás cambiarlo mientras el evento esté activo."
                : "Puedes escribir tu nombre o dejar el campo vacío para participar de forma anónima."}
            </p>

            <label
              htmlFor="display-name"
              className="mt-5 block font-mono text-caption uppercase tracking-[0.12em] text-brown"
            >
              Tu nombre {mustName ? "" : "(opcional)"}
            </label>
            <input
              id="display-name"
              autoComplete="name"
              inputMode="text"
              maxLength={60}
              placeholder={mustName ? "Ana" : "Prefiero no decirlo"}
              className="mt-1.5 min-h-11 w-full rounded-sm border border-border bg-paper px-3 py-2 text-body-sm"
              aria-invalid={form.formState.errors.displayName ? "true" : "false"}
              {...form.register("displayName")}
            />
            {form.formState.errors.displayName ? (
              <p className="mt-1.5 text-caption text-red" role="alert">
                {form.formState.errors.displayName.message}
              </p>
            ) : null}

            {!mustName ? (
              <p className="mt-3 rounded-sm border border-warning/30 bg-warning/5 px-3 py-2 text-caption text-warning">
                Si participas de forma anónima, el organizador no sabrá a quién pertenecen tus
                fotos. Tu enlace personal quedará guardado en este navegador.
              </p>
            ) : null}

            {event.registration.remaining !== null ? (
              <p className="mt-3 font-mono text-caption uppercase tracking-[0.1em] text-muted">
                Quedan {event.registration.remaining} de {event.registration.limit} lugares
              </p>
            ) : null}

            {register.isError ? (
              <InlineAlert className="mt-4">
                {messageOf(register.error, "No se pudo completar el registro.")}
              </InlineAlert>
            ) : null}

            <VintageButton type="submit" className="mt-5 w-full" disabled={register.isPending}>
              {register.isPending ? "Abriendo tu cámara…" : "Entrar al evento"}
              <ArrowRight aria-hidden="true" className="size-4" />
            </VintageButton>

            {event.showParticipantNames ? (
              <p className="mt-3 text-caption text-muted">
                Los nombres se muestran en el álbum de este evento.
              </p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}
