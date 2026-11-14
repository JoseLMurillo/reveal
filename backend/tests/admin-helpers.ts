import { randomUUID } from "node:crypto";

import type {
  AdminRecord,
  AlbumSummary,
  AuditEntry,
  AuditInput,
  AuthenticatedAdmin,
  EventCreateValues,
  EventListFilters,
  EventListResult,
  EventRecord,
  EventStats,
  EventUpdateValues,
} from "../src/modules/admin/shared/types.js";
import type {
  AdminRepository,
  AdminSessionRepository,
} from "../src/modules/admin/auth/auth.repository.js";
import type { AdminSessionRecord } from "../src/modules/admin/shared/types.js";
import type { AuditRepository } from "../src/modules/admin/shared/audit.repository.js";
import type { EventRepository } from "../src/modules/admin/events/events.repository.js";
import type {
  AdminParticipantsRepository,
  NewParticipantEntry,
} from "../src/modules/admin/participants/participants.repository.js";
import type {
  CreatedParticipantRow,
  ParticipantPhotoStats,
  ParticipantRecord,
} from "../src/modules/participants/types.js";
import type { StatsRepository } from "../src/modules/admin/shared/stats.repository.js";
import type { AdminPhotosRepository } from "../src/modules/admin/photos/photos.repository.js";
import type { PhotoStorageService } from "../src/modules/photos/photos.storage.js";
import type { PhotoRecord, UploadSessionRecord } from "../src/modules/photos/types.js";
import type {
  AlbumPhotoRecord,
  AlbumRecord,
  GalleryPhotoRecord,
  VoteRecord,
} from "../src/modules/albums/types.js";
import type { AlbumRepository } from "../src/modules/albums/albums.repository.js";
import { conflict } from "../src/errors/app-error.js";
import { ERROR_CODES } from "../src/errors/error-codes.js";
import type { StorageService } from "../src/modules/admin/shared/storage.service.js";
import { isCoverPathForEvent } from "../src/modules/admin/shared/storage.service.js";
import { hashPassword } from "../src/utils/password.js";

export type InMemoryState = {
  admins: Map<string, AdminRecord>;
  sessions: Map<string, AdminSessionRecord>;
  events: Map<string, EventRecord>;
  stats: Map<string, EventStats>;
  audit: AuditEntry[];
  cleanup: Array<{ paths: string[]; reason: string }>;
  activity: Set<string>;
  album: Map<string, AlbumSummary>;
  cancelledSessions: Map<string, number>;
  participants: Map<string, ParticipantRecord>;
  participantPhotoStats: Map<string, ParticipantPhotoStats>;
  photos: Map<string, PhotoRecord>;
  uploadSessions: Map<string, UploadSessionRecord>;
  albums: Map<string, AlbumRecord>;
  albumEntries: Map<string, Array<{ photoId: string; eventDay: string; position: number }>>;
  photoVotes: Map<string, VoteRecord>;
  photoObjects: Map<string, Buffer>;
};

export function createState(): InMemoryState {
  return {
    admins: new Map(),
    sessions: new Map(),
    events: new Map(),
    stats: new Map(),
    audit: [],
    cleanup: [],
    activity: new Set(),
    album: new Map(),
    cancelledSessions: new Map(),
    participants: new Map(),
    participantPhotoStats: new Map(),
    photos: new Map(),
    uploadSessions: new Map(),
    albums: new Map(),
    albumEntries: new Map(),
    photoVotes: new Map(),
    photoObjects: new Map(),
  };
}

