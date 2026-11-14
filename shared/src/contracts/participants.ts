import { z } from "zod";

import { EVENT_STATUSES, PARTICIPANT_SOURCES } from "../enums/index.js";
import {
  isoDateSchema,
  isoDateTimeSchema,
  paginationQuerySchema,
  slugSchema,
  uuidSchema,
} from "./common.js";

const CONTROL_CHARACTERS = /\p{Cc}/u;

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "El nombre no puede estar vacío.")
  .max(60, "El nombre no puede superar los 60 caracteres.")
  .refine((value) => !CONTROL_CHARACTERS.test(value), "El nombre contiene caracteres no válidos.");

export const participantNoteSchema = z
  .string()
  .trim()
  .max(280, "La nota no puede superar los 280 caracteres.");

/**
 * El panel envía `null` o una cadena vacía para borrar el nombre o la nota.
 */
export const nullableDisplayNameSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  displayNameSchema.nullable(),
);

export const nullableParticipantNoteSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  participantNoteSchema.nullable(),
);

export const updateParticipantSchema = z.object({
  displayName: displayNameSchema,
});

export type UpdateParticipantInput = z.infer<typeof updateParticipantSchema>;

export const participantSchema = z.object({
  id: uuidSchema,
  displayName: z.string().nullable(),
  anonymous: z.boolean(),
  registrationSource: z.enum(PARTICIPANT_SOURCES),
  createdAt: isoDateTimeSchema,
});

export type Participant = z.infer<typeof participantSchema>;

export const participantSessionSchema = z.object({
  token: z.string().min(32),
  expiresAt: isoDateTimeSchema,
});

export type ParticipantSession = z.infer<typeof participantSessionSchema>;

export const quotaSchema = z.object({
  eventDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayNumber: z.number().int().positive(),
  dailyLimit: z.number().int().positive(),
  totalLimit: z.number().int().positive().nullable(),
  usedDay: z.number().int().nonnegative(),
  usedTotal: z.number().int().nonnegative(),
  reservedDay: z.number().int().nonnegative(),
  reservedTotal: z.number().int().nonnegative(),
  remainingDay: z.number().int().nonnegative(),
  remainingTotal: z.number().int().nonnegative().nullable(),
  resetsAt: isoDateTimeSchema,
  eventStatus: z.enum(EVENT_STATUSES),
});

export type Quota = z.infer<typeof quotaSchema>;

export const participantEventSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string(),
  status: z.enum(EVENT_STATUSES),
  effectiveStatus: z.enum([
    "draft",
    "scheduled",
    "active",
    "out_of_dates",
    "finished",
    "cancelled",
  ]),
  timezone: z.string(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  maxFileSizeBytes: z.number().int().positive(),
});

export type ParticipantEvent = z.infer<typeof participantEventSchema>;

export const participantPermissionsSchema = z.object({
  canUpload: z.boolean(),
  canDeletePhotos: z.boolean(),
  canViewGallery: z.boolean(),
  canChangeName: z.boolean(),
});

export type ParticipantPermissions = z.infer<typeof participantPermissionsSchema>;

export const participantMeSchema = z.object({
  participant: participantSchema,
  session: z.object({ expiresAt: isoDateTimeSchema }),
  event: participantEventSchema,
  quota: quotaSchema,
  permissions: participantPermissionsSchema,
});

export type ParticipantMe = z.infer<typeof participantMeSchema>;

export const adminCreateParticipantSchema = z.object({
  displayName: nullableDisplayNameSchema.optional(),
  note: nullableParticipantNoteSchema.optional(),
});

export type AdminCreateParticipantInput = z.infer<typeof adminCreateParticipantSchema>;

export const adminBulkCreateParticipantsSchema = z.object({
  participants: z
    .array(adminCreateParticipantSchema)
    .min(1, "Crea al menos un participante.")
    .max(100, "No se pueden crear más de 100 participantes de una vez."),
});

export type AdminBulkCreateParticipantsInput = z.infer<typeof adminBulkCreateParticipantsSchema>;

export const adminUpdateParticipantSchema = z
  .object({
    displayName: nullableDisplayNameSchema.optional(),
    note: nullableParticipantNoteSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.displayName !== undefined || value.note !== undefined || value.isActive !== undefined,
    { message: "Indica al menos un campo para actualizar." },
  );

export type AdminUpdateParticipantInput = z.infer<typeof adminUpdateParticipantSchema>;

export const accessCodeActionSchema = z.object({
  revokeSessions: z.boolean().default(true),
});

export type AccessCodeActionInput = z.infer<typeof accessCodeActionSchema>;

const booleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

export const adminParticipantListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(80).optional(),
  anonymous: booleanQuerySchema,
  isActive: booleanQuerySchema,
  source: z.enum(PARTICIPANT_SOURCES).optional(),
});

export type AdminParticipantListQuery = z.infer<typeof adminParticipantListQuerySchema>;

export const participantIdParamSchema = z.object({
  participantId: uuidSchema,
});

export const ACCESS_CODE_STATUSES = ["active", "revoked", "none"] as const;
export type AccessCodeStatus = (typeof ACCESS_CODE_STATUSES)[number];

export const adminParticipantSchema = participantSchema.extend({
  note: z.string().nullable(),
  accessCodePrefix: z.string(),
  accessCodeStatus: z.enum(ACCESS_CODE_STATUSES),
  isActive: z.boolean(),
  lastSeenAt: isoDateTimeSchema,
  photosTotal: z.number().int().nonnegative(),
  photosToday: z.number().int().nonnegative(),
  remainingToday: z.number().int().nonnegative().nullable(),
});

export type AdminParticipant = z.infer<typeof adminParticipantSchema>;

export const accessLinkSchema = z.object({
  code: z.string().min(16),
  url: z.string().url(),
  createdAt: isoDateTimeSchema,
});

export type AccessLink = z.infer<typeof accessLinkSchema>;

export const registrationCountSchema = z.object({
  limit: z.number().int().positive().nullable(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative().nullable(),
});

export type RegistrationCount = z.infer<typeof registrationCountSchema>;

export const adminCreatedParticipantSchema = participantSchema.extend({
  note: z.string().nullable(),
  accessCodePrefix: z.string(),
  isActive: z.boolean(),
  lastSeenAt: isoDateTimeSchema,
});

export type AdminCreatedParticipant = z.infer<typeof adminCreatedParticipantSchema>;

export const adminParticipantCreateResultSchema = z.object({
  participant: adminCreatedParticipantSchema,
  access: accessLinkSchema,
  registration: registrationCountSchema,
});

export type AdminParticipantCreateResult = z.infer<typeof adminParticipantCreateResultSchema>;

export const adminParticipantBulkResultSchema = z.object({
  created: z.array(adminParticipantCreateResultSchema),
  registration: registrationCountSchema,
});

export type AdminParticipantBulkResult = z.infer<typeof adminParticipantBulkResultSchema>;

export const adminAccessCodeRotateResultSchema = z.object({
  participantId: uuidSchema,
  access: accessLinkSchema,
  sessionsRevoked: z.boolean(),
});

export type AdminAccessCodeRotateResult = z.infer<typeof adminAccessCodeRotateResultSchema>;

export const adminAccessCodeRevokeResultSchema = z.object({
  participantId: uuidSchema,
  accessCodeStatus: z.literal("revoked"),
  sessionsRevoked: z.boolean(),
});

export type AdminAccessCodeRevokeResult = z.infer<typeof adminAccessCodeRevokeResultSchema>;
