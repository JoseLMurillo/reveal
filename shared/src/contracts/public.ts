import { z } from "zod";

import {
  EVENT_EFFECTIVE_STATUSES,
  GALLERY_VISIBILITIES,
  REGISTRATION_REASONS,
} from "../enums/index.js";
import { isoDateSchema, isoDateTimeSchema, slugSchema } from "./common.js";
import {
  accessLinkSchema,
  displayNameSchema,
  participantEventSchema,
  participantSchema,
  participantSessionSchema,
  quotaSchema,
  registrationCountSchema,
} from "./participants.js";

export const eventSlugParamSchema = z.object({
  slug: slugSchema,
});

export const redeemAccessCodeSchema = z.object({
  accessCode: z
    .string()
    .trim()
    .min(16, "El enlace de acceso no es válido.")
    .max(256, "El enlace de acceso no es válido."),
  displayName: displayNameSchema.optional(),
});

export type RedeemAccessCodeInput = z.infer<typeof redeemAccessCodeSchema>;

export const registerParticipantSchema = z.object({
  displayName: displayNameSchema.optional(),
});

export type RegisterParticipantInput = z.infer<typeof registerParticipantSchema>;

export const publicEventDayQuerySchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const registrationInfoSchema = registrationCountSchema.extend({
  enabled: z.boolean(),
  open: z.boolean(),
  reason: z.enum(REGISTRATION_REASONS).nullable(),
});

export type RegistrationInfo = z.infer<typeof registrationInfoSchema>;

export const publicEventSchema = z.object({
  slug: slugSchema,
  name: z.string(),
  description: z.string().nullable(),
  coverUrl: z.string().url().nullable(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  timezone: z.string(),
  status: z.string(),
  effectiveStatus: z.enum(EVENT_EFFECTIVE_STATUSES),
  currentEventDay: isoDateSchema,
  dayNumber: z.number().int().positive(),
  totalDays: z.number().int().positive(),
  dailyPhotoLimit: z.number().int().positive(),
  totalPhotoLimit: z.number().int().positive().nullable(),
  requireName: z.boolean(),
  showParticipantNames: z.boolean(),
  maxFileSizeBytes: z.number().int().positive(),
  galleryVisibility: z.enum(GALLERY_VISIBILITIES),
  allowPhotoDeletion: z.boolean(),
  registration: registrationInfoSchema,
  canRegister: z.boolean(),
  quotaResetsAt: isoDateTimeSchema,
  publicAlbumSlug: slugSchema.nullable(),
});

export type PublicEvent = z.infer<typeof publicEventSchema>;

export const publicEventStatusSchema = z.object({
  status: z.string(),
  effectiveStatus: z.enum(EVENT_EFFECTIVE_STATUSES),
  currentEventDay: isoDateSchema,
  dayNumber: z.number().int().positive(),
  canRegister: z.boolean(),
  canUpload: z.boolean(),
  registration: registrationInfoSchema,
  quotaResetsAt: isoDateTimeSchema,
});

export type PublicEventStatus = z.infer<typeof publicEventStatusSchema>;

export const redeemAccessResponseSchema = z.object({
  participant: participantSchema,
  session: participantSessionSchema,
  event: participantEventSchema,
  quota: quotaSchema,
});

export type RedeemAccessResponse = z.infer<typeof redeemAccessResponseSchema>;

export const registerParticipantResponseSchema = z.object({
  participant: participantSchema,
  access: accessLinkSchema,
  session: participantSessionSchema,
  registration: registrationCountSchema,
  event: participantEventSchema,
  quota: quotaSchema,
});

export type RegisterParticipantResponse = z.infer<typeof registerParticipantResponseSchema>;
