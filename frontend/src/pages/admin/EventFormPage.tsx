import { zodResolver } from "@hookform/resolvers/zod";
import {
  GALLERY_VISIBILITIES,
  isoDateSchema,
  timezoneSchema,
  type AdminEventDetail,
  type CreateEventInput,
  type GalleryVisibility,
} from "@rollo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { ErrorBlock, InlineAlert, LoadingBlock } from "@/components/admin/Feedback";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  fieldErrorClass,
  fieldInputClass,
  fieldLabelClass,
  FieldShell,
} from "@/components/admin/form";
import { VintageButton } from "@/components/common/VintageButton";
import { vintageButtonStyles } from "@/components/common/vintage-button.styles";
import { ApiError } from "@/services/api";
import { adminApi } from "@/services/admin";

const eventFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre del evento es obligatorio.")
      .max(120, "El nombre no puede superar los 120 caracteres."),
    description: z.string().trim().max(2000, "La descripción es demasiado larga.").optional(),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    timezone: timezoneSchema,
    dailyPhotoLimit: z.number().int().min(1, "Debe ser al menos 1.").max(100),
    totalPhotoLimit: z.number().int().min(1).max(10_000).nullable(),
    requireName: z.boolean(),
    showParticipantNames: z.boolean(),
    allowSelfRegistration: z.boolean(),
    participantLimit: z.number().int().min(1).max(10_000).nullable(),
    maxFileSizeMb: z.number().min(1, "Mínimo 1 MB.").max(50, "Máximo 50 MB."),
    galleryVisibility: z.enum(GALLERY_VISIBILITIES),
    allowPhotoDeletion: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.endDate < value.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "La fecha de fin no puede ser anterior a la de inicio.",
      });
    }

    if (value.allowSelfRegistration && value.participantLimit === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participantLimit"],
        message: "El auto-registro exige un cupo máximo de participantes.",
      });
    }
  });

type EventFormValues = z.infer<typeof eventFormSchema>;

const COMMON_TIMEZONES = [
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Europe/London",
  "UTC",
];

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function defaults(): EventFormValues {
  return {
    name: "",
    description: "",
    startDate: isoDate(7),
    endDate: isoDate(10),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City",
    dailyPhotoLimit: 10,
    totalPhotoLimit: null,
    requireName: true,
    showParticipantNames: false,
    allowSelfRegistration: false,
    participantLimit: null,
    maxFileSizeMb: 10,
    galleryVisibility: "participants",
    allowPhotoDeletion: false,
  };
}

function fromDetail(event: AdminEventDetail): EventFormValues {
  return {
    name: event.name,
    description: event.description ?? "",
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
    dailyPhotoLimit: event.dailyPhotoLimit,
    totalPhotoLimit: event.totalPhotoLimit,
    requireName: event.requireName,
    showParticipantNames: event.showParticipantNames,
    allowSelfRegistration: event.allowSelfRegistration,
    participantLimit: event.participantLimit,
    maxFileSizeMb: Math.round((event.maxFileSizeBytes / 1_048_576) * 100) / 100,
    galleryVisibility: event.galleryVisibility,
    allowPhotoDeletion: event.allowPhotoDeletion,
  };
}

function toPayload(values: EventFormValues): CreateEventInput {
  return {
    name: values.name,
    description: values.description?.trim() ? values.description : undefined,
    startDate: values.startDate,
    endDate: values.endDate,
    timezone: values.timezone,
    dailyPhotoLimit: values.dailyPhotoLimit,
    totalPhotoLimit: values.totalPhotoLimit,
    requireName: values.requireName,
    showParticipantNames: values.showParticipantNames,
    allowSelfRegistration: values.allowSelfRegistration,
    participantLimit: values.participantLimit,
    maxFileSizeBytes: Math.round(values.maxFileSizeMb * 1_048_576),
    galleryVisibility: values.galleryVisibility as GalleryVisibility,
    allowPhotoDeletion: values.allowPhotoDeletion,
  };
}

