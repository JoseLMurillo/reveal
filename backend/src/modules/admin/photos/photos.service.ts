import type {
  AdminActivityEntry,
  AdminEventActivityQuery,
  AdminEventPhotoStats,
  AdminPhoto,
  AdminPhotoListQuery,
} from "@rollo/shared";

import { notFound } from "../../../errors/app-error.js";
import { eventDayInTimezone } from "../../../utils/event-time.js";
import type { PhotoStorageService } from "../../photos/photos.storage.js";
import type { AdminPhotosRepository } from "./photos.repository.js";
import type { AuditRepository } from "../shared/audit.repository.js";
import { assertEventAccess } from "../shared/access.js";
import type { AdminRecord, EventRecord } from "../shared/types.js";
import type { EventRepository } from "../events/events.repository.js";

export type AdminPhotoPage = {
  rows: AdminPhoto[];
  total: number;
};

export type AdminActivityPage = {
  rows: AdminActivityEntry[];
  total: number;
};

export type AdminPhotosService = {
  list(admin: AdminRecord, eventId: string, query: AdminPhotoListQuery): Promise<AdminPhotoPage>;
  remove(admin: AdminRecord, photoId: string): Promise<{ deleted: true }>;
  downloadUrl(admin: AdminRecord, eventId: string, photoId: string): Promise<string>;
  stats(admin: AdminRecord, eventId: string): Promise<AdminEventPhotoStats>;
  activity(
    admin: AdminRecord,
    eventId: string,
    query: AdminEventActivityQuery,
  ): Promise<AdminActivityPage>;
};

export function createAdminPhotosService(deps: {
  events: EventRepository;
  photos: AdminPhotosRepository;
  storage: PhotoStorageService;
  audit: AuditRepository;
  now?: () => Date;
}): AdminPhotosService {
  const now = deps.now ?? (() => new Date());

  async function loadEvent(admin: AdminRecord, eventId: string): Promise<EventRecord> {
    const event = await deps.events.findById(eventId);

    if (!event) {
      throw notFound("El evento no existe.");
    }

    assertEventAccess(admin, event);
    return event;
  }

  return {
    async list(admin, eventId, query) {
      const event = await loadEvent(admin, eventId);
      const result = await deps.photos.list(event.id, {
        page: query.page,
        limit: query.limit,
        day: query.day,
        participantId: query.participantId,
        search: query.search,
        includeDeleted: query.includeDeleted,
      });

      const rows = await Promise.all(
        result.rows.map(async (photo) => {
          const url = await deps.storage.createSignedUrl(photo.storagePath);

          return {
            id: photo.id,
            url,
            width: photo.width,
            height: photo.height,
            eventDay: photo.eventDay,
            uploadedAt: photo.uploadedAt,
            originalFilename: photo.originalFilename,
            mimeType: photo.mimeType,
            fileSize: photo.fileSize,
            status: photo.status,
            deletedAt: photo.deletedAt,
            participant: {
              id: photo.participantId,
              displayName: photo.participantDisplayName,
              anonymous: photo.participantDisplayName === null,
            },
          } satisfies AdminPhoto;
        }),
      );

      return { rows, total: result.total };
    },

    async remove(admin, photoId) {
      const photo = await deps.photos.findPhoto(photoId);

      if (!photo) {
        throw notFound("La fotografía no existe.");
      }

      const event = await loadEvent(admin, photo.eventId);

      if (photo.status === "active") {
        await deps.photos.softDeletePhoto(photo.id, admin.id);

        await deps.audit.record({
          adminId: admin.id,
          eventId: event.id,
          action: "photo.deleted",
          entityType: "photo",
          entityId: photo.id,
          metadata: {
            participantId: photo.participantId,
            eventDay: photo.eventDay,
          },
        });
      }

      return { deleted: true };
    },

    async downloadUrl(admin, eventId, photoId) {
      const event = await loadEvent(admin, eventId);
      const photo = await deps.photos.findPhoto(photoId);

      if (!photo || photo.eventId !== event.id || photo.status !== "active") {
        throw notFound("La fotografía no existe o fue eliminada.");
      }

      return deps.storage.createSignedUrl(photo.storagePath, photo.originalFilename);
    },

    async stats(admin, eventId) {
      const event = await loadEvent(admin, eventId);
      const data = await deps.photos.getStats(event.id, eventDayInTimezone(event.timezone, now()));

      return data as AdminEventPhotoStats;
    },

    async activity(admin, eventId, query) {
      const event = await loadEvent(admin, eventId);
      const result = await deps.photos.listActivity(event.id, query.page, query.limit);

      return {
        rows: result.rows.map((row) => ({
          id: row.id,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          metadata: row.metadata ?? {},
          createdAt: row.created_at,
        })),
        total: result.total,
      };
    },
  };
}
