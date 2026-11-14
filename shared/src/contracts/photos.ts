import { z } from "zod";

import { ALLOWED_IMAGE_MIME_TYPES, PHOTO_STATUSES, UPLOAD_ITEM_STATUSES } from "../enums/index.js";
import { isoDateSchema, isoDateTimeSchema, paginationQuerySchema, uuidSchema } from "./common.js";

export const MAX_FILES_PER_UPLOAD = 10;
export const MAX_UPLOAD_ITEMS = 50;

export const uploadFileInputSchema = z.object({
  clientFileId: uuidSchema,
  filename: z
    .string()
    .trim()
    .min(1, "El archivo debe tener un nombre.")
    .max(255, "El nombre del archivo es demasiado largo."),
  mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES, {
    errorMap: () => ({ message: "Solo se admiten imágenes JPEG, PNG o WebP." }),
  }),
  sizeBytes: z.coerce
    .number()
    .int()
    .positive("El archivo está vacío.")
    .max(52_428_800, "El archivo supera el límite absoluto de 50 MB."),
});

export type UploadFileInput = z.infer<typeof uploadFileInputSchema>;

export const uploadIntentSchema = z
  .object({
    files: z
      .array(uploadFileInputSchema)
      .min(1, "Selecciona al menos una fotografía.")
      .max(
        MAX_FILES_PER_UPLOAD,
        `Puedes subir como máximo ${MAX_FILES_PER_UPLOAD} fotos a la vez.`,
      ),
  })
  .refine(
    (value) => new Set(value.files.map((file) => file.clientFileId)).size === value.files.length,
    {
      message: "Hay archivos duplicados en la selección.",
      path: ["files"],
    },
  );

export type UploadIntentInput = z.infer<typeof uploadIntentSchema>;

export const uploadSignedTargetSchema = z.object({
  itemId: uuidSchema,
  clientFileId: uuidSchema,
  storagePath: z.string().min(1),
  signedUrl: z.string().url(),
  token: z.string().min(1),
  expiresAt: isoDateTimeSchema,
});

export type UploadSignedTarget = z.infer<typeof uploadSignedTargetSchema>;

export const confirmUploadSchema = z.object({
  sessionId: uuidSchema,
  items: z
    .array(z.object({ itemId: uuidSchema }))
    .min(1)
    .max(MAX_UPLOAD_ITEMS)
    .optional(),
});

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export const releaseUploadSchema = z.object({
  sessionId: uuidSchema,
});

export type ReleaseUploadInput = z.infer<typeof releaseUploadSchema>;

export const uploadItemResultSchema = z.object({
  itemId: uuidSchema,
  clientFileId: uuidSchema,
  status: z.enum(UPLOAD_ITEM_STATUSES),
  photoId: uuidSchema.optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type UploadItemResult = z.infer<typeof uploadItemResultSchema>;

export const photoSchema = z.object({
  id: uuidSchema,
  url: z.string().url(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  eventDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  uploadedAt: isoDateTimeSchema,
  originalFilename: z.string(),
  mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
  fileSize: z.number().int().positive(),
  canDelete: z.boolean(),
});

export type Photo = z.infer<typeof photoSchema>;

export const photoListQuerySchema = paginationQuerySchema
  .extend({
    day: isoDateSchema.optional(),
  })
  .extend({ limit: z.coerce.number().int().min(1).max(60).default(24) });

export type PhotoListQuery = z.infer<typeof photoListQuerySchema>;

export const uploadIntentResultSchema = z.object({
  sessionId: uuidSchema,
  eventDay: isoDateSchema,
  expiresAt: isoDateTimeSchema,
  quota: z.object({
    remainingDay: z.number().int().nonnegative(),
    remainingTotal: z.number().int().nonnegative().nullable(),
  }),
  uploads: z.array(uploadSignedTargetSchema),
});

export type UploadIntentResult = z.infer<typeof uploadIntentResultSchema>;

export const uploadSessionSummarySchema = z.object({
  id: uuidSchema,
  status: z.enum(["reserved", "completed", "partially_completed", "expired", "cancelled"]),
  uploadedCount: z.number().int().nonnegative(),
  releasedCount: z.number().int().nonnegative(),
  eventDay: isoDateSchema,
});

export type UploadSessionSummary = z.infer<typeof uploadSessionSummarySchema>;

export const confirmUploadResultSchema = z.object({
  session: uploadSessionSummarySchema,
  results: z.array(uploadItemResultSchema),
  quota: z.object({
    eventDay: isoDateSchema,
    remainingDay: z.number().int().nonnegative(),
    remainingTotal: z.number().int().nonnegative().nullable(),
  }),
});

export type ConfirmUploadResult = z.infer<typeof confirmUploadResultSchema>;

export const releaseUploadResultSchema = z.object({
  session: uploadSessionSummarySchema,
  releasedNow: z.number().int().nonnegative(),
  quota: z.object({
    eventDay: isoDateSchema,
    remainingDay: z.number().int().nonnegative(),
    remainingTotal: z.number().int().nonnegative().nullable(),
  }),
});

export type ReleaseUploadResult = z.infer<typeof releaseUploadResultSchema>;

export const deletePhotoResultSchema = z.object({
  deleted: z.literal(true),
  quota: z.object({
    eventDay: isoDateSchema,
    remainingDay: z.number().int().nonnegative(),
    remainingTotal: z.number().int().nonnegative().nullable(),
  }),
});

export type DeletePhotoResult = z.infer<typeof deletePhotoResultSchema>;

export const photoIdParamSchema = z.object({
  id: uuidSchema,
});

export type PhotoIdParam = z.infer<typeof photoIdParamSchema>;

export const adminPhotoParticipantSchema = z.object({
  id: uuidSchema,
  displayName: z.string().nullable(),
  anonymous: z.boolean(),
});

export const adminPhotoSchema = photoSchema.omit({ canDelete: true }).extend({
  status: z.enum(PHOTO_STATUSES),
  deletedAt: isoDateTimeSchema.nullable(),
  participant: adminPhotoParticipantSchema,
});

export type AdminPhoto = z.infer<typeof adminPhotoSchema>;

export const adminPhotoListQuerySchema = paginationQuerySchema
  .extend({
    day: isoDateSchema.optional(),
    participantId: uuidSchema.optional(),
    search: z.string().trim().max(80).optional(),
    includeDeleted: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .extend({ limit: z.coerce.number().int().min(1).max(60).default(24) });

export type AdminPhotoListQuery = z.infer<typeof adminPhotoListQuerySchema>;
