import type { SupabaseClient } from "@supabase/supabase-js";

import { mapDatabaseError } from "../../utils/rpc-error.js";
import { EVENT_COLUMNS, mapEvent } from "../admin/events/events.repository.js";
import type { EventRecord } from "../admin/shared/types.js";
import type { ParticipantRecord, ParticipantSessionRecord, QuotaRecord } from "./types.js";

export const PARTICIPANT_COLUMNS =
  "id, event_id, display_name, note, registration_source, access_code_hash, access_code_prefix, access_code_created_at, access_code_revoked_at, is_active, created_at, updated_at, last_seen_at";

type ParticipantRow = {
  id: string;
  event_id: string;
  display_name: string | null;
  note: string | null;
  registration_source: ParticipantRecord["registrationSource"];
  access_code_hash: string;
  access_code_prefix: string;
  access_code_created_at: string;
  access_code_revoked_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
};

type SessionRow = {
  id: string;
  participant_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  last_used_at: string;
  revoked_at: string | null;
};

export function mapParticipant(row: ParticipantRow): ParticipantRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    displayName: row.display_name,
    note: row.note,
    registrationSource: row.registration_source,
    accessCodeHash: row.access_code_hash,
    accessCodePrefix: row.access_code_prefix,
    accessCodeCreatedAt: row.access_code_created_at,
    accessCodeRevokedAt: row.access_code_revoked_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  };
}

function mapSession(row: SessionRow): ParticipantSessionRecord {
  return {
    id: row.id,
    participantId: row.participant_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

export type ParticipantRepository = {
  findSessionByTokenHash(tokenHash: string): Promise<ParticipantSessionRecord | null>;
  findParticipantById(id: string): Promise<ParticipantRecord | null>;
  findEventById(id: string): Promise<EventRecord | null>;
  touchSession(id: string, lastUsedAt: string): Promise<void>;
  revokeSessionsForParticipant(participantId: string): Promise<void>;
  getQuota(participantId: string): Promise<QuotaRecord>;
  updateDisplayName(participantId: string, displayName: string): Promise<ParticipantRecord>;
};

export function createSupabaseParticipantRepository(
  supabase: SupabaseClient,
): ParticipantRepository {
  return {
    async findSessionByTokenHash(tokenHash) {
      const { data, error } = await supabase
        .from("participant_sessions")
        .select("id, participant_id, token_hash, created_at, expires_at, last_used_at, revoked_at")
        .eq("token_hash", tokenHash)
        .maybeSingle<SessionRow>();

      if (error) {
        throw new Error(`No se pudo leer la sesión del participante: ${error.message}`);
      }

      return data ? mapSession(data) : null;
    },

    async findParticipantById(id) {
      const { data, error } = await supabase
        .from("participants")
        .select(PARTICIPANT_COLUMNS)
        .eq("id", id)
        .maybeSingle<ParticipantRow>();

      if (error) {
        throw new Error(`No se pudo leer el participante: ${error.message}`);
      }

      return data ? mapParticipant(data) : null;
    },

    async findEventById(id) {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_COLUMNS)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new Error(`No se pudo leer el evento: ${error.message}`);
      }

      return data ? mapEvent(data) : null;
    },

    async touchSession(id, lastUsedAt) {
      const { error } = await supabase
        .from("participant_sessions")
        .update({ last_used_at: lastUsedAt })
        .eq("id", id);

      if (error) {
        throw new Error(`No se pudo actualizar la sesión del participante: ${error.message}`);
      }
    },

    async revokeSessionsForParticipant(participantId) {
      const { error } = await supabase
        .from("participant_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("participant_id", participantId)
        .is("revoked_at", null);

      if (error) {
        throw new Error(`No se pudieron revocar las sesiones del participante: ${error.message}`);
      }
    },

    async getQuota(participantId) {
      const { data, error } = await supabase.rpc("get_participant_quota", {
        p_participant_id: participantId,
      });

      if (error || !data) {
        throw mapDatabaseError(error, "No se pudo calcular la cuota del participante.");
      }

      return data as QuotaRecord;
    },

    async updateDisplayName(participantId, displayName) {
      const { data, error } = await supabase
        .from("participants")
        .update({ display_name: displayName, updated_at: new Date().toISOString() })
        .eq("id", participantId)
        .select(PARTICIPANT_COLUMNS)
        .single<ParticipantRow>();

      if (error || !data) {
        throw new Error(`No se pudo actualizar el nombre: ${error?.message ?? "sin datos"}`);
      }

      return mapParticipant(data);
    },
  };
}
