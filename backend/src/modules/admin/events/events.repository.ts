import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminRecord } from "../shared/types.js";
import type {
  AlbumSummary,
  EventCreateValues,
  EventListFilters,
  EventListResult,
  EventRecord,
  EventUpdateValues,
} from "../shared/types.js";

type EventRow = {
  id: string;
  admin_id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_image_path: string | null;
  start_date: string;
  end_date: string;
  timezone: string;
  daily_photo_limit: number;
  total_photo_limit: number | null;
  require_name: boolean;
  show_participant_names: boolean;
  allow_self_registration: boolean;
  participant_limit: number | null;
  max_file_size_bytes: number;
  gallery_visibility: EventRecord["galleryVisibility"];
  allow_photo_deletion: boolean;
  status: EventRecord["status"];
  created_at: string;
  updated_at: string;
};

type AlbumRow = {
  id: string;
  slug: string;
  status: AlbumSummary["status"];
  visibility: AlbumSummary["visibility"];
};

export const EVENT_COLUMNS =
  "id, admin_id, slug, name, description, cover_image_path, start_date, end_date, timezone, daily_photo_limit, total_photo_limit, require_name, show_participant_names, allow_self_registration, participant_limit, max_file_size_bytes, gallery_visibility, allow_photo_deletion, status, created_at, updated_at";

