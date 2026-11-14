import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminPhotoListFilters, AdminPhotoPage, PhotoRecord } from "../../photos/types.js";
import { PHOTO_COLUMNS, mapPhoto } from "../../photos/photos.repository.js";
import { mapDatabaseError } from "../../../utils/rpc-error.js";

type AdminPhotoRow = {
  id: string;
  event_id: string;
  participant_id: string;
  upload_item_id: string | null;
  storage_path: string;
  original_filename: string;
  mime_type: PhotoRecord["mimeType"];
  file_size: number;
  width: number | null;
  height: number | null;
  content_hash: string;
  event_day: string;
  uploaded_at: string;
  status: PhotoRecord["status"];
  deleted_at: string | null;
  deleted_by_admin_id: string | null;
  participants:
    | { id: string; display_name: string | null }
    | { id: string; display_name: string | null }[]
    | null;
};

export type AdminActivityRow = {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AdminPhotosRepository = {
  list(eventId: string, filters: AdminPhotoListFilters): Promise<AdminPhotoPage>;
  findPhoto(id: string): Promise<PhotoRecord | null>;
  softDeletePhoto(id: string, adminId: string): Promise<PhotoRecord>;
  getStats(eventId: string, eventDay: string): Promise<unknown>;
  listActivity(
    eventId: string,
    page: number,
    limit: number,
  ): Promise<{ rows: AdminActivityRow[]; total: number }>;
};

function sanitizeSearch(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function participantOf(row: AdminPhotoRow): { id: string; displayName: string | null } {
  const participant = Array.isArray(row.participants) ? row.participants[0] : row.participants;
  return {
    id: participant?.id ?? row.participant_id,
    displayName: participant?.display_name ?? null,
  };
}

export function createSupabaseAdminPhotosRepository(
  supabase: SupabaseClient,
): AdminPhotosRepository {
  return {
    async list(eventId, filters) {
      let participantIds: string[] | null = null;

      if (filters.search) {
        const search = sanitizeSearch(filters.search);

        if (search.length > 0) {
          const { data, error } = await supabase
            .from("participants")
            .select("id")
            .eq("event_id", eventId)
            .ilike("display_name", `%${search}%`)
            .limit(200);

          if (error) {
            throw new Error(`No se pudo filtrar por participante: ${error.message}`);
          }

          participantIds = data.map((row) => row.id as string);

          if (participantIds.length === 0) {
            return { rows: [], total: 0 };
          }
        }
      }

      let query = supabase
        .from("photos")
        .select(`${PHOTO_COLUMNS}, participants!inner(id, display_name)`, { count: "exact" })
        .eq("event_id", eventId);

      if (!filters.includeDeleted) {
        query = query.eq("status", "active");
      }

      if (filters.day) {
        query = query.eq("event_day", filters.day);
      }

      if (filters.participantId) {
        query = query.eq("participant_id", filters.participantId);
      }

      if (participantIds) {
        query = query.in("participant_id", participantIds);
      }

      const offset = (filters.page - 1) * filters.limit;
      const { data, error, count } = await query
        .order("uploaded_at", { ascending: false })
        .range(offset, offset + filters.limit - 1)
        .returns<AdminPhotoRow[]>();

      if (error) {
        throw new Error(`No se pudieron listar las fotografías: ${error.message}`);
      }

      return {
        rows: data.map((row) => {
          const participant = participantOf(row);

          return {
            ...mapPhoto(row),
            participantId: participant.id,
            participantDisplayName: participant.displayName,
          };
        }),
        total: count ?? data.length,
      };
    },

    async findPhoto(id) {
      const { data, error } = await supabase
        .from("photos")
        .select(PHOTO_COLUMNS)
        .eq("id", id)
        .maybeSingle<AdminPhotoRow>();

      if (error) {
        throw new Error(`No se pudo leer la fotografía: ${error.message}`);
      }

      return data ? mapPhoto(data) : null;
    },

    async softDeletePhoto(id, adminId) {
      const { data, error } = await supabase
        .from("photos")
        .update({
          status: "deleted",
          deleted_at: new Date().toISOString(),
          deleted_by_admin_id: adminId,
        })
        .eq("id", id)
        .select(PHOTO_COLUMNS)
        .single<AdminPhotoRow>();

      if (error || !data) {
        throw new Error(`No se pudo eliminar la fotografía: ${error?.message ?? "sin datos"}`);
      }

      return mapPhoto(data);
    },

    async getStats(eventId, eventDay) {
      const { data, error } = await supabase.rpc("admin_event_photo_stats", {
        p_event_id: eventId,
        p_event_day: eventDay,
      });

      if (error || !data) {
        throw mapDatabaseError(error, "No se pudieron leer las estadísticas de fotos.");
      }

      return data;
    },

    async listActivity(eventId, page, limit) {
      const offset = (page - 1) * limit;
      const { data, error, count } = await supabase
        .from("audit_logs")
        .select("id, action, entity_type, entity_id, metadata, created_at", { count: "exact" })
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`No se pudo leer la actividad del evento: ${error.message}`);
      }

      return { rows: (data ?? []) as AdminActivityRow[], total: count ?? 0 };
    },
  };
}
