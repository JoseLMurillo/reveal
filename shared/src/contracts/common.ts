import { z } from "zod";

export const uuidSchema = z.string().uuid("Debe ser un UUID válido.");

export const slugSchema = z
  .string()
  .min(3, "El slug debe tener al menos 3 caracteres.")
  .max(80, "El slug no puede superar los 80 caracteres.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "El slug solo admite minúsculas, números y guiones simples.",
  );

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "La fecha no es válida.");

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: "La fecha y hora deben estar en formato ISO 8601." });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const galleryPaginationQuerySchema = paginationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationMetaSchema = z.object({
  page: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
    requestId: z.string().min(1),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

export type ApiSuccess<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  uptime: z.number().nonnegative(),
});

export const readinessResponseSchema = z.object({
  status: z.enum(["ready", "unavailable"]),
  checks: z.object({
    database: z.enum(["ok", "error"]),
    storage: z.enum(["ok", "error"]),
  }),
});

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
