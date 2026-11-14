import { z } from "zod";

import { loadEnv } from "../src/config/env.js";
import { createSupabaseAdminClient } from "../src/config/supabase.js";
import { hashPassword } from "../src/utils/password.js";
import { parseArgs, readSecret, stringValue } from "./lib/cli.js";

const emailSchema = z.string().trim().email("Email no válido.").max(254);
const nameSchema = z.string().trim().min(1, "El nombre es obligatorio.").max(80);
const roleSchema = z.enum(["owner", "admin"]);

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function requestPassword(): Promise<string> {
  const password = await readSecret("Contraseña (mínimo 12 caracteres): ");
  const confirmation = await readSecret("Repite la contraseña: ");

  if (password !== confirmation) {
    fail("Las contraseñas no coinciden.");
  }

  if (password.length < 12 || password.length > 128) {
    fail("La contraseña debe tener entre 12 y 128 caracteres.");
  }

  return password;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs(process.argv.slice(2));
  const resetPassword = values["reset-password"] === true;
  const emailInput =
    stringValue(values, "email") ?? (resetPassword ? positionals[0] : positionals[0]);
  const nameInput = stringValue(values, "name");
  const roleInput = stringValue(values, "role") ?? "admin";

  const emailResult = emailSchema.safeParse(emailInput);
  if (!emailResult.success) {
    fail('Uso: npm run admin:create -- --email admin@example.com --name "Admin" [--role owner]');
  }

  const email = emailResult.data.toLowerCase();
  const env = loadEnv();
  const supabase = createSupabaseAdminClient(env);

  if (resetPassword) {
    const { data: admin, error: findError } = await supabase
      .from("admin_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (findError) {
      fail(`No se pudo buscar el administrador: ${findError.message}`);
    }

    if (!admin) {
      fail("No existe un administrador con ese email.");
    }

    const password = await requestPassword();
    const passwordHash = await hashPassword(password);

    const { error: updateError } = await supabase
      .from("admin_users")
      .update({
        password_hash: passwordHash,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", admin.id);

    if (updateError) {
      fail(`No se pudo actualizar la contraseña: ${updateError.message}`);
    }

    const { error: revokeError } = await supabase
      .from("admin_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("admin_user_id", admin.id)
      .is("revoked_at", null);

    if (revokeError) {
      fail(
        `La contraseña cambió, pero no se pudieron revocar las sesiones: ${revokeError.message}`,
      );
    }

    process.stdout.write("Contraseña actualizada y sesiones revocadas.\n");
    return;
  }

  const nameResult = nameSchema.safeParse(nameInput ?? "Administrador");
  if (!nameResult.success) {
    fail(nameResult.error.issues[0]?.message ?? "Nombre no válido.");
  }

  const roleResult = roleSchema.safeParse(roleInput);
  if (!roleResult.success) {
    fail("El rol debe ser owner o admin.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    fail(`No se pudo comprobar el email: ${existingError.message}`);
  }

  if (existing) {
    fail("Ya existe un administrador con ese email.");
  }

  const { count, error: countError } = await supabase
    .from("admin_users")
    .select("id", { head: true, count: "exact" });

  if (countError) {
    fail(`No se pudo comprobar el estado inicial: ${countError.message}`);
  }

  const role = (count ?? 0) === 0 ? "owner" : roleResult.data;
  const password = await requestPassword();
  const passwordHash = await hashPassword(password);

  const { error: insertError } = await supabase.from("admin_users").insert({
    email,
    display_name: nameResult.data,
    password_hash: passwordHash,
    role,
  });

  if (insertError) {
    fail(`No se pudo crear el administrador: ${insertError.message}`);
  }

  process.stdout.write(`Administrador creado con rol ${role}. No se ha mostrado la contraseña.\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
