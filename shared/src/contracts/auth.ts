import { z } from "zod";

import { ADMIN_ROLES } from "../enums/index.js";
import { isoDateTimeSchema, uuidSchema } from "./common.js";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Introduce un email válido.")
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Introduce tu contraseña.").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(12, "La nueva contraseña debe tener al menos 12 caracteres.")
    .max(128, "La nueva contraseña no puede superar los 128 caracteres."),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const adminIdentitySchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
  role: z.enum(ADMIN_ROLES),
});

export type AdminIdentity = z.infer<typeof adminIdentitySchema>;

export const adminUserSchema = adminIdentitySchema.extend({
  isActive: z.boolean(),
});

export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminSessionSchema = z.object({
  id: uuidSchema,
  expiresAt: isoDateTimeSchema,
  idleExpiresAt: isoDateTimeSchema,
});

export type AdminSession = z.infer<typeof adminSessionSchema>;

export const adminLoginResponseSchema = z.object({
  admin: adminIdentitySchema,
  csrfToken: z.string().min(32),
  session: adminSessionSchema,
});

export type AdminLoginResponse = z.infer<typeof adminLoginResponseSchema>;

export const adminMeResponseSchema = z.object({
  admin: adminUserSchema,
  session: adminSessionSchema,
});

export type AdminMeResponse = z.infer<typeof adminMeResponseSchema>;
