import type { Readable } from "node:stream";

import { ZipArchive } from "archiver";

import type {
  AlbumDetail,
  AlbumExportQuery,
  GenerateAlbumInput,
  UpdateAlbumInput,
} from "@rollo/shared";

import { conflict, notFound } from "../../../errors/app-error.js";
import { ERROR_CODES } from "../../../errors/error-codes.js";
import { dayNumberFor } from "../../../utils/event-time.js";
import { generateUniqueSlug } from "../shared/slug.js";
import type { AuditRepository } from "../shared/audit.repository.js";
import type { AdminRecord, EventRecord } from "../shared/types.js";
import { assertEventAccess } from "../shared/access.js";
import type { AlbumRepository } from "../../albums/albums.repository.js";
import type { AlbumPhotoRecord, AlbumRecord } from "../../albums/types.js";
import type { PhotoStorageService } from "../../photos/photos.storage.js";

const MAX_EXPORT_PHOTOS = 300;

export type AlbumZipExport = {
  stream: Readable;
  filename: string;
  count: number;
};

export type AdminAlbumsService = {
  detail(admin: AdminRecord, eventId: string): Promise<AlbumDetail>;
  generate(admin: AdminRecord, eventId: string, input: GenerateAlbumInput): Promise<AlbumDetail>;
  update(admin: AdminRecord, eventId: string, input: UpdateAlbumInput): Promise<AlbumDetail>;
  exportZip(admin: AdminRecord, eventId: string, query: AlbumExportQuery): Promise<AlbumZipExport>;
};

function safeFilename(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "foto"
  );
}

