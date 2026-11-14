import type { SupabaseClient } from "@supabase/supabase-js";

export type ReadinessCheckResult = {
  database: "ok" | "error";
  storage: "ok" | "error";
  errors?: {
    database?: string;
    storage?: string;
  };
};

export async function checkSupabaseReadiness(
  supabase: SupabaseClient,
  bucket: string,
): Promise<ReadinessCheckResult> {
  const [database, storage] = await Promise.all([
    supabase.from("admin_users").select("id", { head: true, count: "exact" }).limit(1),
    supabase.storage.from(bucket).list("", { limit: 1 }),
  ]);

  const result: ReadinessCheckResult = {
    database: database.error ? "error" : "ok",
    storage: storage.error ? "error" : "ok",
  };

  if (database.error || storage.error) {
    result.errors = {
      ...(database.error ? { database: database.error.message } : {}),
      ...(storage.error ? { storage: storage.error.message } : {}),
    };
  }

  return result;
}
