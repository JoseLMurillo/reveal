import type { SupabaseClient } from "@supabase/supabase-js";

import type { AllowedImageMimeType, PhotoStatus, UploadItemStatus } from "@rollo/shared";

import { mapDatabaseError } from "../../utils/rpc-error.js";
import type {
  ConfirmItemEntry,
  ConfirmRpcResult,
  PhotoListFilters,
  PhotoPage,
  PhotoRecord,
  QuotaRecord,
  ReleaseRpcResult,
  ReserveItemInput,
  ReserveRpcResult,
  UploadItemRecord,
  UploadSessionRecord,
} from "./types.js";

export const PHOTO_COLUMNS =
  "id, event_id, participant_id, upload_item_id, storage_path, original_filename, mime_type, file_size, width, height, content_hash, event_day, uploaded_at, status, deleted_at, deleted_by_admin_id";

const UPLOAD_SESSION_COLUMNS =
  "id, event_id, participant_id, event_day, reserved_count, uploaded_count, released_count, status, expires_at, created_at, updated_at, closed_at";

const UPLOAD_ITEM_COLUMNS =
  "id, upload_session_id, client_file_id, storage_path, declared_filename, declared_mime_type, declared_size_bytes, status, failure_code, created_at, confirmed_at";

type PhotoRow = {
  id: string;
  event_id: string;
  participant_id: string;
  upload_item_id: string | null;
  storage_path: string;
  original_filename: string;
  mime_type: AllowedImageMimeType;
  file_size: number;
  width: number | null;
  height: number | null;
  content_hash: string;
  event_day: string;
  uploaded_at: string;
  status: PhotoStatus;
  deleted_at: string | null;
  deleted_by_admin_id: string | null;
};

type SessionRow = {
  id: string;
  event_id: string;
  participant_id: string;
  event_day: string;
  reserved_count: number;
  uploaded_count: number;
  released_count: number;
  status: UploadSessionRecord["status"];
  expires_at: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

type ItemRow = {
  id: string;
  upload_session_id: string;
  client_file_id: string;
  storage_path: string;
  declared_filename: string;
  declared_mime_type: AllowedImageMimeType;
  declared_size_bytes: number;
  status: UploadItemStatus;
  failure_code: string | null;
  created_at: string;
  confirmed_at: string | null;
};

export function mapPhoto(row: PhotoRow): PhotoRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    participantId: row.participant_id,
    uploadItemId: row.upload_item_id,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    width: row.width,
    height: row.height,
    contentHash: row.content_hash,
    eventDay: row.event_day,
    uploadedAt: row.uploaded_at,
    status: row.status,
    deletedAt: row.deleted_at,
    deletedByAdminId: row.deleted_by_admin_id,
  };
}

function mapSession(row: SessionRow): UploadSessionRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    participantId: row.participant_id,
    eventDay: row.event_day,
    reservedCount: Number(row.reserved_count),
    uploadedCount: Number(row.uploaded_count),
    releasedCount: Number(row.released_count),
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

function mapItem(row: ItemRow): UploadItemRecord {
  return {
    id: row.id,
    uploadSessionId: row.upload_session_id,
    clientFileId: row.client_file_id,
    storagePath: row.storage_path,
    declaredFilename: row.declared_filename,
    declaredMimeType: row.declared_mime_type,
    declaredSizeBytes: Number(row.declared_size_bytes),
    status: row.status,
    failureCode: row.failure_code,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  };
}

export type PhotosRepository = {
  reserve(
    participantId: string,
    items: ReserveItemInput[],
    ttlSeconds: number,
  ): Promise<ReserveRpcResult>;
  findSession(id: string): Promise<UploadSessionRecord | null>;
  listSessionItems(sessionId: string): Promise<UploadItemRecord[]>;
  listPendingItems(sessionId: string, itemIds?: string[]): Promise<UploadItemRecord[]>;
  confirm(
    sessionId: string,
    participantId: string,
    entries: ConfirmItemEntry[],
  ): Promise<ConfirmRpcResult>;
  release(
    sessionId: string,
    participantId: string,
    itemIds: string[] | null,
    reason: string,
  ): Promise<ReleaseRpcResult>;
  listPhotos(participantId: string, filters: PhotoListFilters): Promise<PhotoPage>;
  findPhoto(id: string): Promise<PhotoRecord | null>;
  softDeletePhoto(id: string, adminId: string | null): Promise<PhotoRecord>;
  getQuota(participantId: string): Promise<QuotaRecord>;
};

