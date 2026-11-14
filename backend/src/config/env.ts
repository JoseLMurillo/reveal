import "dotenv/config";

import { z } from "zod";

const trimmedUrl = z
  .string()
  .trim()
  .url("Debe ser una URL válida.")
  .transform((value) => value.replace(/\/+$/, ""));

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const optionalServerKey = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(z.string().min(20, "La clave del servidor no es válida.").optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    FRONTEND_URL: trimmedUrl,
    TRUST_PROXY: z.string().trim().default("1"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),

    SUPABASE_URL: trimmedUrl,
    SUPABASE_SERVICE_ROLE_KEY: optionalServerKey,
    SUPABASE_ANON_KEY: optionalServerKey,
    SUPABASE_STORAGE_BUCKET: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, "Nombre de bucket no válido.")
      .default("rollo-originals"),

    ADMIN_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(604_800).default(43_200),
    ADMIN_SESSION_IDLE_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3_600),
    COOKIE_DOMAIN: optionalString,

    PARTICIPANT_SESSION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(3_600)
      .max(31_536_000)
      .default(2_592_000),

    UPLOAD_SESSION_TTL_SECONDS: z.coerce.number().int().min(60).max(1_800).default(900),
    MAX_FILES_PER_UPLOAD: z.coerce.number().int().min(1).max(50).default(10),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3_600),

    CLEANUP_INTERVAL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(300),
  })
  .superRefine((data, context) => {
    if (!data.SUPABASE_SERVICE_ROLE_KEY && !data.SUPABASE_ANON_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
        message:
          "Define SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY con una secret key de Supabase.",
      });
    }
  });

export type Env = Omit<z.infer<typeof envSchema>, "SUPABASE_SERVICE_ROLE_KEY"> & {
  /**
   * Clave de servidor resuelta. Se acepta `SUPABASE_SERVICE_ROLE_KEY` o, en su
   * defecto, una secret key guardada en `SUPABASE_ANON_KEY`.
   */
  SUPABASE_SERVICE_ROLE_KEY: string;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
};

export class EnvValidationError extends Error {
  public readonly issues: string[];

  public constructor(issues: string[]) {
    super(`Variables de entorno inválidas:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`,
    );
    throw new EnvValidationError(issues);
  }

  const serverKey = parsed.data.SUPABASE_SERVICE_ROLE_KEY ?? parsed.data.SUPABASE_ANON_KEY;

  if (!serverKey) {
    throw new EnvValidationError(["SUPABASE_SERVICE_ROLE_KEY: falta la clave del servidor."]);
  }

  return {
    ...parsed.data,
    SUPABASE_SERVICE_ROLE_KEY: serverKey,
    isProduction: parsed.data.NODE_ENV === "production",
    isDevelopment: parsed.data.NODE_ENV === "development",
    isTest: parsed.data.NODE_ENV === "test",
  };
}

export function parseTrustProxy(value: string): boolean | number | string {
  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false" || normalized === "") {
    return false;
  }

  const numeric = Number(normalized);

  if (Number.isInteger(numeric) && numeric >= 0) {
    return numeric;
  }

  return value.trim();
}