export function createAdminAlbumsService(deps: {
  repository: AlbumRepository;
  storage: PhotoStorageService;
  audit: AuditRepository;
  now?: () => Date;
}): AdminAlbumsService {
  const now = deps.now ?? (() => new Date());

  async function loadEvent(admin: AdminRecord, eventId: string): Promise<EventRecord> {
    const event = await deps.repository.findEventById(eventId);

    if (!event) {
      throw notFound("El evento no existe.");
    }

    assertEventAccess(admin, event);
    return event;
  }

  async function loadAlbum(event: EventRecord): Promise<AlbumRecord> {
    const album = await deps.repository.findAlbumByEvent(event.id);

    if (!album) {
      throw notFound("El evento todavía no tiene un álbum generado.");
    }

    return album;
  }

  async function detailOf(event: EventRecord, album: AlbumRecord): Promise<AlbumDetail> {
    const records = (await deps.repository.listAlbumPhotos(album.id)).filter(
      (photo) => photo.status === "active",
    );
    const grouped = new Map<string, AlbumPhotoRecord[]>();

    for (const photo of records) {
      const list = grouped.get(photo.albumEventDay) ?? [];
      list.push(photo);
      grouped.set(photo.albumEventDay, list);
    }

    const days: AlbumDetail["days"] = [];

    for (const [eventDay, dayPhotos] of [...grouped.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      days.push({
        eventDay,
        dayNumber: dayNumberFor(event.startDate, eventDay),
        photos: await Promise.all(
          dayPhotos.map(async (photo) => ({
            id: photo.id,
            url: await deps.storage.createSignedUrl(photo.storagePath),
            width: photo.width,
            height: photo.height,
            author:
              photo.participantDisplayName === null
                ? null
                : { displayName: photo.participantDisplayName },
            caption: photo.caption,
          })),
        ),
      });
    }

    const coverRecord = records.find((photo) => photo.id === album.coverPhotoId) ?? records[0];
    const participants = new Set(records.map((photo) => photo.participantId));

    return {
      album: {
        id: album.id,
        eventId: album.eventId,
        slug: album.slug,
        title: album.title,
        subtitle: album.subtitle,
        coverPhotoId: album.coverPhotoId,
        coverUrl: coverRecord ? await deps.storage.createSignedUrl(coverRecord.storagePath) : null,
        status: album.status,
        visibility: album.visibility,
        publishedAt: album.publishedAt,
        createdAt: album.createdAt,
        updatedAt: album.updatedAt,
      },
      days,
      stats: {
        totalPhotos: records.length,
        totalParticipants: participants.size,
        totalDays: days.length,
      },
    };
  }

  return {
    async detail(admin, eventId) {
      const event = await loadEvent(admin, eventId);
      return detailOf(event, await loadAlbum(event));
    },

    async generate(admin, eventId, input) {
      const event = await loadEvent(admin, eventId);
      const photos = await deps.repository.listEventPhotos(event.id);

      if (photos.length === 0) {
        throw conflict(
          ERROR_CODES.NO_PHOTOS,
          "El evento todavía no tiene fotografías confirmadas para generar el álbum.",
        );
      }

      if (input.coverPhotoId && !photos.some((photo) => photo.id === input.coverPhotoId)) {
        throw notFound("La fotografía de portada no pertenece al evento.");
      }

      const existing = await deps.repository.findAlbumByEvent(event.id);
      const title = input.title ?? existing?.title ?? event.name;
      const subtitle = input.subtitle !== undefined ? input.subtitle : (existing?.subtitle ?? null);
      const visibility = input.visibility ?? existing?.visibility ?? "private";
      const preferredCover =
        input.coverPhotoId ??
        (existing?.coverPhotoId && photos.some((photo) => photo.id === existing.coverPhotoId)
          ? existing.coverPhotoId
          : null);
      const coverPhotoId = preferredCover ?? photos[0]?.id ?? null;

      const album = existing
        ? await deps.repository.updateAlbum(existing.id, {
            title,
            subtitle,
            visibility,
            coverPhotoId,
          })
        : await deps.repository.createAlbum({
            eventId: event.id,
            slug: await generateUniqueSlug(title, (slug) => deps.repository.slugExists(slug)),
            title,
            subtitle,
            coverPhotoId,
            visibility,
            generatedBy: admin.id,
          });

      const positions = new Map<string, number>();
      const entries = photos.map((photo) => {
        const position = positions.get(photo.eventDay) ?? 0;
        positions.set(photo.eventDay, position + 1);

        return {
          photoId: photo.id,
          eventDay: photo.eventDay,
          position,
        };
      });

      await deps.repository.replaceAlbumPhotos(album.id, entries);
      await deps.audit.record({
        adminId: admin.id,
        eventId: event.id,
        action: existing ? "album.regenerated" : "album.generated",
        entityType: "album",
        entityId: album.id,
        metadata: { photos: entries.length, days: positions.size },
      });

      return detailOf(event, (await deps.repository.findAlbumByEvent(event.id)) ?? album);
    },

    async update(admin, eventId, input) {
      const event = await loadEvent(admin, eventId);
      const album = await loadAlbum(event);

      if (input.coverPhotoId) {
        const cover = await deps.repository.findEventPhoto(event.id, input.coverPhotoId);

        if (!cover || cover.status !== "active") {
          throw notFound("La fotografía de portada no está disponible.");
        }
      }

      if (input.status === "published") {
        const photos = await deps.repository.listAlbumPhotos(album.id);

        if (photos.filter((photo) => photo.status === "active").length === 0) {
          throw conflict(
            ERROR_CODES.ALBUM_EMPTY,
            "El álbum no tiene fotografías activas para publicar.",
          );
        }
      }

      let publishedAt = album.publishedAt;

      if (input.status === "published" && album.status !== "published") {
        publishedAt = now().toISOString();
      } else if (input.status === "draft") {
        publishedAt = null;
      }

      const updated = await deps.repository.updateAlbum(album.id, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.coverPhotoId !== undefined ? { coverPhotoId: input.coverPhotoId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        publishedAt,
      });

      await deps.audit.record({
        adminId: admin.id,
        eventId: event.id,
        action:
          input.status === "published"
            ? "album.published"
            : input.status === "draft"
              ? "album.unpublished"
              : "album.updated",
        entityType: "album",
        entityId: album.id,
        metadata: {},
      });

      return detailOf(event, updated);
    },

    async exportZip(admin, eventId, query) {
      const event = await loadEvent(admin, eventId);
      const photos = await deps.repository.listEventPhotos(event.id, query.day);

      if (photos.length === 0) {
        throw conflict(ERROR_CODES.NO_PHOTOS, "No hay fotografías activas para exportar.");
      }

      if (photos.length > MAX_EXPORT_PHOTOS) {
        throw conflict(
          ERROR_CODES.EXPORT_TOO_LARGE,
          `La exportación admite como máximo ${MAX_EXPORT_PHOTOS} fotografías. Filtra por día para reducir el tamaño.`,
          { photos: photos.length, limit: MAX_EXPORT_PHOTOS },
        );
      }

      const archive = new ZipArchive({ zlib: { level: 6 } });
      const filename = `${event.slug}${query.day ? `-${query.day}` : ""}.zip`;

      void (async () => {
        try {
          for (const [index, photo] of photos.entries()) {
            const buffer = await deps.storage.downloadOriginal(photo.storagePath);
            const name = `${photo.eventDay}/${String(index + 1).padStart(3, "0")}-${safeFilename(
              photo.originalFilename,
            )}`;
            archive.append(buffer, { name });
          }

          await archive.finalize();
        } catch (error) {
          archive.destroy(error instanceof Error ? error : new Error(String(error)));
        }
      })();

      return { stream: archive, filename, count: photos.length };
    },
  };
}
