import { z } from "zod";

import { GALLERY_VISIBILITIES } from "../enums/index.js";
import { isoDateSchema, slugSchema } from "./common.js";

export function isValidTimezone(timezone: string): boolean {
  if (!timezone || timezone.length > 64) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimezone, "La zona horaria no es un identificador IANA válido.");

export const MAX_FILE_SIZE_MIN_BYTES = 1_048_576;
export const MAX_FILE_SIZE_MAX_BYTES = 52_428_800;
export const DAILY_PHOTO_LIMIT_MAX = 100;
export const TOTAL_PHOTO_LIMIT_MAX = 10_000;
export const PARTICIPANT_LIMIT_MAX = 10_000;

const eventBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del evento es obligatorio.")
    .max(120, "El nombre no puede superar los 120 caracteres."),
  description: z
    .string()
    .trim()
    .max(2000, "La descripción no puede superar los 2000 caracteres.")
    .optional(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  timezone: timezoneSchema,
  dailyPhotoLimit: z.coerce
    .number()
    .int()
    .min(1, "El límite diario debe ser al menos 1.")
    .max(DAILY_PHOTO_LIMIT_MAX),
  totalPhotoLimit: z.coerce.number().int().min(1).max(TOTAL_PHOTO_LIMIT_MAX).nullable().optional(),
  requireName: z.boolean(),
  showParticipantNames: z.boolean(),
  allowSelfRegistration: z.boolean(),
  participantLimit: z.coerce.number().int().min(1).max(PARTICIPANT_LIMIT_MAX).nullable().optional(),
  maxFileSizeBytes: z.coerce
    .number()
    .int()
    .min(MAX_FILE_SIZE_MIN_BYTES, "El tamaño máximo debe ser al menos 1 MB.")
    .max(MAX_FILE_SIZE_MAX_BYTES, "El tamaño máximo no puede superar 50 MB."),
  galleryVisibility: z.enum(GALLERY_VISIBILITIES),
  allowPhotoDeletion: z.boolean(),
});

export const createEventSchema = eventBaseSchema
  .refine((value) => value.endDate >= value.startDate, {
    message: "La fecha de fin no puede ser anterior a la de inicio.",
    path: ["endDate"],
  })
  .refine((value) => !value.allowSelfRegistration || value.participantLimit != null, {
    message: "El auto-registro exige un cupo máximo de participantes.",
    path: ["participantLimit"],
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = eventBaseSchema
  .partial()
  .refine(
    (value) => value.startDate == null || value.endDate == null || value.endDate >= value.startDate,
    {
      message: "La fecha de fin no puede ser anterior a la de inicio.",
      path: ["endDate"],
    },
  );

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const eventSlugSchema = slugSchema;

export const eventSummarySchema = z.object({
  id: z.string().uuid(),
  slug: slugSchema,
  name: z.string(),
  description: z.string().nullable(),
  coverUrl: z.string().url().nullable(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  timezone: z.string(),
  status: z.string(),
  dailyPhotoLimit: z.number().int(),
  totalPhotoLimit: z.number().int().nullable(),
  galleryVisibility: z.enum(GALLERY_VISIBILITIES),
});

export type EventSummary = z.infer<typeof eventSummarySchema>;
