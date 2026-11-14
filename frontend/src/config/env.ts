import { z } from "zod";

const envSchema = z.object({
  VITE_API_URL: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : "/api")),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Configuración del frontend inválida:\n${details}`);
}

const apiUrl = parsed.data.VITE_API_URL.replace(/\/+$/, "");

export const env = {
  apiUrl: apiUrl.length > 0 ? apiUrl : "/api",
} as const;