export function mapEvent(row: EventRow): EventRecord {
  return {
    id: row.id,
    adminId: row.admin_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    coverImagePath: row.cover_image_path,
    startDate: row.start_date,
    endDate: row.end_date,
    timezone: row.timezone,
    dailyPhotoLimit: row.daily_photo_limit,
    totalPhotoLimit: row.total_photo_limit,
    requireName: row.require_name,
    showParticipantNames: row.show_participant_names,
    allowSelfRegistration: row.allow_self_registration,
    participantLimit: row.participant_limit,
    maxFileSizeBytes: row.max_file_size_bytes,
    galleryVisibility: row.gallery_visibility,
    allowPhotoDeletion: row.allow_photo_deletion,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRowPatch(values: EventUpdateValues): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (values.name !== undefined) patch.name = values.name;
  if (values.description !== undefined) patch.description = values.description || null;
  if (values.startDate !== undefined) patch.start_date = values.startDate;
  if (values.endDate !== undefined) patch.end_date = values.endDate;
  if (values.timezone !== undefined) patch.timezone = values.timezone;
  if (values.dailyPhotoLimit !== undefined) patch.daily_photo_limit = values.dailyPhotoLimit;
  if (values.totalPhotoLimit !== undefined) patch.total_photo_limit = values.totalPhotoLimit;
  if (values.requireName !== undefined) patch.require_name = values.requireName;
  if (values.showParticipantNames !== undefined)
    patch.show_participant_names = values.showParticipantNames;
  if (values.allowSelfRegistration !== undefined)
    patch.allow_self_registration = values.allowSelfRegistration;
  if (values.participantLimit !== undefined) patch.participant_limit = values.participantLimit;
  if (values.maxFileSizeBytes !== undefined) patch.max_file_size_bytes = values.maxFileSizeBytes;
  if (values.galleryVisibility !== undefined) patch.gallery_visibility = values.galleryVisibility;
  if (values.allowPhotoDeletion !== undefined)
    patch.allow_photo_deletion = values.allowPhotoDeletion;

  return patch;
}

function sanitizeSearch(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export type EventRepository = {
  list(admin: AdminRecord, filters: EventListFilters): Promise<EventListResult>;
  findById(id: string): Promise<EventRecord | null>;
  create(adminId: string, values: EventCreateValues, slug: string): Promise<EventRecord>;
  update(id: string, values: EventUpdateValues): Promise<EventRecord>;
  setCover(id: string, path: string | null): Promise<EventRecord>;
  setStatus(id: string, status: EventRecord["status"]): Promise<EventRecord>;
  remove(id: string): Promise<void>;
  slugExists(slug: string): Promise<boolean>;
  countParticipants(eventId: string): Promise<number>;
  hasActivity(eventId: string): Promise<boolean>;
  getAlbum(eventId: string): Promise<AlbumSummary | null>;
  listActiveUploadSessions(eventId: string): Promise<Array<{ id: string; participantId: string }>>;
  cancelActiveUploadSessions(eventId: string): Promise<number>;
  listStoragePaths(eventId: string): Promise<string[]>;
  enqueueCleanup(paths: string[], reason: string): Promise<number>;
  listAccessibleEventIds(admin: AdminRecord): Promise<string[]>;
  listAll(admin: AdminRecord): Promise<EventRecord[]>;
};

export function createSupabaseEventRepository(
  supabase: SupabaseClient,
  bucket: string,
): EventRepository {
  return {
    async list(admin, filters) {
      let query = supabase.from("events").select(EVENT_COLUMNS, { count: "exact" });

      if (admin.role !== "owner") {
        query = query.eq("admin_id", admin.id);
      }

      if (filters.status) {
        query = query.eq("status", filters.status);
      }

      const search = filters.search ? sanitizeSearch(filters.search) : "";

      if (search.length > 0) {
        query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
      }

      if (filters.from) {
        query = query.gte("end_date", filters.from);
      }

      if (filters.to) {
        query = query.lte("start_date", filters.to);
      }

      const offset = (filters.page - 1) * filters.limit;
      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + filters.limit - 1)
        .returns<EventRow[]>();

      if (error) {
        throw new Error(`No se pudieron listar los eventos: ${error.message}`);
      }

      return { rows: data.map(mapEvent), total: count ?? data.length };
    },

    async findById(id) {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_COLUMNS)
        .eq("id", id)
        .maybeSingle<EventRow>();

      if (error) {
        throw new Error(`No se pudo leer el evento: ${error.message}`);
      }

      return data ? mapEvent(data) : null;
    },

    async create(adminId, values, slug) {
      const { data, error } = await supabase
        .from("events")
        .insert({
          admin_id: adminId,
          slug,
          name: values.name,
          description: values.description || null,
          start_date: values.startDate,
          end_date: values.endDate,
          timezone: values.timezone,
          daily_photo_limit: values.dailyPhotoLimit,
          total_photo_limit: values.totalPhotoLimit ?? null,
          require_name: values.requireName,
          show_participant_names: values.showParticipantNames,
          allow_self_registration: values.allowSelfRegistration,
          participant_limit: values.participantLimit ?? null,
          max_file_size_bytes: values.maxFileSizeBytes,
          gallery_visibility: values.galleryVisibility,
          allow_photo_deletion: values.allowPhotoDeletion,
          status: "draft",
        })
        .select(EVENT_COLUMNS)
        .single<EventRow>();

      if (error || !data) {
        throw new Error(`No se pudo crear el evento: ${error?.message ?? "sin datos"}`);
      }

      return mapEvent(data);
    },

    async update(id, values) {
      const patch = toRowPatch(values);

      if (Object.keys(patch).length === 0) {
        const existing = await this.findById(id);
        if (!existing) {
          throw new Error("El evento no existe.");
        }
        return existing;
      }

      const { data, error } = await supabase
        .from("events")
        .update(patch)
        .eq("id", id)
        .select(EVENT_COLUMNS)
        .single<EventRow>();

      if (error || !data) {
        throw new Error(`No se pudo actualizar el evento: ${error?.message ?? "sin datos"}`);
      }

      return mapEvent(data);
    },

    async remove(id) {
      const { error } = await supabase.from("events").delete().eq("id", id);

      if (error) {
        throw new Error(`No se pudo eliminar el evento: ${error.message}`);
      }
    },

    async setCover(id, path) {
      const { data, error } = await supabase
        .from("events")
        .update({ cover_image_path: path, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(EVENT_COLUMNS)
        .single<EventRow>();

      if (error || !data) {
        throw new Error(`No se pudo actualizar la portada: ${error?.message ?? "sin datos"}`);
      }

      return mapEvent(data);
    },

    async setStatus(id, status) {
      const { data, error } = await supabase
        .from("events")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(EVENT_COLUMNS)
        .single<EventRow>();

      if (error || !data) {
        throw new Error(`No se pudo cambiar el estado: ${error?.message ?? "sin datos"}`);
      }

      return mapEvent(data);
    },

    async slugExists(slug) {
      const { data, error } = await supabase
        .from("events")
        .select("id")
        .eq("slug", slug)
        .maybeSingle<{ id: string }>();

      if (error) {
        throw new Error(`No se pudo comprobar el slug: ${error.message}`);
      }

      return data !== null;
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

    async hasActivity(eventId) {
      const [photos, sessions] = await Promise.all([
        supabase
          .from("photos")
          .select("id", { head: true, count: "exact" })
          .eq("event_id", eventId)
          .limit(1),
        supabase
          .from("upload_sessions")
          .select("id", { head: true, count: "exact" })
          .eq("event_id", eventId)
          .limit(1),
      ]);

      if (photos.error || sessions.error) {
        throw new Error(
          `No se pudo comprobar la actividad: ${photos.error?.message ?? sessions.error?.message}`,
        );
      }

      return (photos.count ?? 0) > 0 || (sessions.count ?? 0) > 0;
    },

    async getAlbum(eventId) {
      const { data, error } = await supabase
        .from("albums")
        .select("id, slug, status, visibility")
        .eq("event_id", eventId)
        .maybeSingle<AlbumRow>();

      if (error) {
        throw new Error(`No se pudo leer el álbum: ${error.message}`);
      }

      return data ?? null;
    },

    async listActiveUploadSessions(eventId) {
      const { data, error } = await supabase
        .from("upload_sessions")
        .select("id, participant_id")
        .eq("event_id", eventId)
        .eq("status", "reserved")
        .returns<Array<{ id: string; participant_id: string }>>();

      if (error) {
        throw new Error(`No se pudieron leer las sesiones de carga: ${error.message}`);
      }

      return data.map((row) => ({ id: row.id, participantId: row.participant_id }));
    },

    async cancelActiveUploadSessions(eventId) {
      const { data: sessions, error: sessionsError } = await supabase
        .from("upload_sessions")
        .select("id")
        .eq("event_id", eventId)
        .eq("status", "reserved")
        .returns<Array<{ id: string }>>();

      if (sessionsError) {
        throw new Error(`No se pudieron leer las reservas activas: ${sessionsError.message}`);
      }

      if (sessions.length === 0) {
        return 0;
      }

      const ids = sessions.map((row) => row.id);
      const now = new Date().toISOString();

      const { error: itemsError } = await supabase
        .from("upload_items")
        .update({ status: "cancelled", failure_code: "event_cancelled" })
        .in("upload_session_id", ids)
        .in("status", ["reserved", "uploaded"]);

      if (itemsError) {
        throw new Error(`No se pudieron cancelar los objetos pendientes: ${itemsError.message}`);
      }

      const { error: closeError } = await supabase
        .from("upload_sessions")
        .update({ status: "cancelled", closed_at: now, updated_at: now })
        .in("id", ids);

      if (closeError) {
        throw new Error(`No se pudieron cancelar las reservas: ${closeError.message}`);
      }

      return ids.length;
    },

    async listStoragePaths(eventId) {
      const [photos, items, event] = await Promise.all([
        supabase
          .from("photos")
          .select("storage_path")
          .eq("event_id", eventId)
          .returns<Array<{ storage_path: string }>>(),
        supabase
          .from("upload_items")
          .select("storage_path, upload_sessions!inner(event_id)")
          .eq("upload_sessions.event_id", eventId)
          .returns<Array<{ storage_path: string }>>(),
        supabase
          .from("events")
          .select("cover_image_path")
          .eq("id", eventId)
          .maybeSingle<{ cover_image_path: string | null }>(),
      ]);

      if (photos.error || items.error || event.error) {
        throw new Error(
          `No se pudieron leer los objetos del evento: ${
            photos.error?.message ?? items.error?.message ?? event.error?.message
          }`,
        );
      }

      const paths = new Set<string>();
      for (const row of photos.data) paths.add(row.storage_path);
      for (const row of items.data) paths.add(row.storage_path);
      if (event.data?.cover_image_path) paths.add(event.data.cover_image_path);

      return [...paths];
    },

    async enqueueCleanup(paths, reason) {
      if (paths.length === 0) {
        return 0;
      }

      const { data, error } = await supabase
        .rpc("enqueue_storage_cleanup", {
          p_bucket: bucket,
          p_paths: paths,
          p_reason: reason,
        })
        .returns<number>();

      if (error) {
        throw new Error(`No se pudo encolar la limpieza: ${error.message}`);
      }

      return typeof data === "number" ? data : 0;
    },

    async listAccessibleEventIds(admin) {
      let query = supabase.from("events").select("id");

      if (admin.role !== "owner") {
        query = query.eq("admin_id", admin.id);
      }

      const { data, error } = await query.returns<Array<{ id: string }>>();

      if (error) {
        throw new Error(`No se pudieron leer los eventos: ${error.message}`);
      }

      return data.map((row) => row.id);
    },

    async listAll(admin) {
      let query = supabase.from("events").select(EVENT_COLUMNS);

      if (admin.role !== "owner") {
        query = query.eq("admin_id", admin.id);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .returns<EventRow[]>();

      if (error) {
        throw new Error(`No se pudieron leer los eventos: ${error.message}`);
      }

      return data.map(mapEvent);
    },
  };
}
