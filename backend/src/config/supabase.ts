import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Env } from "./env.js";

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
} as const;

/**
 * Cliente con service_role. Único con acceso a tablas de negocio.
 * Nunca debe importarse desde el frontend ni registrarse en logs.
 */
export function createSupabaseAdminClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, clientOptions);
}
