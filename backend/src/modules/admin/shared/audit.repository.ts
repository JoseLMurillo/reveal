import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuditEntry, AuditInput } from "./types.js";

export type AuditRepository = {
  record(input: AuditInput): Promise<void>;
  listRecent(eventIds: string[] | null, limit: number): Promise<AuditEntry[]>;
};

type AuditRow = {
  id: number;
  action: string;
  event_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  events: { name: string } | { name: string }[] | null;
};

function eventNameOf(row: AuditRow): string | null {
  if (!row.events) {
    return null;
  }

  if (Array.isArray(row.events)) {
    return row.events[0]?.name ?? null;
  }

  return row.events.name;
}

export function createSupabaseAuditRepository(supabase: SupabaseClient): AuditRepository {
  return {
    async record(input) {
      const { error } = await supabase.from("audit_logs").insert({
        admin_id: input.adminId,
        event_id: input.eventId ?? null,
        action: input.action,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        metadata: input.metadata ?? {},
        ip_hash: input.ipHash ?? null,
      });

      if (error) {
        throw new Error(`No se pudo registrar la auditoría: ${error.message}`);
      }
    },

    async listRecent(eventIds, limit) {
      let query = supabase
        .from("audit_logs")
        .select("id, action, event_id, metadata, created_at, events(name)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (eventIds !== null) {
        if (eventIds.length === 0) {
          return [];
        }
        query = query.in("event_id", eventIds);
      }

      const { data, error } = await query.returns<AuditRow[]>();

      if (error) {
        throw new Error(`No se pudo leer la auditoría: ${error.message}`);
      }

      return data.map((row) => ({
        id: row.id,
        action: row.action,
        eventId: row.event_id,
        eventName: eventNameOf(row),
        metadata: row.metadata ?? {},
        createdAt: row.created_at,
      }));
    },
  };
}
