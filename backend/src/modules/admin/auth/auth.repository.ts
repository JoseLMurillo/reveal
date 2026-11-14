import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminRecord, AdminSessionRecord } from "../shared/types.js";

type AdminRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: AdminRecord["role"];
  is_active: boolean;
  last_login_at: string | null;
  password_changed_at: string;
  created_at: string;
};

type SessionRow = {
  id: string;
  admin_user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  last_used_at: string;
  revoked_at: string | null;
};

const ADMIN_COLUMNS =
  "id, email, password_hash, display_name, role, is_active, last_login_at, password_changed_at, created_at";

const SESSION_COLUMNS =
  "id, admin_user_id, token_hash, created_at, expires_at, last_used_at, revoked_at";

function mapAdmin(row: AdminRow): AdminRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    passwordChangedAt: row.password_changed_at,
    createdAt: row.created_at,
  };
}

function mapSession(row: SessionRow): AdminSessionRecord {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

export type AdminRepository = {
  findByEmail(email: string): Promise<AdminRecord | null>;
  findById(id: string): Promise<AdminRecord | null>;
  touchLastLogin(id: string): Promise<void>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
};

export type AdminSessionRepository = {
  create(input: {
    adminUserId: string;
    tokenHash: string;
    expiresAt: string;
    ipHash: string | null;
    userAgent: string | null;
  }): Promise<AdminSessionRecord>;
  findByTokenHash(tokenHash: string): Promise<AdminSessionRecord | null>;
  touch(id: string, lastUsedAt: string): Promise<void>;
  revoke(id: string): Promise<void>;
  revokeAllForAdmin(adminUserId: string): Promise<number>;
};

export function createSupabaseAdminRepository(supabase: SupabaseClient): AdminRepository {
  return {
    async findByEmail(email) {
      const { data, error } = await supabase
        .from("admin_users")
        .select(ADMIN_COLUMNS)
        .eq("email", email)
        .maybeSingle<AdminRow>();

      if (error) {
        throw new Error(`No se pudo buscar el administrador: ${error.message}`);
      }

      return data ? mapAdmin(data) : null;
    },

    async findById(id) {
      const { data, error } = await supabase
        .from("admin_users")
        .select(ADMIN_COLUMNS)
        .eq("id", id)
        .maybeSingle<AdminRow>();

      if (error) {
        throw new Error(`No se pudo leer el administrador: ${error.message}`);
      }

      return data ? mapAdmin(data) : null;
    },

    async touchLastLogin(id) {
      const { error } = await supabase
        .from("admin_users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        throw new Error(`No se pudo actualizar el último acceso: ${error.message}`);
      }
    },

    async updatePassword(id, passwordHash) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("admin_users")
        .update({
          password_hash: passwordHash,
          password_changed_at: now,
          updated_at: now,
        })
        .eq("id", id);

      if (error) {
        throw new Error(`No se pudo actualizar la contraseña: ${error.message}`);
      }
    },
  };
}

export function createSupabaseAdminSessionRepository(
  supabase: SupabaseClient,
): AdminSessionRepository {
  return {
    async create(input) {
      const { data, error } = await supabase
        .from("admin_sessions")
        .insert({
          admin_user_id: input.adminUserId,
          token_hash: input.tokenHash,
          expires_at: input.expiresAt,
          ip_hash: input.ipHash,
          user_agent: input.userAgent,
        })
        .select(SESSION_COLUMNS)
        .single<SessionRow>();

      if (error || !data) {
        throw new Error(`No se pudo crear la sesión: ${error?.message ?? "sin datos"}`);
      }

      return mapSession(data);
    },

    async findByTokenHash(tokenHash) {
      const { data, error } = await supabase
        .from("admin_sessions")
        .select(SESSION_COLUMNS)
        .eq("token_hash", tokenHash)
        .maybeSingle<SessionRow>();

      if (error) {
        throw new Error(`No se pudo leer la sesión: ${error.message}`);
      }

      return data ? mapSession(data) : null;
    },

    async touch(id, lastUsedAt) {
      const { error } = await supabase
        .from("admin_sessions")
        .update({ last_used_at: lastUsedAt })
        .eq("id", id);

      if (error) {
        throw new Error(`No se pudo renovar la sesión: ${error.message}`);
      }
    },

    async revoke(id) {
      const { error } = await supabase
        .from("admin_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .is("revoked_at", null);

      if (error) {
        throw new Error(`No se pudo revocar la sesión: ${error.message}`);
      }
    },

    async revokeAllForAdmin(adminUserId) {
      const { count, error } = await supabase
        .from("admin_sessions")
        .update({ revoked_at: new Date().toISOString() }, { count: "exact" })
        .eq("admin_user_id", adminUserId)
        .is("revoked_at", null);

      if (error) {
        throw new Error(`No se pudieron revocar las sesiones: ${error.message}`);
      }

      return count ?? 0;
    },
  };
}