export async function seedAdmin(
  state: InMemoryState,
  options: {
    email: string;
    password: string;
    displayName?: string;
    role?: AdminRecord["role"];
    isActive?: boolean;
  },
): Promise<AdminRecord> {
  const admin: AdminRecord = {
    id: randomUUID(),
    email: options.email,
    passwordHash: await hashPassword(options.password),
    displayName: options.displayName ?? "Admin",
    role: options.role ?? "admin",
    isActive: options.isActive ?? true,
    lastLoginAt: null,
    passwordChangedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  state.admins.set(admin.id, admin);
  return admin;
}

export function createAdminRepository(state: InMemoryState): AdminRepository {
  return {
    async findByEmail(email) {
      return (
        [...state.admins.values()].find(
          (admin) => admin.email.toLowerCase() === email.toLowerCase(),
        ) ?? null
      );
    },
    async findById(id) {
      return state.admins.get(id) ?? null;
    },
    async touchLastLogin(id) {
      const admin = state.admins.get(id);
      if (admin) {
        admin.lastLoginAt = new Date().toISOString();
      }
    },
    async updatePassword(id, passwordHash) {
      const admin = state.admins.get(id);
      if (admin) {
        admin.passwordHash = passwordHash;
        admin.passwordChangedAt = new Date().toISOString();
      }
    },
  };
}

export function createSessionRepository(state: InMemoryState): AdminSessionRepository {
  return {
    async create(input) {
      const session: AdminSessionRecord = {
        id: randomUUID(),
        adminUserId: input.adminUserId,
        tokenHash: input.tokenHash,
        createdAt: new Date().toISOString(),
        expiresAt: input.expiresAt,
        lastUsedAt: new Date().toISOString(),
        revokedAt: null,
      };
      state.sessions.set(session.id, session);
      return session;
    },
    async findByTokenHash(tokenHash) {
      return (
        [...state.sessions.values()].find((session) => session.tokenHash === tokenHash) ?? null
      );
    },
    async touch(id, lastUsedAt) {
      const session = state.sessions.get(id);
      if (session) {
        session.lastUsedAt = lastUsedAt;
      }
    },
    async revoke(id) {
      const session = state.sessions.get(id);
      if (session) {
        session.revokedAt = new Date().toISOString();
      }
    },
    async revokeAllForAdmin(adminUserId) {
      let count = 0;
      for (const session of state.sessions.values()) {
        if (session.adminUserId === adminUserId && session.revokedAt === null) {
          session.revokedAt = new Date().toISOString();
          count += 1;
        }
      }
      return count;
    },
  };
}

export function createAuditRepository(state: InMemoryState): AuditRepository {
  return {
    async record(input: AuditInput) {
      state.audit.push({
        id: state.audit.length + 1,
        action: input.action,
        eventId: input.eventId ?? null,
        eventName: input.eventId ? (state.events.get(input.eventId)?.name ?? null) : null,
        metadata: input.metadata ?? {},
        createdAt: new Date().toISOString(),
      });
    },
    async listRecent(eventIds, limit) {
      return state.audit
        .filter((entry) => eventIds === null || (entry.eventId && eventIds.includes(entry.eventId)))
        .slice(-limit)
        .reverse();
    },
  };
}

export function createStatsRepository(state: InMemoryState): StatsRepository {
  return {
    async getEventStats(eventIds) {
      const result = new Map<string, EventStats>();
      const ids = eventIds ?? [...state.events.keys()];
      for (const id of ids) {
        result.set(
          id,
          state.stats.get(id) ?? {
            participants: 0,
            photos: 0,
            photosToday: 0,
            quotaConsumedToday: 0,
          },
        );
      }
      return result;
    },
  };
}

export function createEventRepository(state: InMemoryState): EventRepository {
  const now = () => new Date().toISOString();

  return {
    async list(admin: AdminRecord, filters: EventListFilters): Promise<EventListResult> {
      let rows = [...state.events.values()].filter(
        (event) => admin.role === "owner" || event.adminId === admin.id,
      );

      if (filters.status) rows = rows.filter((event) => event.status === filters.status);
      if (filters.search) {
        const search = filters.search.toLowerCase();
        rows = rows.filter(
          (event) => event.name.toLowerCase().includes(search) || event.slug.includes(search),
        );
      }
      if (filters.from) rows = rows.filter((event) => event.endDate >= filters.from!);
      if (filters.to) rows = rows.filter((event) => event.startDate <= filters.to!);

      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const start = (filters.page - 1) * filters.limit;

      return { rows: rows.slice(start, start + filters.limit), total: rows.length };
    },
    async findById(id) {
      return state.events.get(id) ?? null;
    },
    async create(adminId, values: EventCreateValues, slug): Promise<EventRecord> {
      const timestamp = now();
      const event: EventRecord = {
        id: randomUUID(),
        adminId,
        slug,
        name: values.name,
        description: values.description ?? null,
        coverImagePath: null,
        startDate: values.startDate,
        endDate: values.endDate,
        timezone: values.timezone,
        dailyPhotoLimit: values.dailyPhotoLimit,
        totalPhotoLimit: values.totalPhotoLimit ?? null,
        requireName: values.requireName,
        showParticipantNames: values.showParticipantNames,
        allowSelfRegistration: values.allowSelfRegistration,
        participantLimit: values.participantLimit ?? null,
        maxFileSizeBytes: values.maxFileSizeBytes,
        galleryVisibility: values.galleryVisibility,
        allowPhotoDeletion: values.allowPhotoDeletion,
        status: "draft",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.events.set(event.id, event);
      return event;
    },
    async update(id, values: EventUpdateValues) {
      const event = state.events.get(id);
      if (!event) throw new Error("missing event");
      Object.assign(event, values, { updatedAt: now() });
      return event;
    },
    async setCover(id, path) {
      const event = state.events.get(id);
      if (!event) throw new Error("missing event");
      event.coverImagePath = path;
      event.updatedAt = now();
      return event;
    },
    async setStatus(id, status) {
      const event = state.events.get(id);
      if (!event) throw new Error("missing event");
      event.status = status;
      event.updatedAt = now();
      return event;
    },
    async remove(id) {
      state.events.delete(id);
    },
    async slugExists(slug) {
      return [...state.events.values()].some((event) => event.slug === slug);
    },
    async countParticipants(eventId) {
      return state.stats.get(eventId)?.participants ?? 0;
    },
    async hasActivity(eventId) {
      return state.activity.has(eventId);
    },
    async getAlbum(eventId) {
      return state.album.get(eventId) ?? null;
    },
    async listActiveUploadSessions() {
      return [];
    },
    async cancelActiveUploadSessions(eventId) {
      return state.cancelledSessions.get(eventId) ?? 0;
    },
    async listStoragePaths(eventId) {
      const event = state.events.get(eventId);
      return event?.coverImagePath ? [event.coverImagePath] : [];
    },
    async enqueueCleanup(paths, reason) {
      state.cleanup.push({ paths, reason });
      return paths.length;
    },
    async listAccessibleEventIds(admin) {
      return [...state.events.values()]
        .filter((event) => admin.role === "owner" || event.adminId === admin.id)
        .map((event) => event.id);
    },
    async listAll(admin) {
      return [...state.events.values()].filter(
        (event) => admin.role === "owner" || event.adminId === admin.id,
      );
    },
  };
}

export function createAdminParticipantsRepository(
  state: InMemoryState,
): AdminParticipantsRepository {
  const now = () => new Date().toISOString();

  function createdRow(participant: ParticipantRecord): CreatedParticipantRow {
    return {
      id: participant.id,
      eventId: participant.eventId,
      displayName: participant.displayName,
      note: participant.note,
      registrationSource: participant.registrationSource,
      accessCodePrefix: participant.accessCodePrefix,
      accessCodeCreatedAt: participant.accessCodeCreatedAt,
      isActive: participant.isActive,
      createdAt: participant.createdAt,
      updatedAt: participant.updatedAt,
      lastSeenAt: participant.lastSeenAt,
    };
  }

  function remainingSlots(eventId: string): number | null {
    const event = state.events.get(eventId);
    if (!event || event.participantLimit === null) {
      return null;
    }

    const used = [...state.participants.values()].filter(
      (participant) => participant.eventId === eventId,
    ).length;

    return Math.max(event.participantLimit - used, 0);
  }

  return {
    async list(eventId, filters) {
      let rows = [...state.participants.values()].filter(
        (participant) => participant.eventId === eventId,
      );

      if (filters.source) {
        rows = rows.filter((participant) => participant.registrationSource === filters.source);
      }

      if (filters.isActive !== undefined) {
        rows = rows.filter((participant) => participant.isActive === filters.isActive);
      }

      if (filters.anonymous === true) {
        rows = rows.filter((participant) => participant.displayName === null);
      } else if (filters.anonymous === false) {
        rows = rows.filter((participant) => participant.displayName !== null);
      }

      if (filters.search) {
        const search = filters.search.toLowerCase();
        rows = rows.filter(
          (participant) =>
            participant.displayName?.toLowerCase().includes(search) ||
            participant.note?.toLowerCase().includes(search) ||
            participant.accessCodePrefix.toLowerCase().includes(search),
        );
      }

      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const start = (filters.page - 1) * filters.limit;

      return {
        rows: rows.slice(start, start + filters.limit),
        total: rows.length,
      };
    },

    async findById(id) {
      return state.participants.get(id) ?? null;
    },

    async countParticipants(eventId) {
      return [...state.participants.values()].filter(
        (participant) => participant.eventId === eventId,
      ).length;
    },

    async create(eventId, entries: NewParticipantEntry[], _adminId: string) {
      const event = state.events.get(eventId);

      if (!event) {
        throw new Error("EVENT_NOT_FOUND");
      }

      const used = [...state.participants.values()].filter(
        (participant) => participant.eventId === eventId,
      ).length;

      if (event.participantLimit !== null && used + entries.length > event.participantLimit) {
        throw conflict(
          ERROR_CODES.PARTICIPANT_LIMIT_REACHED,
          "El evento alcanzó el cupo máximo de participantes.",
        );
      }

      const timestamp = now();
      const created = entries.map((entry) => {
        const participant: ParticipantRecord = {
          id: randomUUID(),
          eventId,
          displayName: entry.displayName,
          note: entry.note,
          registrationSource: "admin",
          accessCodeHash: entry.accessCodeHash,
          accessCodePrefix: entry.accessCodePrefix,
          accessCodeCreatedAt: timestamp,
          accessCodeRevokedAt: null,
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          lastSeenAt: timestamp,
        };

        state.participants.set(participant.id, participant);
        return createdRow(participant);
      });

      return {
        participants: created,
        remainingSlots: remainingSlots(eventId),
      };
    },

    async stats(participantIds) {
      return new Map(
        participantIds.map((id) => [
          id,
          state.participantPhotoStats.get(id) ?? {
            photosTotal: 0,
            photosToday: 0,
            reservedToday: 0,
          },
        ]),
      );
    },

    async updateProfile(participantId, values) {
      const participant = state.participants.get(participantId);

      if (!participant) {
        throw new Error("PARTICIPANT_NOT_FOUND");
      }

      if (values.displayName !== undefined) {
        participant.displayName = values.displayName;
      }

      if (values.note !== undefined) {
        participant.note = values.note;
      }

      participant.updatedAt = now();
      return participant;
    },

    async rotateAccessCode(participantId, accessCodeHash, accessCodePrefix) {
      const participant = state.participants.get(participantId);

      if (!participant) {
        throw new Error("PARTICIPANT_NOT_FOUND");
      }

      participant.accessCodeHash = accessCodeHash;
      participant.accessCodePrefix = accessCodePrefix;
      participant.accessCodeCreatedAt = now();
      participant.accessCodeRevokedAt = null;
      participant.updatedAt = now();

      return {
        participantId,
        accessCodePrefix,
        accessCodeCreatedAt: participant.accessCodeCreatedAt,
        revokedSessions: 0,
      };
    },

    async revokeAccessCode(participantId) {
      const participant = state.participants.get(participantId);

      if (!participant) {
        throw new Error("PARTICIPANT_NOT_FOUND");
      }

      participant.accessCodeRevokedAt = now();
      participant.updatedAt = now();

      return {
        participantId,
        accessCodeRevokedAt: participant.accessCodeRevokedAt,
        revokedSessions: 0,
      };
    },

    async setActive(participantId, isActive) {
      const participant = state.participants.get(participantId);

      if (!participant) {
        throw new Error("PARTICIPANT_NOT_FOUND");
      }

      participant.isActive = isActive;
      participant.updatedAt = now();

      return { participantId, isActive, revokedSessions: 0 };
    },
  };
}

export function createStorageService(state: InMemoryState): StorageService {
  return {
    async createSignedUrl(path) {
      return path ? `https://storage.test/${path}` : null;
    },
    async createCoverUploadTarget(eventId, mimeType) {
      const extension =
        mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      return {
        storagePath: `events/${eventId}/cover/${randomUUID()}.${extension}`,
        signedUrl: `https://upload.test/${eventId}`,
        token: "test-token",
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
      };
    },
    async validateCoverObject(eventId, storagePath) {
      if (!isCoverPathForEvent(eventId, storagePath)) {
        throw new Error("invalid cover path");
      }
    },
    async removeObject() {
      state.cleanup.push({ paths: ["removed"], reason: "test_remove" });
    },
  };
}

export function createAdminPhotosRepository(state: InMemoryState): AdminPhotosRepository {
  return {
    async list(eventId, filters) {
      let rows = [...state.photos.values()].filter((photo) => photo.eventId === eventId);

      if (!filters.includeDeleted) {
        rows = rows.filter((photo) => photo.status === "active");
      }

      if (filters.day) {
        rows = rows.filter((photo) => photo.eventDay === filters.day);
      }

      if (filters.participantId) {
        rows = rows.filter((photo) => photo.participantId === filters.participantId);
      }

      if (filters.search) {
        const search = filters.search.toLowerCase();
        rows = rows.filter((photo) => {
          const participant = state.participants.get(photo.participantId);
          return (
            photo.originalFilename.toLowerCase().includes(search) ||
            (participant?.displayName ?? "").toLowerCase().includes(search)
          );
        });
      }

      rows.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
      const start = (filters.page - 1) * filters.limit;

      return {
        rows: rows.slice(start, start + filters.limit).map((photo) => ({
          ...photo,
          participantDisplayName: state.participants.get(photo.participantId)?.displayName ?? null,
        })),
        total: rows.length,
      };
    },

    async findPhoto(id) {
      return state.photos.get(id) ?? null;
    },

    async softDeletePhoto(id, adminId) {
      const photo = state.photos.get(id);

      if (!photo) {
        throw new Error("PHOTO_NOT_FOUND");
      }

      photo.status = "deleted";
      photo.deletedAt = new Date().toISOString();
      photo.deletedByAdminId = adminId;
      return photo;
    },

    async getStats(eventId, eventDay) {
      const event = state.events.get(eventId);
      const active = [...state.photos.values()].filter(
        (photo) => photo.eventId === eventId && photo.status === "active",
      );
      const deleted = [...state.photos.values()].filter(
        (photo) => photo.eventId === eventId && photo.status === "deleted",
      );

      return {
        event: {
          id: eventId,
          name: event?.name ?? "Evento",
          status: event?.status ?? "draft",
        },
        totals: {
          participants: [...state.participants.values()].filter(
            (participant) => participant.eventId === eventId,
          ).length,
          anonymousParticipants: [...state.participants.values()].filter(
            (participant) => participant.eventId === eventId && participant.displayName === null,
          ).length,
          photos: active.length,
          photosToday: active.filter((photo) => photo.eventDay === eventDay).length,
          storageBytes: active.reduce((total, photo) => total + photo.fileSize, 0),
          deletedPhotos: deleted.length,
        },
        byDay: [],
        topParticipants: [],
      };
    },

    async listActivity(eventId, page, limit) {
      const rows = state.audit
        .filter((entry) => entry.eventId === eventId)
        .map((entry) => ({
          id: Number(entry.id),
          action: entry.action,
          entity_type: null,
          entity_id: null,
          metadata: entry.metadata,
          created_at: entry.createdAt,
        }));

      const start = (page - 1) * limit;

      return { rows: rows.slice(start, start + limit), total: rows.length };
    },
  };
}

export function createPhotoStorageService(state: InMemoryState): PhotoStorageService {
  return {
    pathFor(location, mimeType) {
      const extension =
        mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      return `events/${location.eventId}/originals/${location.eventDay}/${location.participantId}/${location.itemId}.${extension}`;
    },
    async createUploadTarget(path) {
      return {
        signedUrl: `https://upload.test/${path}`,
        token: "signed-token",
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
      };
    },
    async validateOriginal(_location, storagePath, declaredMimeType) {
      const bytes = state.photoObjects.get(storagePath);

      if (!bytes) {
        throw new Error("El archivo no se ha subido o no se puede leer.");
      }

      return {
        mimeType: declaredMimeType,
        fileSize: bytes.length,
        width: 1600,
        height: 1200,
        contentHash: bytes.toString("hex").padEnd(64, "0").slice(0, 64),
      };
    },
    async createSignedUrl(storagePath) {
      return `https://storage.test/${storagePath}`;
    },
    async downloadOriginal(storagePath) {
      const bytes = state.photoObjects.get(storagePath);

      if (!bytes) {
        throw new Error("Objeto no encontrado.");
      }

      return bytes;
    },
    async removeObject(storagePath) {
      state.photoObjects.delete(storagePath);
      state.cleanup.push({ paths: [storagePath], reason: "test_photo_remove" });
    },
  };
}

export function createAlbumRepository(state: InMemoryState): AlbumRepository {
  function eventPhotos(eventId: string, day?: string): GalleryPhotoRecord[] {
    return [...state.photos.values()]
      .filter(
        (photo) =>
          photo.eventId === eventId &&
          photo.status === "active" &&
          (day === undefined || photo.eventDay === day),
      )
      .sort(
        (left, right) =>
          left.eventDay.localeCompare(right.eventDay) ||
          left.uploadedAt.localeCompare(right.uploadedAt),
      )
      .map((photo) => ({
        ...photo,
        participantDisplayName: state.participants.get(photo.participantId)?.displayName ?? null,
      }));
  }

  return {
    async findEventBySlug(slug) {
      return [...state.events.values()].find((event) => event.slug === slug) ?? null;
    },
    async findEventById(id) {
      return state.events.get(id) ?? null;
    },
    async findAlbumBySlug(slug) {
      return (
        [...state.albums.values()].find(
          (album) =>
            album.slug === slug && album.status === "published" && album.visibility === "public",
        ) ?? null
      );
    },
    async findAlbumByEvent(eventId) {
      return [...state.albums.values()].find((album) => album.eventId === eventId) ?? null;
    },
    async slugExists(slug) {
      return [...state.albums.values()].some((album) => album.slug === slug);
    },
    async createAlbum(input) {
      const timestamp = new Date().toISOString();
      const album: AlbumRecord = {
        id: randomUUID(),
        eventId: input.eventId,
        slug: input.slug,
        title: input.title,
        subtitle: input.subtitle,
        coverPhotoId: input.coverPhotoId,
        status: "draft",
        visibility: input.visibility,
        generatedBy: input.generatedBy,
        publishedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.albums.set(album.id, album);
      return album;
    },
    async updateAlbum(albumId, values) {
      const album = state.albums.get(albumId);

      if (!album) {
        throw new Error("ALBUM_NOT_FOUND");
      }

      if (values.title !== undefined) album.title = values.title;
      if (values.subtitle !== undefined) album.subtitle = values.subtitle;
      if (values.coverPhotoId !== undefined) album.coverPhotoId = values.coverPhotoId;
      if (values.visibility !== undefined) album.visibility = values.visibility;
      if (values.status !== undefined) album.status = values.status;
      if (values.publishedAt !== undefined) album.publishedAt = values.publishedAt;
      album.updatedAt = new Date().toISOString();
      return album;
    },
    async replaceAlbumPhotos(albumId, rows) {
      state.albumEntries.set(
        albumId,
        rows.map((row) => ({ ...row })),
      );
    },
    async listAlbumPhotos(albumId) {
      const album = state.albums.get(albumId);
      const entries = state.albumEntries.get(albumId) ?? [];

      if (!album) {
        return [];
      }

      return entries.flatMap((entry) => {
        const photo = state.photos.get(entry.photoId);

        if (!photo) {
          return [];
        }

        return [
          {
            ...photo,
            participantDisplayName:
              state.participants.get(photo.participantId)?.displayName ?? null,
            albumPhotoId: randomUUID(),
            albumEventDay: entry.eventDay,
            position: entry.position,
            caption: null,
          } satisfies AlbumPhotoRecord,
        ];
      });
    },
    async listEventPhotos(eventId, day) {
      return eventPhotos(eventId, day);
    },
    async findEventPhoto(eventId, photoId) {
      return eventPhotos(eventId).find((photo) => photo.id === photoId) ?? null;
    },
    async listVotesForParticipant(participantId, eventId) {
      return [...state.photoVotes.values()].filter(
        (vote) => vote.participantId === participantId && vote.eventId === eventId,
      );
    },
    async listVotesForDay(eventId, day) {
      return [...state.photoVotes.values()].filter(
        (vote) => vote.eventId === eventId && vote.eventDay === day,
      );
    },
    async upsertVote(input) {
      state.photoVotes.set(`${input.photoId}:${input.participantId}`, {
        photoId: input.photoId,
        participantId: input.participantId,
        eventId: input.eventId,
        eventDay: input.eventDay,
        value: input.value,
      });
    },
    async countVotes(photoId) {
      const votes = [...state.photoVotes.values()].filter((vote) => vote.photoId === photoId);

      return {
        likes: votes.filter((vote) => vote.value === "like").length,
        dislikes: votes.filter((vote) => vote.value === "dislike").length,
      };
    },
  };
}

export type Harness = {
  state: InMemoryState;
  getAdmin: (email: string) => AdminRecord;
};

export async function createHarness(): Promise<Harness> {
  const state = createState();
  return {
    state,
    getAdmin: (email) => {
      const admin = [...state.admins.values()].find((item) => item.email === email);
      if (!admin) throw new Error(`missing admin ${email}`);
      return admin;
    },
  };
}

export type TestAdmin = AdminRecord;
export type TestAuthenticatedAdmin = AuthenticatedAdmin;
