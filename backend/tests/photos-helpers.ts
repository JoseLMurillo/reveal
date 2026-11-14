import { createHash, randomUUID } from "node:crypto";

import type { AllowedImageMimeType } from "@rollo/shared";

import { AppError } from "../src/errors/app-error.js";
import { ERROR_CODES } from "../src/errors/error-codes.js";
import type { EventRecord } from "../src/modules/admin/shared/types.js";
import type { ParticipantRepository } from "../src/modules/participants/participants.repository.js";
import type {
  ParticipantRecord,
  ParticipantSessionRecord,
  QuotaRecord,
} from "../src/modules/participants/types.js";
import type {
  ConfirmRpcItemResult,
  ConfirmRpcResult,
  PhotoRecord,
  ReleaseRpcResult,
  ReserveRpcResult,
  UploadItemRecord,
  UploadSessionRecord,
} from "../src/modules/photos/types.js";
import type { PhotosRepository } from "../src/modules/photos/photos.repository.js";
import type {
  PhotoStorageService,
  ValidatedOriginal,
} from "../src/modules/photos/photos.storage.js";
import { originalPathFor } from "../src/modules/photos/photos.storage.js";
import { dayNumberFor, eventDayInTimezone, nextQuotaReset } from "../src/utils/event-time.js";
import { hashToken } from "../src/utils/token.js";

export const SESSION_TOKEN = "test-participant-session-token";
export const PARTICIPANT_ID = "11111111-1111-4111-8111-111111111111";

export type StoredObject = {
  bytes: Buffer;
  mimeType: AllowedImageMimeType;
  width: number;
  height: number;
};

export type PhotoHarnessState = {
  now: Date;
  event: EventRecord;
  participant: ParticipantRecord;
  session: ParticipantSessionRecord;
  sessions: Map<string, UploadSessionRecord>;
  items: Map<string, UploadItemRecord>;
  photos: Map<string, PhotoRecord>;
  objects: Map<string, StoredObject>;
  releaseCalls: Array<{
    sessionId: string;
    itemIds: string[] | null;
    reason: string;
  }>;
  failUploadTarget: boolean;
};

export type PhotoHarness = {
  state: PhotoHarnessState;
  repository: PhotosRepository;
  storage: PhotoStorageService;
  participantRepository: ParticipantRepository;
  seedObject: (
    storagePath: string,
    options?: {
      mimeType?: AllowedImageMimeType;
      bytes?: Buffer;
      width?: number;
      height?: number;
    },
  ) => void;
  addPhoto: (overrides?: Partial<PhotoRecord>) => PhotoRecord;
};

function atNoonUtc(day: string): Date {
  return new Date(`${day}T18:00:00.000Z`);
}

export function createEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: randomUUID(),
    adminId: randomUUID(),
    slug: "cumple-de-ana",
    name: "Cumpleaños de Ana",
    description: "Una tarde para recordar.",
    coverImagePath: null,
    startDate: "2026-11-13",
    endDate: "2026-11-17",
    timezone: "America/Mexico_City",
    dailyPhotoLimit: 3,
    totalPhotoLimit: 12,
    requireName: true,
    showParticipantNames: true,
    allowSelfRegistration: true,
    participantLimit: 20,
    maxFileSizeBytes: 10_485_760,
    galleryVisibility: "participants",
    allowPhotoDeletion: true,
    status: "active",
    createdAt: "2026-11-01T18:00:00.000Z",
    updatedAt: "2026-11-01T18:00:00.000Z",
    ...overrides,
  };
}

function createParticipant(eventId: string): ParticipantRecord {
  return {
    id: PARTICIPANT_ID,
    eventId,
    displayName: "Ana",
    note: null,
    registrationSource: "admin",
    accessCodeHash: "access-hash",
    accessCodePrefix: "abc123",
    accessCodeCreatedAt: "2026-11-12T18:00:00.000Z",
    accessCodeRevokedAt: null,
    isActive: true,
    createdAt: "2026-11-12T18:00:00.000Z",
    updatedAt: "2026-11-12T18:00:00.000Z",
    lastSeenAt: "2026-11-12T18:00:00.000Z",
  };
}

