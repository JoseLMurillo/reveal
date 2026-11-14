import type { SupabaseClient } from "@supabase/supabase-js";

import { mapDatabaseError } from "../../utils/rpc-error.js";
import { EVENT_COLUMNS, mapEvent } from "../admin/events/events.repository.js";
import type { EventRecord } from "../admin/shared/types.js";
import { PARTICIPANT_COLUMNS, mapParticipant } from "../participants/participants.repository.js";
import type {
  ParticipantRecord,
  QuotaRecord,
  RedeemRpcResult,
  RegisterRpcResult,
} from "../participants/types.js";

export type RedeemRpcInput = {
  eventId: string;
  accessCodeHash: string;
  sessionTokenHash: string;
  displayName?: string;
  sessionTtlSeconds: number;
};

export type RegisterRpcInput = {
  eventId: string;
  displayName?: string;
  accessCodeHash: string;
  accessCodePrefix: string;
  sessionTokenHash: string;
  sessionTtlSeconds: number;
};

export type PublicRepository = {
  findEventBySlug(slug: string): Promise<EventRecord | null>;
  findParticipantById(id: string): Promise<ParticipantRecord | null>;
  countParticipants(eventId: string): Promise<number>;
  getPublicAlbumSlug(eventId: string): Promise<string | null>;
  getQuota(participantId: string): Promise<QuotaRecord>;
  redeem(input: RedeemRpcInput): Promise<RedeemRpcResult>;
  register(input: RegisterRpcInput): Promise<RegisterRpcResult>;
};

type ParticipantRow = Parameters<typeof mapParticipant>[0];

export function createSupabasePublicRepository(supabase: SupabaseClient): PublicRepository {
  return {
    async findEventBySlug(slug) {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_COLUMNS)
        .eq("slug", slug)
        .maybeSingle();

      if (error) {
        throw new Error(`No se pudo leer el evento: ${error.message}`);
      }

      return data ? mapEvent(data) : null;
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

    async countParticipants(eventId) {
      const { count, error } = await supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId);

      if (error) {
        throw new Error(`No se pudo contar a los participantes: ${error.message}`);
      }

      return count ?? 0;
    },

    async getPublicAlbumSlug(eventId) {
      const { data, error } = await supabase
        .from("albums")
        .select("slug")
        .eq("event_id", eventId)
        .eq("status", "published")
        .eq("visibility", "public")
        .maybeSingle<{ slug: string }>();

      if (error) {
        throw new Error(`No se pudo leer el álbum público: ${error.message}`);
      }

      return data?.slug ?? null;
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

    async redeem(input) {
      const { data, error } = await supabase.rpc("redeem_access_code", {
        p_event_id: input.eventId,
        p_access_code_hash: input.accessCodeHash,
        p_session_token_hash: input.sessionTokenHash,
        p_display_name: input.displayName ?? null,
        p_session_ttl_seconds: input.sessionTtlSeconds,
      });

      if (error || !data) {
        throw mapDatabaseError(error, "No se pudo canjear el enlace de acceso.");
      }

      return data as RedeemRpcResult;
    },

    async register(input) {
      const { data, error } = await supabase.rpc("register_participant", {
        p_event_id: input.eventId,
        p_display_name: input.displayName ?? null,
        p_access_code_hash: input.accessCodeHash,
        p_access_code_prefix: input.accessCodePrefix,
        p_session_token_hash: input.sessionTokenHash,
        p_session_ttl_seconds: input.sessionTtlSeconds,
      });

      if (error || !data) {
        throw mapDatabaseError(error, "No se pudo completar el registro.");
      }

      return data as RegisterRpcResult;
    },
  };
}
