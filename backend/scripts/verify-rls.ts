import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "../src/config/env.js";

const TABLES = [
  "admin_users",
  "admin_sessions",
  "events",
  "participants",
  "participant_sessions",
  "upload_sessions",
  "upload_items",
  "photos",
  "albums",
  "album_photos",
  "audit_logs",
  "storage_cleanup_queue",
] as const;

async function main(): Promise<void> {
  const env = loadEnv();

  if (!env.SUPABASE_ANON_KEY) {
    throw new Error("Define SUPABASE_ANON_KEY con una publishable/anon key para verificar RLS.");
  }

  if (env.SUPABASE_ANON_KEY.startsWith("sb_secret_")) {
    throw new Error(
      "rls:verify requiere una publishable/anon key; una secret key omite RLS y no sirve para esta prueba.",
    );
  }

  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  let leaked = false;

  process.stdout.write("Verificando RLS con la anon_key…\n");

  for (const table of TABLES) {
    const { data, error, count } = await anon
      .from(table)
      .select("*", { head: true, count: "exact" })
      .limit(1);

    const exposed = !error && (count ?? 0) > 0;
    const status = exposed ? "FUGA" : error ? "bloqueado" : "vacío";

    if (exposed || (data !== null && data.length > 0)) {
      leaked = true;
    }

    process.stdout.write(`  ${table.padEnd(28)} ${status}\n`);
  }

  const { data: objects, error: storageError } = await anon.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .list("", { limit: 1 });

  const storageExposed = !storageError && (objects?.length ?? 0) > 0;
  if (storageExposed) {
    leaked = true;
  }

  process.stdout.write(
    `  ${"storage".padEnd(28)} ${storageExposed ? "FUGA" : storageError ? "bloqueado" : "vacío"}\n`,
  );

  if (leaked) {
    process.stderr.write("\nFallo: la anon_key puede leer datos que deberían ser privados.\n");
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    "\nRLS correcto: anon no puede leer tablas de negocio ni listar el bucket privado.\n",
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error verificando RLS: ${message}\n`);
  process.exitCode = 1;
});
