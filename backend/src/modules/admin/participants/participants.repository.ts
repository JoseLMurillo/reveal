import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminParticipantListQuery } from "@rollo/shared";

import { mapDatabaseError } from "../../../utils/rpc-error.js";
import { PARTICIPANT_COLUMNS, mapParticipant } from "../../participants/participants.repository.js";
import type {
  CreatedParticipantRow,
  ParticipantRecord,
  ParticipantPhotoStats,
} from "../../participants/types.js";

type ParticipantRow = Parameters<typeof mapParticipant>[0];

type StatsRow = {
  participant_id: string;
  photos_total: number;
  photos_today: number;
  reserved_today: number;
};

export type NewParticipantEntry = {
  displayName: string | null;
  note: string | null;
  accessCodeHash: string;
  accessCodePrefix: string;
};

export type CreateParticipantsRpcResult = {
  participants: CreatedParticipantRow[];
  remainingSlots: number | null;
};

export type RotateAccessCodeResult = {
  participantId: string;
  accessCodePrefix: string;
  accessCodeCreatedAt: string;
  revokedSessions: number;
};

export type RevokeAccessCodeResult = {
  participantId: string;
  accessCodeRevokedAt: string;
  revokedSessions: number;
};

export type SetActiveResult = {
  participantId: string;
  isActive: boolean;
  revokedSessions: number;
};

export type AdminParticipantUpdateValues = {
  displayName?: string | null;
  note?: string | null;
};

export type AdminParticipantsRepository = {
  list(
    eventId: string,
    filters: AdminParticipantListQuery,
  ): Promise<{ rows: ParticipantRecord[]; total: number }>;
  findById(id: string): Promise<ParticipantRecord | null>;
  countParticipants(eventId: string): Promise<number>;
  create(
    eventId: string,
    entries: NewParticipantEntry[],
    adminId: string,
  ): Promise<CreateParticipantsRpcResult>;
  stats(participantIds: string[], eventDay: string): Promise<Map<string, ParticipantPhotoStats>>;
  updateProfile(
    participantId: string,
    values: AdminParticipantUpdateValues,
  ): Promise<ParticipantRecord>;
  rotateAccessCode(
    participantId: string,
    accessCodeHash: string,
    accessCodePrefix: string,
    revokeSessions: boolean,
  ): Promise<RotateAccessCodeResult>;
  revokeAccessCode(participantId: string, revokeSessions: boolean): Promise<RevokeAccessCodeResult>;
  setActive(participantId: string, isActive: boolean): Promise<SetActiveResult>;
};

function sanitizeSearch(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function createSupabaseAdminParticipantsRepository(
  supabase: SupabaseClient,
): AdminParticipantsRepository {
  return {
    async list(eventId, filters) {
      let query = supabase
        .from("participants")
        .select(PARTICIPANT_COLUMNS, { count: "exact" })
        .eq("event_id", eventId);

      if (filters.source) {
        query = query.eq("registration_source", filters.source);
      }

      if (filters.isActive !== undefined) {
        query = query.eq("is_active", filters.isActive);
      }

      if (filters.anonymous === true) {
        query = query.is("display_name", null);
      } else if (filters.anonymous === false) {
        query = query.not("display_name", "is", null);
      }

      if (filters.search) {
        const search = sanitizeSearch(filters.search);

        if (search.length > 0) {
          query = query.or(
            `display_name.ilike.%${search}%,note.ilike.%${search}%,access_code_prefix.ilike.%${search}%`,
          );
        }
      }

      const offset = (filters.page - 1) * filters.limit;
      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + filters.limit - 1)
        .returns<ParticipantRow[]>();

      if (error) {
        throw new Error(`No se pudieron listar los participantes: ${error.message}`);
      }

      return { rows: data.map(mapParticipant), total: count ?? data.length };
    },

    async findById(id) {
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

    async countParticipants(eventId) {
      const { count, error } = await supabase
        .from("participants")
        .select("id", { head: true, count: "exact" })
        .eq("event_id", eventId);

      if (error) {
        throw new Error(`No se pudieron contar los participantes: ${error.message}`);
      }

      return count ?? 0;
    },

    async create(eventId, entries, adminId) {
      const { data, error } = await supabase.rpc("create_admin_participants", {
        p_event_id: eventId,
        p_entries: entries.map((entry) => ({
          displayName: entry.displayName,
          note: entry.note,
          accessCodeHash: entry.accessCodeHash,
          accessCodePrefix: entry.accessCodePrefix,
        })),
        p_admin_id: adminId,
      });

      if (error || !data) {
        throw mapDatabaseError(error, "No se pudieron crear los participantes.");
      }

      return data as CreateParticipantsRpcResult;
    },

    async stats(participantIds, eventDay) {
      if (participantIds.length === 0) {
        return new Map();
      }

      const { data, error } = await supabase
        .rpc("admin_participant_stats", {
          p_participant_ids: participantIds,
          p_event_day: eventDay,
        })
        .returns<StatsRow[]>();

      if (error) {
        throw new Error(`No se pudieron leer las estadísticas de participantes: ${error.message}`);
      }

      return new Map(
        ((data ?? []) as StatsRow[]).map((row) => [
          row.participant_id,
          {
            photosTotal: row.photos_total,
            photosToday: row.photos_today,
            reservedToday: row.reserved_today,
          },
        ]),
      );
    },

    async updateProfile(participantId, values) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (values.displayName !== undefined) {
        patch.display_name = values.displayName;
      }

      if (values.note !== undefined) {
        patch.note = values.note;
      }

      const { data, error } = await supabase
        .from("participants")
        .update(patch)
        .eq("id", participantId)
        .select(PARTICIPANT_COLUMNS)
        .single<ParticipantRow>();

      if (error || !data) {
        throw new Error(`No se pudo actualizar el participante: ${error?.message ?? "sin datos"}`);
      }

      return mapParticipant(data);
    },

    async rotateAccessCode(participantId, accessCodeHash, accessCodePrefix, revokeSessions) {
      const { data, error } = await supabase.rpc("rotate_participant_access_code", {
        p_participant_id: participantId,
        p_new_code_hash: accessCodeHash,
        p_new_code_prefix: accessCodePrefix,
        p_revoke_sessions: revokeSessions,
      });

      if (error || !data) {
        throw mapDatabaseError(error, "No se pudo regenerar el código de acceso.");
      }

      return data as RotateAccessCodeResult;
    },

    async revokeAccessCode(participantId, revokeSessions) {
      const { data, error } = await supabase.rpc("revoke_participant_access_code", {
        p_participant_id: participantId,
        p_revoke_sessions: revokeSessions,
      });

      if (error || !data) {
        throw mapDatabaseError(error, "No se pudo revocar el código de acceso.");
      }

      return data as RevokeAccessCodeResult;
    },

    async setActive(participantId, isActive) {
      const { data, error } = await supabase.rpc("set_participant_active", {
        p_participant_id: participantId,
        p_is_active: isActive,
      });

      if (error || !data) {
        throw mapDatabaseError(error, "No se pudo cambiar el estado del participante.");
      }

      return data as SetActiveResult;
    },
  };
}
