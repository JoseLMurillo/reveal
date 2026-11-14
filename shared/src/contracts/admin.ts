import { z } from "zod";

import {
  ALBUM_STATUSES,
  ALLOWED_IMAGE_MIME_TYPES,
  EVENT_STATUSES,
  GALLERY_VISIBILITIES,
} from "../enums/index.js";
import {
  isoDateSchema,
  isoDateTimeSchema,
  paginationQuerySchema,
  slugSchema,
  uuidSchema,
} from "./common.js";
import {
  MAX_FILE_SIZE_MAX_BYTES,
  createEventSchema,
  eventSummarySchema,
  updateEventSchema,
} from "./events.js";

export const adminEventListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(EVENT_STATUSES).optional(),
  search: z.string().trim().max(80).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export type AdminEventListQuery = z.infer<typeof adminEventListQuerySchema>;

export const cancelEventSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Indica el motivo de la cancelación.")
    .max(280, "El motivo no puede superar los 280 caracteres."),
});

export type CancelEventInput = z.infer<typeof cancelEventSchema>;

export const deleteEventSchema = z.object({
  confirmName: z.string().trim().min(1).max(120),
});

export type DeleteEventInput = z.infer<typeof deleteEventSchema>;

export const eventIdParamSchema = z.object({
  id: uuidSchema,
});

export const adminEventStatsSchema = z.object({
  participants: z.number().int().nonnegative(),
  photos: z.number().int().nonnegative(),
  photosToday: z.number().int().nonnegative(),
  quotaConsumedToday: z.number().int().nonnegative(),
});

export const adminEventSummarySchema = eventSummarySchema.extend({
  status: z.enum(EVENT_STATUSES),
  participants: z.number().int().nonnegative(),
  photos: z.number().int().nonnegative(),
  photosToday: z.number().int().nonnegative(),
  quotaConsumedToday: z.number().int().nonnegative(),
  remainingSlots: z.number().int().nonnegative().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type AdminEventSummary = z.infer<typeof adminEventSummarySchema>;

export const adminEventCountsSchema = z.object({
  participants: z.number().int().nonnegative(),
  participantLimit: z.number().int().positive().nullable(),
  remainingSlots: z.number().int().nonnegative().nullable(),
  photos: z.number().int().nonnegative(),
  photosToday: z.number().int().nonnegative(),
});

export const adminEventAlbumSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  status: z.enum(ALBUM_STATUSES),
  visibility: z.enum(["private", "public"]),
});

export const adminEventDetailSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string(),
  description: z.string().nullable(),
  coverUrl: z.string().url().nullable(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  timezone: z.string(),
  dailyPhotoLimit: z.number().int(),
  totalPhotoLimit: z.number().int().nullable(),
  requireName: z.boolean(),
  showParticipantNames: z.boolean(),
  allowSelfRegistration: z.boolean(),
  participantLimit: z.number().int().nullable(),
  maxFileSizeBytes: z.number().int(),
  galleryVisibility: z.enum(GALLERY_VISIBILITIES),
  allowPhotoDeletion: z.boolean(),
  status: z.enum(EVENT_STATUSES),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  counts: adminEventCountsSchema,
  album: adminEventAlbumSchema.nullable(),
});

export type AdminEventDetail = z.infer<typeof adminEventDetailSchema>;

export const adminEventPhotoStatsSchema = z.object({
  event: z.object({
    id: uuidSchema,
    name: z.string(),
    status: z.enum(EVENT_STATUSES),
  }),
  totals: z.object({
    participants: z.number().int().nonnegative(),
    anonymousParticipants: z.number().int().nonnegative(),
    photos: z.number().int().nonnegative(),
    photosToday: z.number().int().nonnegative(),
    storageBytes: z.number().int().nonnegative(),
    deletedPhotos: z.number().int().nonnegative(),
  }),
  byDay: z.array(
    z.object({
      eventDay: isoDateSchema,
      dayNumber: z.number().int().positive(),
      photos: z.number().int().nonnegative(),
      participants: z.number().int().nonnegative(),
    }),
  ),
  topParticipants: z.array(
    z.object({
      participantId: uuidSchema,
      displayName: z.string().nullable(),
      photos: z.number().int().nonnegative(),
    }),
  ),
});

export type AdminEventPhotoStats = z.infer<typeof adminEventPhotoStatsSchema>;

export const adminEventActivityQuerySchema = paginationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminEventActivityQuery = z.infer<typeof adminEventActivityQuerySchema>;

export const adminActivityEntrySchema = z.object({
  id: z.number().int().positive(),
  action: z.string(),
  entityType: z.string().nullable(),
  entityId: uuidSchema.nullable(),
  metadata: z.record(z.unknown()),
  createdAt: isoDateTimeSchema,
});

export type AdminActivityEntry = z.infer<typeof adminActivityEntrySchema>;

export const adminPhotoDownloadParamSchema = z.object({
  eventId: uuidSchema,
  photoId: uuidSchema,
});

export type AdminPhotoDownloadParam = z.infer<typeof adminPhotoDownloadParamSchema>;

export const adminEventCreateResultSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  status: z.enum(EVENT_STATUSES),
  publicPath: z.string(),
  createdAt: isoDateTimeSchema,
});

export type AdminEventCreateResult = z.infer<typeof adminEventCreateResultSchema>;

export const dashboardSchema = z.object({
  totals: z.object({
    events: z.number().int().nonnegative(),
    activeEvents: z.number().int().nonnegative(),
    participants: z.number().int().nonnegative(),
    photos: z.number().int().nonnegative(),
    photosToday: z.number().int().nonnegative(),
  }),
  events: z.array(adminEventSummarySchema),
  recentActivity: z.array(
    z.object({
      id: z.number().int(),
      action: z.string(),
      eventId: uuidSchema.nullable(),
      eventName: z.string().nullable(),
      createdAt: isoDateTimeSchema,
    }),
  ),
});

export type AdminDashboard = z.infer<typeof dashboardSchema>;

export const coverUploadIntentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_MAX_BYTES),
});

export type CoverUploadIntentInput = z.infer<typeof coverUploadIntentSchema>;

export const coverConfirmSchema = z.object({
  storagePath: z.string().trim().min(1).max(512),
});

export type CoverConfirmInput = z.infer<typeof coverConfirmSchema>;

export const qrQuerySchema = z.object({
  format: z.enum(["png", "svg"]).default("png"),
  download: z.enum(["0", "1"]).optional(),
  size: z.coerce.number().int().min(256).max(2048).default(1024),
});

export type QrQuery = z.infer<typeof qrQuerySchema>;

export const eventPayloadSchema = createEventSchema;
export const eventUpdatePayloadSchema = updateEventSchema;