export function createSupabasePhotosRepository(supabase: SupabaseClient): PhotosRepository {
  return {
    async reserve(participantId, items, ttlSeconds) {
      const { data, error } = await supabase.rpc("reserve_upload_session", {
        p_participant_id: participantId,
        p_requested_count: items.length,
        p_items: items.map((item) => ({
          itemId: item.itemId,
          clientFileId: item.clientFileId,
          storagePath: item.storagePath,
          filename: item.filename,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
        })),
        p_ttl_seconds: ttlSeconds,
      });

      if (error || !data) {
        throw mapDatabaseError(error, "No se pudo reservar la cuota de carga.");
      }

      return data as ReserveRpcResult;
    },

    async findSession(id) {
      const { data, error } = await supabase
        .from("upload_sessions")
        .select(UPLOAD_SESSION_COLUMNS)
        .eq("id", id)
        .maybeSingle<SessionRow>();

      if (error) {
        throw new Error(`No se pudo leer la sesión de carga: ${error.message}`);
      }

      return data ? mapSession(data) : null;
    },

    async listSessionItems(sessionId) {
      const { data, error } = await supabase
        .from("upload_items")
        .select(UPLOAD_ITEM_COLUMNS)
        .eq("upload_session_id", sessionId)
        .order("created_at", { ascending: true })
        .returns<ItemRow[]>();

      if (error) {
        throw new Error(`No se pudieron leer los archivos de la sesión: ${error.message}`);
      }

      return data.map(mapItem);
    },

    async listPendingItems(sessionId, itemIds) {
      let query = supabase
        .from("upload_items")
        .select(UPLOAD_ITEM_COLUMNS)
        .eq("upload_session_id", sessionId)
        .in("status", ["reserved", "uploaded"])
        .order("created_at", { ascending: true });

      if (itemIds && itemIds.length > 0) {
        query = query.in("id", itemIds);
      }

      const { data, error } = await query.returns<ItemRow[]>();

      if (error) {
        throw new Error(`No se pudieron leer los archivos pendientes: ${error.message}`);
      }

      return data.map(mapItem);
    },

    async confirm(sessionId, participantId, entries) {
      const { data, error } = await supabase.rpc("confirm_upload_items", {
        p_session_id: sessionId,
        p_participant_id: participantId,
        p_items: entries.map((entry) => ({
          itemId: entry.itemId,
          mimeType: entry.mimeType,
          fileSize: entry.fileSize,
          width: entry.width,
          height: entry.height,
          contentHash: entry.contentHash,
        })),
      });

      if (error || !data) {
        throw mapDatabaseError(error, "No se pudo confirmar la carga.");
      }

      return data as ConfirmRpcResult;
    },

    async release(sessionId, participantId, itemIds, reason) {
      const { data, error } = await supabase.rpc("release_upload_items", {
        p_session_id: sessionId,
        p_participant_id: participantId,
        p_item_ids: itemIds,
        p_reason: reason,
      });

      if (error || !data) {
        throw mapDatabaseError(error, "No se pudo liberar la reserva.");
      }

      return data as ReleaseRpcResult;
    },

    async listPhotos(participantId, filters) {
      let query = supabase
        .from("photos")
        .select(PHOTO_COLUMNS, { count: "exact" })
        .eq("participant_id", participantId)
        .eq("status", "active");

      if (filters.day) {
        query = query.eq("event_day", filters.day);
      }

      const offset = (filters.page - 1) * filters.limit;
      const { data, error, count } = await query
        .order("uploaded_at", { ascending: false })
        .range(offset, offset + filters.limit - 1)
        .returns<PhotoRow[]>();

      if (error) {
        throw new Error(`No se pudieron listar tus fotos: ${error.message}`);
      }

      return { rows: data.map(mapPhoto), total: count ?? data.length };
    },

    async findPhoto(id) {
      const { data, error } = await supabase
        .from("photos")
        .select(PHOTO_COLUMNS)
        .eq("id", id)
        .maybeSingle<PhotoRow>();

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
        .single<PhotoRow>();

      if (error || !data) {
        throw new Error(`No se pudo eliminar la fotografía: ${error?.message ?? "sin datos"}`);
      }

      return mapPhoto(data);
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
  };
}
