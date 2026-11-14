import type { SupabaseClient } from "@supabase/supabase-js";

import type { AlbumStatus, AlbumVisibility, PhotoVoteValue } from "@rollo/shared";

import { EVENT_COLUMNS, mapEvent } from "../admin/events/events.repository.js";
import type { EventRecord } from "../admin/shared/types.js";
import { PHOTO_COLUMNS, mapPhoto } from "../photos/photos.repository.js";
import type { PhotoRecord } from "../photos/types.js";
import type {
  AlbumPhotoRecord,
  AlbumRecord,
  GalleryPhotoRecord,
  VoteCounts,
  VoteRecord,
} from "./types.js";

const ALBUM_COLUMNS =
  "id, event_id, slug, title, subtitle, cover_photo_id, status, visibility, generated_by, published_at, created_at, updated_at";

type PhotoRow = {
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
};

type ParticipantRow = {
  id: string;
  display_name: string | null;
};

type PhotoWithParticipantRow = PhotoRow & {
  participants: ParticipantRow | ParticipantRow[] | null;
};

type AlbumRow = {
  id: string;
  event_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_photo_id: string | null;
  status: AlbumStatus;
  visibility: AlbumVisibility;
  generated_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type AlbumPhotoRow = {
  id: string;
  event_day: string;
  position: number;
  caption: string | null;
  photos: PhotoWithParticipantRow | PhotoWithParticipantRow[];
};

type VoteRow = {
  photo_id: string;
  participant_id: string;
  event_id: string;
  value: PhotoVoteValue;
  event_day: string;
};

export type AlbumRepository = {
  findEventBySlug(slug: string): Promise<EventRecord | null>;
  findEventById(id: string): Promise<EventRecord | null>;
  findAlbumBySlug(slug: string): Promise<AlbumRecord | null>;
  findAlbumByEvent(eventId: string): Promise<AlbumRecord | null>;
  slugExists(slug: string): Promise<boolean>;
  createAlbum(input: {
    eventId: string;
    slug: string;
    title: string;
    subtitle: string | null;
    coverPhotoId: string | null;
    visibility: AlbumVisibility;
    generatedBy: string;
  }): Promise<AlbumRecord>;
  updateAlbum(
    albumId: string,
    values: {
      title?: string;
      subtitle?: string | null;
      coverPhotoId?: string | null;
      visibility?: AlbumVisibility;
      status?: AlbumStatus;
      publishedAt?: string | null;
    },
  ): Promise<AlbumRecord>;
  replaceAlbumPhotos(
    albumId: string,
    rows: Array<{ photoId: string; eventDay: string; position: number }>,
  ): Promise<void>;
  listAlbumPhotos(albumId: string): Promise<AlbumPhotoRecord[]>;
  listEventPhotos(eventId: string, day?: string): Promise<GalleryPhotoRecord[]>;
  findEventPhoto(eventId: string, photoId: string): Promise<GalleryPhotoRecord | null>;
  listVotesForParticipant(participantId: string, eventId: string): Promise<VoteRecord[]>;
  listVotesForDay(eventId: string, day: string): Promise<VoteRecord[]>;
  upsertVote(input: {
    eventId: string;
    eventDay: string;
    photoId: string;
    participantId: string;
    value: PhotoVoteValue;
  }): Promise<void>;
  countVotes(photoId: string): Promise<VoteCounts>;
};

function participantOf(row: PhotoWithParticipantRow): ParticipantRow | null {
  if (!row.participants) {
    return null;
  }

  return Array.isArray(row.participants) ? (row.participants[0] ?? null) : row.participants;
}

function photoWithParticipant(row: PhotoWithParticipantRow): GalleryPhotoRecord {
  return {
    ...mapPhoto(row),
    participantDisplayName: participantOf(row)?.display_name ?? null,
  };
}

export function mapAlbum(row: AlbumRow): AlbumRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    coverPhotoId: row.cover_photo_id,
    status: row.status,
    visibility: row.visibility,
    generatedBy: row.generated_by,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseAlbumRepository(supabase: SupabaseClient): AlbumRepository {
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

    async findAlbumBySlug(slug) {
      const { data, error } = await supabase
        .from("albums")
        .select(ALBUM_COLUMNS)
        .eq("slug", slug)
        .eq("status", "published")
        .eq("visibility", "public")
        .maybeSingle<AlbumRow>();

      if (error) {
        throw new Error(`No se pudo leer el álbum: ${error.message}`);
      }

      return data ? mapAlbum(data) : null;
    },

    async findAlbumByEvent(eventId) {
      const { data, error } = await supabase
        .from("albums")
        .select(ALBUM_COLUMNS)
        .eq("event_id", eventId)
        .maybeSingle<AlbumRow>();

      if (error) {
        throw new Error(`No se pudo leer el álbum: ${error.message}`);
      }

      return data ? mapAlbum(data) : null;
    },

    async slugExists(slug) {
      const { count, error } = await supabase
        .from("albums")
        .select("id", { head: true, count: "exact" })
        .eq("slug", slug)
        .limit(1);

      if (error) {
        throw new Error(`No se pudo comprobar el slug del álbum: ${error.message}`);
      }

      return (count ?? 0) > 0;
    },

    async createAlbum(input) {
      const { data, error } = await supabase
        .from("albums")
        .insert({
          event_id: input.eventId,
          slug: input.slug,
          title: input.title,
          subtitle: input.subtitle,
          cover_photo_id: input.coverPhotoId,
          status: "draft",
          visibility: input.visibility,
          generated_by: input.generatedBy,
          published_at: null,
        })
        .select(ALBUM_COLUMNS)
        .single<AlbumRow>();

      if (error || !data) {
        throw new Error(`No se pudo crear el álbum: ${error?.message ?? "sin datos"}`);
      }

      return mapAlbum(data);
    },

    async updateAlbum(albumId, values) {
      const patch: Record<string, unknown> = {};

      if (values.title !== undefined) patch.title = values.title;
      if (values.subtitle !== undefined) patch.subtitle = values.subtitle;
      if (values.coverPhotoId !== undefined) patch.cover_photo_id = values.coverPhotoId;
      if (values.visibility !== undefined) patch.visibility = values.visibility;
      if (values.status !== undefined) patch.status = values.status;
      if (values.publishedAt !== undefined) patch.published_at = values.publishedAt;

      const { data, error } = await supabase
        .from("albums")
        .update(patch)
        .eq("id", albumId)
        .select(ALBUM_COLUMNS)
        .single<AlbumRow>();

      if (error || !data) {
        throw new Error(`No se pudo actualizar el álbum: ${error?.message ?? "sin datos"}`);
      }

      return mapAlbum(data);
    },

    async replaceAlbumPhotos(albumId, rows) {
      const { error } = await supabase.rpc("replace_album_photos", {
        p_album_id: albumId,
        p_entries: rows.map((row) => ({
          photoId: row.photoId,
          eventDay: row.eventDay,
          position: row.position,
        })),
      });

      if (error) {
        throw new Error(`No se pudo guardar el álbum: ${error.message}`);
      }
    },

    async listAlbumPhotos(albumId) {
      const { data, error } = await supabase
        .from("album_photos")
        .select(
          `id, event_day, position, caption, photos!inner(${PHOTO_COLUMNS}, participants!inner(id, display_name))`,
        )
        .eq("album_id", albumId)
        .order("event_day", { ascending: true })
        .order("position", { ascending: true })
        .returns<AlbumPhotoRow[]>();

      if (error) {
        throw new Error(`No se pudieron leer las fotos del álbum: ${error.message}`);
      }

      return data.map((row) => {
        const photo = Array.isArray(row.photos) ? row.photos[0] : row.photos;

        if (!photo) {
          throw new Error("El álbum contiene una foto inexistente.");
        }

        return {
          ...photoWithParticipant(photo),
          albumPhotoId: row.id,
          albumEventDay: row.event_day,
          position: Number(row.position),
          caption: row.caption,
        };
      });
    },

    async listEventPhotos(eventId, day) {
      let query = supabase
        .from("photos")
        .select(`${PHOTO_COLUMNS}, participants!inner(id, display_name)`)
        .eq("event_id", eventId)
        .eq("status", "active")
        .order("event_day", { ascending: true })
        .order("uploaded_at", { ascending: true });

      if (day) {
        query = query.eq("event_day", day);
      }

      const { data, error } = await query.returns<PhotoWithParticipantRow[]>();

      if (error) {
        throw new Error(`No se pudieron leer las fotos del evento: ${error.message}`);
      }

      return data.map(photoWithParticipant);
    },

    async findEventPhoto(eventId, photoId) {
      const { data, error } = await supabase
        .from("photos")
        .select(`${PHOTO_COLUMNS}, participants!inner(id, display_name)`)
        .eq("event_id", eventId)
        .eq("id", photoId)
        .maybeSingle<PhotoWithParticipantRow>();

      if (error) {
        throw new Error(`No se pudo leer la fotografía: ${error.message}`);
      }

      return data ? photoWithParticipant(data) : null;
    },

    async listVotesForParticipant(participantId, eventId) {
      const { data, error } = await supabase
        .from("photo_votes")
        .select("photo_id, participant_id, event_id, value, event_day")
        .eq("participant_id", participantId)
        .eq("event_id", eventId)
        .returns<VoteRow[]>();

      if (error) {
        throw new Error(`No se pudieron leer los votos: ${error.message}`);
      }

      return data.map((row) => ({
        photoId: row.photo_id,
        participantId: row.participant_id,
        eventId: row.event_id,
        value: row.value,
        eventDay: row.event_day,
      }));
    },

    async listVotesForDay(eventId, day) {
      const { data, error } = await supabase
        .from("photo_votes")
        .select("photo_id, participant_id, event_id, value, event_day")
        .eq("event_id", eventId)
        .eq("event_day", day)
        .returns<VoteRow[]>();

      if (error) {
        throw new Error(`No se pudieron leer los votos del día: ${error.message}`);
      }

      return data.map((row) => ({
        photoId: row.photo_id,
        participantId: row.participant_id,
        eventId: row.event_id,
        value: row.value,
        eventDay: row.event_day,
      }));
    },

    async upsertVote(input) {
      const { error } = await supabase.from("photo_votes").upsert(
        {
          event_id: input.eventId,
          event_day: input.eventDay,
          photo_id: input.photoId,
          participant_id: input.participantId,
          value: input.value,
        },
        { onConflict: "photo_id,participant_id" },
      );

      if (error) {
        throw new Error(`No se pudo registrar el voto: ${error.message}`);
      }
    },

    async countVotes(photoId) {
      const { data, error } = await supabase
        .from("photo_votes")
        .select("value")
        .eq("photo_id", photoId)
        .returns<Array<{ value: PhotoVoteValue }>>();

      if (error) {
        throw new Error(`No se pudieron contar los votos: ${error.message}`);
      }

      return {
        likes: data.filter((row) => row.value === "like").length,
        dislikes: data.filter((row) => row.value === "dislike").length,
      };
    },
  };
}