export function EventFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initializedFor = useRef<string | null>(null);

  const detail = useQuery({
    queryKey: ["admin", "event", id],
    queryFn: () => adminApi.detail(id ?? ""),
    enabled: isEditing,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (detail.data && initializedFor.current !== detail.data.id) {
      initializedFor.current = detail.data.id;
      reset(fromDetail(detail.data));
    }
  }, [detail.data, reset]);

  const save = useMutation({
    mutationFn: async (values: EventFormValues) => {
      const payload = toPayload(values);

      if (isEditing && id) {
        return adminApi.update(id, payload);
      }

      return adminApi.create(payload);
    },
    async onSuccess(result) {
      await queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "event"] });
      navigate(`/admin/events/${result.id}`, { replace: true });
    },
  });

  async function onSubmit(values: EventFormValues): Promise<void> {
    await save.mutateAsync(values).catch(() => undefined);
  }

  if (isEditing && detail.isPending) {
    return <LoadingBlock label="Cargando el evento…" />;
  }

  if (isEditing && detail.isError) {
    return (
      <div className="space-y-4">
        <PageHeader kicker="Eventos" title="No se pudo cargar el evento" />
        <ErrorBlock message="El evento no existe o no tienes acceso." />
        <Link to="/admin/events" className={vintageButtonStyles({ variant: "ghost" })}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a eventos
        </Link>
      </div>
    );
  }

  const saveError =
    save.error instanceof ApiError
      ? save.error.message
      : save.error
        ? "No se pudo guardar el evento."
        : null;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={isEditing ? "Editar evento" : "Nuevo evento"}
        title={isEditing ? "Ajustar el rollo" : "Preparar un rollo"}
        description={
          isEditing
            ? "Los cambios afectan a la configuración, no a las fotos ya reveladas."
            : "Define las reglas antes de compartir el enlace con los invitados."
        }
        actions={
          <Link
            to={isEditing && id ? `/admin/events/${id}` : "/admin/events"}
            className={vintageButtonStyles({ variant: "ghost" })}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Cancelar
          </Link>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {saveError ? <InlineAlert tone="error">{saveError}</InlineAlert> : null}

        <section className="paper-card p-5 sm:p-6" aria-labelledby="event-data">
          <h2 id="event-data" className="text-heading-sm font-semibold">
            Identidad
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FieldShell
              label="Nombre del evento"
              htmlFor="name"
              error={errors.name?.message}
              className="sm:col-span-2"
            >
              <input
                id="name"
                className={fieldInputClass}
                placeholder="Cumpleaños de Ana"
                aria-invalid={errors.name ? "true" : "false"}
                {...register("name")}
              />
            </FieldShell>

            <FieldShell
              label="Descripción"
              htmlFor="description"
              hint="Opcional. Se mostrará en el panel y en el álbum."
              error={errors.description?.message}
              className="sm:col-span-2"
            >
              <textarea
                id="description"
                rows={3}
                className={`${fieldInputClass} min-h-24 resize-y`}
                placeholder="Una tarde para recordar."
                {...register("description")}
              />
            </FieldShell>
          </div>
        </section>

        <section className="paper-card p-5 sm:p-6" aria-labelledby="event-dates">
          <h2 id="event-dates" className="text-heading-sm font-semibold">
            Fechas y zona horaria
          </h2>
          <p className="mt-1 text-body-sm text-brown">
            Los días de cuota se calculan con la zona horaria del evento.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FieldShell label="Inicio" htmlFor="startDate" error={errors.startDate?.message}>
              <input
                id="startDate"
                type="date"
                className={fieldInputClass}
                aria-invalid={errors.startDate ? "true" : "false"}
                {...register("startDate")}
              />
            </FieldShell>

            <FieldShell label="Fin" htmlFor="endDate" error={errors.endDate?.message}>
              <input
                id="endDate"
                type="date"
                className={fieldInputClass}
                aria-invalid={errors.endDate ? "true" : "false"}
                {...register("endDate")}
              />
            </FieldShell>

            <FieldShell
              label="Zona horaria IANA"
              htmlFor="timezone"
              hint={
                isEditing
                  ? "Solo se puede cambiar si el evento aún no tiene fotos ni sesiones de carga."
                  : "Por ejemplo, America/Mexico_City."
              }
              error={errors.timezone?.message}
              className="sm:col-span-2"
            >
              <input
                id="timezone"
                list="timezone-options"
                className={fieldInputClass}
                autoComplete="off"
                aria-invalid={errors.timezone ? "true" : "false"}
                {...register("timezone")}
              />
              <datalist id="timezone-options">
                {COMMON_TIMEZONES.map((timezone) => (
                  <option key={timezone} value={timezone} />
                ))}
              </datalist>
            </FieldShell>
          </div>
        </section>

        <section className="paper-card p-5 sm:p-6" aria-labelledby="event-quota">
          <h2 id="event-quota" className="text-heading-sm font-semibold">
            Cuota y archivos
          </h2>
          <p className="mt-1 text-body-sm text-brown">
            La cuota diaria se renueva a medianoche según la zona horaria del evento.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FieldShell
              label="Fotos por participante y día"
              htmlFor="dailyPhotoLimit"
              hint="Entre 1 y 100."
              error={errors.dailyPhotoLimit?.message}
            >
              <input
                id="dailyPhotoLimit"
                type="number"
                min={1}
                max={100}
                className={fieldInputClass}
                {...register("dailyPhotoLimit", { valueAsNumber: true })}
              />
            </FieldShell>

            <FieldShell
              label="Límite total de fotos"
              htmlFor="totalPhotoLimit"
              hint="Vacío significa sin límite total."
              error={errors.totalPhotoLimit?.message}
            >
              <input
                id="totalPhotoLimit"
                type="number"
                min={1}
                max={10_000}
                className={fieldInputClass}
                {...register("totalPhotoLimit", {
                  setValueAs: (value: unknown) =>
                    value === "" || value === null || value === undefined ? null : Number(value),
                })}
              />
            </FieldShell>

            <FieldShell
              label="Tamaño máximo por archivo (MB)"
              htmlFor="maxFileSizeMb"
              hint="Entre 1 y 50 MB."
              error={errors.maxFileSizeMb?.message}
            >
              <input
                id="maxFileSizeMb"
                type="number"
                min={1}
                max={50}
                step={1}
                className={fieldInputClass}
                {...register("maxFileSizeMb", { valueAsNumber: true })}
              />
            </FieldShell>
          </div>
        </section>

        <section className="paper-card p-5 sm:p-6" aria-labelledby="event-participants">
          <h2 id="event-participants" className="text-heading-sm font-semibold">
            Participantes
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FieldShell
              label="Cupo máximo de participantes"
              htmlFor="participantLimit"
              hint="Obligatorio si permites el auto-registro. No puede quedar por debajo de los participantes actuales."
              error={errors.participantLimit?.message}
            >
              <input
                id="participantLimit"
                type="number"
                min={1}
                max={10_000}
                className={fieldInputClass}
                {...register("participantLimit", {
                  setValueAs: (value: unknown) =>
                    value === "" || value === null || value === undefined ? null : Number(value),
                })}
              />
            </FieldShell>

            <fieldset className="space-y-3 rounded-sm border border-border bg-paper p-3">
              <legend className={fieldLabelClass}>Opciones</legend>
              <label className="flex items-start gap-2 text-body-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-ink"
                  {...register("requireName")}
                />
                <span>
                  Exigir nombre
                  <span className="block text-caption text-muted">
                    Si se desactiva, los nombres existentes se conservan.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-body-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-ink"
                  {...register("showParticipantNames")}
                />
                <span>
                  Mostrar nombres en superficies públicas
                  <span className="block text-caption text-muted">
                    Solo afecta a lo que ven los invitados.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-body-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-ink"
                  {...register("allowSelfRegistration")}
                />
                <span>
                  Permitir auto-registro
                  <span className="block text-caption text-muted">
                    Requiere un cupo máximo. Se aplica en la fase pública.
                  </span>
                </span>
              </label>
            </fieldset>
          </div>
        </section>

        <section className="paper-card p-5 sm:p-6" aria-labelledby="event-gallery">
          <h2 id="event-gallery" className="text-heading-sm font-semibold">
            Galería
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FieldShell
              label="Visibilidad de la galería"
              htmlFor="galleryVisibility"
              error={errors.galleryVisibility?.message}
            >
              <select
                id="galleryVisibility"
                className={fieldInputClass}
                {...register("galleryVisibility")}
              >
                <option value="private">Privada</option>
                <option value="participants">Solo participantes</option>
                <option value="public">Pública</option>
              </select>
            </FieldShell>

            <label className="flex items-start gap-2 self-end rounded-sm border border-border bg-paper p-3 text-body-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-ink"
                {...register("allowPhotoDeletion")}
              />
              <span>
                Permitir que los participantes borren sus fotos
                <span className="block text-caption text-muted">
                  El borrado es lógico y encola el original para limpieza.
                </span>
              </span>
            </label>
          </div>
        </section>

        {Object.keys(errors).length > 0 ? (
          <p className={fieldErrorClass} role="alert">
            Revisa los campos marcados antes de guardar.
          </p>
        ) : null}

        <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t border-border bg-paper/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
          <Link
            to={isEditing && id ? `/admin/events/${id}` : "/admin/events"}
            className={vintageButtonStyles({ variant: "ghost" })}
          >
            Cancelar
          </Link>
          <VintageButton type="submit" disabled={isSubmitting || save.isPending}>
            <Save aria-hidden="true" className="size-4" />
            {save.isPending ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear evento"}
          </VintageButton>
        </div>
      </form>
    </div>
  );
}