function createSession(participantId: string, now: Date): ParticipantSessionRecord {
  return {
    id: randomUUID(),
    participantId,
    tokenHash: hashToken(SESSION_TOKEN),
    createdAt: new Date(now.getTime() - 60_000).toISOString(),
    expiresAt: new Date(now.getTime() + 86_400_000).toISOString(),
    lastUsedAt: new Date(now.getTime() - 60_000).toISOString(),
    revokedAt: null,
  };
}

export function createPhotoHarness(options: { now?: Date } = {}): PhotoHarness {
  const event = createEvent();
  const state: PhotoHarnessState = {
    now: options.now ?? atNoonUtc("2026-11-15"),
    event,
    participant: createParticipant(event.id),
    session: createSession(PARTICIPANT_ID, options.now ?? atNoonUtc("2026-11-15")),
    sessions: new Map(),
    items: new Map(),
    photos: new Map(),
    objects: new Map(),
    releaseCalls: [],
    failUploadTarget: false,
  };

  function eventDay(): string {
    return eventDayInTimezone(state.event.timezone, state.now);
  }

  function activePhotos(): PhotoRecord[] {
    return [...state.photos.values()].filter((photo) => photo.status === "active");
  }

  function reservedItems(): UploadItemRecord[] {
    return [...state.items.values()].filter((item) => {
      const session = state.sessions.get(item.uploadSessionId);
      return item.status === "reserved" && session?.status === "reserved";
    });
  }

  function quotaOf(): QuotaRecord {
    const day = eventDay();
    const photos = activePhotos();
    const usedDay = photos.filter((photo) => photo.eventDay === day).length;
    const usedTotal = photos.length;
    const reservedDay = reservedItems().filter(
      (item) => state.sessions.get(item.uploadSessionId)?.eventDay === day,
    ).length;
    const reservedTotal = reservedItems().length;
    const remainingDay = Math.max(state.event.dailyPhotoLimit - usedDay - reservedDay, 0);
    const remainingTotal =
      state.event.totalPhotoLimit === null
        ? null
        : Math.max(state.event.totalPhotoLimit - usedTotal - reservedTotal, 0);

    return {
      eventDay: day,
      dayNumber: dayNumberFor(state.event.startDate, day),
      dailyLimit: state.event.dailyPhotoLimit,
      totalLimit: state.event.totalPhotoLimit,
      usedDay,
      usedTotal,
      reservedDay,
      reservedTotal,
      remainingDay,
      remainingTotal,
      resetsAt: nextQuotaReset(state.event.timezone, state.now).toISOString(),
      eventStatus: state.event.status,
    };
  }

  const repository: PhotosRepository = {
    async reserve(participantId, items, ttlSeconds): Promise<ReserveRpcResult> {
      if (participantId !== state.participant.id) {
        throw new AppError(404, ERROR_CODES.NOT_FOUND, "Participante no encontrado.");
      }

      if (!state.participant.isActive) {
        throw new AppError(403, ERROR_CODES.FORBIDDEN, "Participante deshabilitado.");
      }

      if (state.event.status !== "active") {
        throw new AppError(409, ERROR_CODES.EVENT_NOT_ACTIVE, "El evento no está activo.");
      }

      const quota = quotaOf();

      if (quota.remainingDay < items.length) {
        throw new AppError(
          409,
          ERROR_CODES.QUOTA_EXCEEDED,
          "No tienes suficientes disparos disponibles.",
          {
            details: {
              remainingDay: quota.remainingDay,
              requested: items.length,
            },
          },
        );
      }

      if (quota.remainingTotal !== null && quota.remainingTotal < items.length) {
        throw new AppError(
          409,
          ERROR_CODES.QUOTA_EXCEEDED,
          "No tienes suficientes disparos disponibles.",
          {
            details: {
              remainingTotal: quota.remainingTotal,
              requested: items.length,
            },
          },
        );
      }

      const createdAt = state.now.toISOString();
      const session: UploadSessionRecord = {
        id: randomUUID(),
        eventId: state.event.id,
        participantId,
        eventDay: quota.eventDay,
        reservedCount: items.length,
        uploadedCount: 0,
        releasedCount: 0,
        status: "reserved",
        expiresAt: new Date(state.now.getTime() + ttlSeconds * 1000).toISOString(),
        createdAt,
        updatedAt: createdAt,
        closedAt: null,
      };

      state.sessions.set(session.id, session);

      for (const item of items) {
        state.items.set(item.itemId, {
          id: item.itemId,
          uploadSessionId: session.id,
          clientFileId: item.clientFileId,
          storagePath: item.storagePath,
          declaredFilename: item.filename,
          declaredMimeType: item.mimeType,
          declaredSizeBytes: item.sizeBytes,
          status: "reserved",
          failureCode: null,
          createdAt,
          confirmedAt: null,
        });
      }

      const after = quotaOf();

      return {
        sessionId: session.id,
        eventDay: session.eventDay,
        expiresAt: session.expiresAt,
        remainingDay: after.remainingDay,
        remainingTotal: after.remainingTotal,
      };
    },

    async findSession(id) {
      return state.sessions.get(id) ?? null;
    },

    async listSessionItems(sessionId) {
      return [...state.items.values()].filter((item) => item.uploadSessionId === sessionId);
    },

    async listPendingItems(sessionId, itemIds) {
      return [...state.items.values()].filter((item) => {
        if (item.uploadSessionId !== sessionId) return false;
        if (item.status !== "reserved" && item.status !== "uploaded") return false;
        return !itemIds || itemIds.includes(item.id);
      });
    },

    async confirm(sessionId, participantId, entries): Promise<ConfirmRpcResult> {
      const session = state.sessions.get(sessionId);

      if (!session || session.participantId !== participantId) {
        throw new AppError(404, ERROR_CODES.NOT_FOUND, "Sesión no encontrada.");
      }

      if (session.status !== "reserved") {
        return {
          sessionId,
          status: session.status,
          expired: session.status === "expired",
          uploadedCount: session.uploadedCount,
          releasedCount: session.releasedCount,
          eventDay: session.eventDay,
          results: [],
        };
      }

      if (new Date(session.expiresAt).getTime() <= state.now.getTime()) {
        session.status = "expired";
        session.closedAt = state.now.toISOString();

        for (const item of state.items.values()) {
          if (item.uploadSessionId === session.id && item.status === "reserved") {
            item.status = "expired";
          }
        }

        return {
          sessionId,
          status: "expired",
          expired: true,
          uploadedCount: session.uploadedCount,
          releasedCount: session.releasedCount,
          eventDay: session.eventDay,
          results: [],
        };
      }

      const alreadyHashed = new Map(activePhotos().map((photo) => [photo.contentHash, photo.id]));
      const results: ConfirmRpcItemResult[] = [];
      const uploadedAt = state.now.toISOString();

      for (const entry of entries) {
        const item = state.items.get(entry.itemId);

        if (!item || item.uploadSessionId !== session.id) {
          results.push({
            itemId: entry.itemId,
            clientFileId: null,
            status: "failed",
            error: {
              code: "UPLOAD_ITEM_NOT_FOUND",
              message: "El archivo no pertenece a esta carga.",
            },
          });
          continue;
        }

        if (item.status === "confirmed") {
          const photo = [...state.photos.values()].find(
            (candidate) => candidate.uploadItemId === item.id,
          );

          results.push({
            itemId: item.id,
            clientFileId: item.clientFileId,
            status: "confirmed",
            ...(photo ? { photoId: photo.id } : {}),
          });
          continue;
        }

        if (item.status !== "reserved" && item.status !== "uploaded") {
          results.push({
            itemId: item.id,
            clientFileId: item.clientFileId,
            status: "failed",
            error: {
              code: "ITEM_NOT_PENDING",
              message: "El archivo ya no está pendiente.",
            },
          });
          continue;
        }

        const duplicateId = alreadyHashed.get(entry.contentHash);

        if (duplicateId) {
          item.status = "failed";
          item.failureCode = "DUPLICATE_PHOTO";
          session.releasedCount += 1;
          results.push({
            itemId: item.id,
            clientFileId: item.clientFileId,
            status: "failed",
            error: {
              code: "DUPLICATE_PHOTO",
              message: "Esta fotografía ya está en el evento.",
            },
          });
          continue;
        }

        const photo: PhotoRecord = {
          id: randomUUID(),
          eventId: state.event.id,
          participantId,
          uploadItemId: item.id,
          storagePath: item.storagePath,
          originalFilename: item.declaredFilename,
          mimeType: entry.mimeType,
          fileSize: entry.fileSize,
          width: entry.width,
          height: entry.height,
          contentHash: entry.contentHash,
          eventDay: session.eventDay,
          uploadedAt,
          status: "active",
          deletedAt: null,
          deletedByAdminId: null,
        };

        state.photos.set(photo.id, photo);
        item.status = "confirmed";
        item.confirmedAt = uploadedAt;
        session.uploadedCount += 1;
        alreadyHashed.set(entry.contentHash, photo.id);

        results.push({
          itemId: item.id,
          clientFileId: item.clientFileId,
          status: "confirmed",
          photoId: photo.id,
        });
      }

      const pending = [...state.items.values()].filter(
        (item) =>
          item.uploadSessionId === session.id &&
          (item.status === "reserved" || item.status === "uploaded"),
      );

      if (pending.length === 0) {
        session.status = session.releasedCount > 0 ? "partially_completed" : "completed";
        session.closedAt = state.now.toISOString();
      }

      return {
        sessionId,
        status: session.status,
        expired: false,
        uploadedCount: session.uploadedCount,
        releasedCount: session.releasedCount,
        eventDay: session.eventDay,
        results,
      };
    },

    async release(sessionId, participantId, itemIds, reason): Promise<ReleaseRpcResult> {
      const session = state.sessions.get(sessionId);

      if (!session || session.participantId !== participantId) {
        throw new AppError(404, ERROR_CODES.NOT_FOUND, "Sesión no encontrada.");
      }

      state.releaseCalls.push({ sessionId, itemIds, reason });

      if (session.status !== "reserved") {
        return {
          sessionId,
          status: session.status,
          releasedNow: 0,
          uploadedCount: session.uploadedCount,
          releasedCount: session.releasedCount,
        };
      }

      let releasedNow = 0;

      for (const item of state.items.values()) {
        if (item.uploadSessionId !== session.id) continue;
        if (item.status !== "reserved" && item.status !== "uploaded") continue;
        if (itemIds && itemIds.length > 0 && !itemIds.includes(item.id)) continue;

        item.status = reason.startsWith("cancel") ? "cancelled" : "failed";
        item.failureCode = reason;
        releasedNow += 1;
      }

      session.releasedCount += releasedNow;

      const remaining = [...state.items.values()].filter(
        (item) =>
          item.uploadSessionId === session.id &&
          (item.status === "reserved" || item.status === "uploaded"),
      );

      if (remaining.length === 0) {
        session.status =
          session.uploadedCount > 0
            ? "partially_completed"
            : reason.startsWith("cancel")
              ? "cancelled"
              : "partially_completed";
        session.closedAt = state.now.toISOString();
      }

      return {
        sessionId,
        status: session.status,
        releasedNow,
        uploadedCount: session.uploadedCount,
        releasedCount: session.releasedCount,
      };
    },

    async listPhotos(participantId, filters) {
      let rows = activePhotos().filter((photo) => photo.participantId === participantId);

      if (filters.day) {
        rows = rows.filter((photo) => photo.eventDay === filters.day);
      }

      rows.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
      const start = (filters.page - 1) * filters.limit;

      return {
        rows: rows.slice(start, start + filters.limit),
        total: rows.length,
      };
    },

    async findPhoto(id) {
      return state.photos.get(id) ?? null;
    },

    async softDeletePhoto(id) {
      const photo = state.photos.get(id);

      if (!photo) {
        throw new Error("PHOTO_NOT_FOUND");
      }

      photo.status = "deleted";
      photo.deletedAt = state.now.toISOString();
      return photo;
    },

    async getQuota() {
      return quotaOf();
    },
  };

  const storage: PhotoStorageService = {
    pathFor(location, mimeType) {
      return originalPathFor(location, mimeType);
    },

    async createUploadTarget(path) {
      if (state.failUploadTarget) {
        throw new Error("Storage no disponible.");
      }

      return {
        signedUrl: `https://upload.test/${path}`,
        token: "signed-token",
        expiresAt: new Date(state.now.getTime() + 900_000).toISOString(),
      };
    },

    async validateOriginal(_location, storagePath, declaredMimeType, maxBytes) {
      const object = state.objects.get(storagePath);

      if (!object) {
        state.objects.delete(storagePath);
        throw new AppError(
          422,
          ERROR_CODES.INVALID_FILE_TYPE,
          "El archivo no se ha subido o no se puede leer.",
        );
      }

      if (object.bytes.length > maxBytes) {
        state.objects.delete(storagePath);
        throw new AppError(
          413,
          ERROR_CODES.FILE_TOO_LARGE,
          "El archivo supera el tamaño máximo permitido.",
        );
      }

      if (object.mimeType !== declaredMimeType) {
        state.objects.delete(storagePath);
        throw new AppError(
          422,
          ERROR_CODES.INVALID_FILE_TYPE,
          "El contenido del archivo no coincide con el tipo declarado.",
        );
      }

      return {
        mimeType: object.mimeType,
        fileSize: object.bytes.length,
        width: object.width,
        height: object.height,
        contentHash: createHash("sha256").update(object.bytes).digest("hex"),
      } satisfies ValidatedOriginal;
    },

    async createSignedUrl(storagePath) {
      return `https://storage.test/${storagePath}`;
    },

    async downloadOriginal(storagePath) {
      const object = state.objects.get(storagePath);

      if (!object) {
        throw new Error("Objeto no encontrado.");
      }

      return object.bytes;
    },

    async removeObject(storagePath) {
      state.objects.delete(storagePath);
    },
  };

  const participantRepository: ParticipantRepository = {
    async findSessionByTokenHash(tokenHash) {
      return state.session.tokenHash === tokenHash ? state.session : null;
    },
    async findParticipantById(id) {
      return id === state.participant.id ? state.participant : null;
    },
    async findEventById(id) {
      return id === state.event.id ? state.event : null;
    },
    async touchSession() {
      return undefined;
    },
    async revokeSessionsForParticipant() {
      state.session.revokedAt = state.now.toISOString();
    },
    async getQuota() {
      return quotaOf();
    },
    async updateDisplayName(_participantId, displayName) {
      state.participant.displayName = displayName;
      return state.participant;
    },
  };

  return {
    state,
    repository,
    storage,
    participantRepository,
    seedObject(storagePath, objectOptions = {}) {
      const mimeType = objectOptions.mimeType ?? "image/jpeg";

      state.objects.set(storagePath, {
        bytes: objectOptions.bytes ?? Buffer.from(`${randomUUID()}-${storagePath}`, "utf8"),
        mimeType,
        width: objectOptions.width ?? 1600,
        height: objectOptions.height ?? 1200,
      });
    },
    addPhoto(overrides = {}) {
      const day = eventDay();
      const photo: PhotoRecord = {
        id: randomUUID(),
        eventId: state.event.id,
        participantId: state.participant.id,
        uploadItemId: null,
        storagePath: `events/${state.event.id}/originals/${day}/${state.participant.id}/${randomUUID()}.jpg`,
        originalFilename: "IMG_0001.jpg",
        mimeType: "image/jpeg",
        fileSize: 1024,
        width: 1600,
        height: 1200,
        contentHash: randomUUID().replace(/-/g, "").padEnd(64, "0").slice(0, 64),
        eventDay: day,
        uploadedAt: state.now.toISOString(),
        status: "active",
        deletedAt: null,
        deletedByAdminId: null,
        ...overrides,
      };

      state.photos.set(photo.id, photo);
      return photo;
    },
  };
}
