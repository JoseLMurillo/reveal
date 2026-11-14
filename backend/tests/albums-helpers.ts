import { randomUUID } from "node:crypto";

import type { EventRecord } from "../src/modules/admin/shared/types.js";
import { createAdminServices, type AdminServices } from "../src/modules/admin/index.js";
import {
  createAdminParticipantsRepository,
  createAdminPhotosRepository,
  createAdminRepository,
  createAlbumRepository,
  createAuditRepository,
  createEventRepository,
  createSessionRepository,
  createState,
  createStatsRepository,
  createStorageService,
  createPhotoStorageService,
  seedAdmin,
} from "./admin-helpers.js";
import type { InMemoryState } from "./admin-helpers.js";
import type { ParticipantRepository } from "../src/modules/participants/participants.repository.js";
import {
  createParticipantService,
  type ParticipantService,
} from "../src/modules/participants/participants.service.js";
import type {
  ParticipantRecord,
  ParticipantSessionRecord,
  QuotaRecord,
} from "../src/modules/participants/types.js";
import {
  createAlbumsPublicService,
  type AlbumsPublicService,
} from "../src/modules/albums/albums.service.js";
import type { PhotoRecord } from "../src/modules/photos/types.js";
import { dayNumberFor, eventDayInTimezone, nextQuotaReset } from "../src/utils/event-time.js";
import { hashToken } from "../src/utils/token.js";
import { testEnv } from "./fixtures.js";

export const TOKEN_ANA = "a".repeat(64);
export const TOKEN_BETO = "b".repeat(64);
export const TOKEN_EXTRA = "c".repeat(64);

export type AlbumHarness = {
  state: InMemoryState;
  event: EventRecord;
  ana: ParticipantRecord;
  beto: ParticipantRecord;
  extra: ParticipantRecord;
  sessions: Map<string, ParticipantSessionRecord>;
  participantRepository: ParticipantRepository;
  participants: ParticipantService;
  albums: AlbumsPublicService;
  admin: AdminServices;
  addPhoto: (options?: {
    participant?: ParticipantRecord;
    day?: string;
    filename?: string;
    status?: PhotoRecord["status"];
    bytes?: Buffer;
  }) => PhotoRecord;
};

export async function createAlbumHarness(): Promise<AlbumHarness> {
  const state = createState();
  const admin = await seedAdmin(state, {
    email: "admin@rollo.test",
    password: "correct horse battery staple",
  });

  const day = eventDayInTimezone("America/Mexico_City", new Date());
  const shift = (days: number): string => {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const event: EventRecord = {
    id: randomUUID(),
    adminId: admin.id,
    slug: "cumple-de-ana",
    name: "Cumpleaños de Ana",
    description: "Una tarde para revelar recuerdos.",
    coverImagePath: null,
    startDate: shift(-1),
    endDate: shift(2),
    timezone: "America/Mexico_City",
    dailyPhotoLimit: 10,
    totalPhotoLimit: 40,
    requireName: true,
    showParticipantNames: true,
    allowSelfRegistration: true,
    participantLimit: 20,
    maxFileSizeBytes: 10_485_760,
    galleryVisibility: "participants",
    allowPhotoDeletion: false,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.events.set(event.id, event);

  function participant(displayName: string | null): ParticipantRecord {
    return {
      id: randomUUID(),
      eventId: event.id,
      displayName,
      note: null,
      registrationSource: "admin",
      accessCodeHash: hashToken(`access-${displayName ?? "anon"}-${randomUUID()}`),
      accessCodePrefix: "abc123",
      accessCodeCreatedAt: new Date().toISOString(),
      accessCodeRevokedAt: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };
  }

  const ana = participant("Ana");
  const beto = participant("Beto");
  const extra = participant(null);

  for (const record of [ana, beto, extra]) {
    state.participants.set(record.id, record);
  }

  const sessions = new Map<string, ParticipantSessionRecord>();

  function sessionFor(record: ParticipantRecord, token: string): void {
    sessions.set(token, {
      id: randomUUID(),
      participantId: record.id,
      tokenHash: hashToken(token),
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      lastUsedAt: new Date(Date.now() - 60_000).toISOString(),
      revokedAt: null,
    });
  }

  sessionFor(ana, TOKEN_ANA);
  sessionFor(beto, TOKEN_BETO);
  sessionFor(extra, TOKEN_EXTRA);

  function quotaFor(participantId: string): QuotaRecord {
    const currentDay = eventDayInTimezone(event.timezone, new Date());
    const photos = [...state.photos.values()].filter(
      (photo) => photo.participantId === participantId && photo.status === "active",
    );
    const usedDay = photos.filter((photo) => photo.eventDay === currentDay).length;
    const usedTotal = photos.length;

    return {
      eventDay: currentDay,
      dayNumber: dayNumberFor(event.startDate, currentDay),
      dailyLimit: event.dailyPhotoLimit,
      totalLimit: event.totalPhotoLimit,
      usedDay,
      usedTotal,
      reservedDay: 0,
      reservedTotal: 0,
      remainingDay: Math.max(event.dailyPhotoLimit - usedDay, 0),
      remainingTotal:
        event.totalPhotoLimit === null ? null : Math.max(event.totalPhotoLimit - usedTotal, 0),
      resetsAt: nextQuotaReset(event.timezone, new Date()).toISOString(),
      eventStatus: event.status,
    };
  }

  const participantRepository: ParticipantRepository = {
    async findSessionByTokenHash(tokenHash) {
      return [...sessions.values()].find((session) => session.tokenHash === tokenHash) ?? null;
    },
    async findParticipantById(id) {
      return state.participants.get(id) ?? null;
    },
    async findEventById(id) {
      return state.events.get(id) ?? null;
    },
    async touchSession() {
      return undefined;
    },
    async revokeSessionsForParticipant(participantId) {
      for (const session of sessions.values()) {
        if (session.participantId === participantId) {
          session.revokedAt = new Date().toISOString();
        }
      }
    },
    async getQuota(participantId) {
      return quotaFor(participantId);
    },
    async updateDisplayName(participantId, displayName) {
      const record = state.participants.get(participantId);

      if (!record) {
        throw new Error("PARTICIPANT_NOT_FOUND");
      }

      record.displayName = displayName;
      return record;
    },
  };

  const participants = createParticipantService({
    env: testEnv,
    repository: participantRepository,
  });

  const albumRepository = createAlbumRepository(state);
  const photoStorage = createPhotoStorageService(state);

  const albums = createAlbumsPublicService({
    repository: albumRepository,
    storage: photoStorage,
  });

  const adminServices = createAdminServices(testEnv, null, {
    adminRepository: createAdminRepository(state),
    sessionRepository: createSessionRepository(state),
    auditRepository: createAuditRepository(state),
    eventRepository: createEventRepository(state),
    participantRepository: createAdminParticipantsRepository(state),
    photoRepository: createAdminPhotosRepository(state),
    albumRepository,
    statsRepository: createStatsRepository(state),
    storageService: createStorageService(state),
    photoStorageService: photoStorage,
  });

  function addPhoto(
    options: {
      participant?: ParticipantRecord;
      day?: string;
      filename?: string;
      status?: PhotoRecord["status"];
      bytes?: Buffer;
    } = {},
  ): PhotoRecord {
    const owner = options.participant ?? ana;
    const eventDay = options.day ?? day;
    const id = randomUUID();
    const storagePath = `events/${event.id}/originals/${eventDay}/${owner.id}/${id}.jpg`;
    const photo: PhotoRecord = {
      id,
      eventId: event.id,
      participantId: owner.id,
      uploadItemId: null,
      storagePath,
      originalFilename: options.filename ?? `IMG_${id.slice(0, 4)}.jpg`,
      mimeType: "image/jpeg",
      fileSize: (options.bytes ?? Buffer.from(id)).length,
      width: 1600,
      height: 1200,
      contentHash: id.replace(/-/g, "").padEnd(64, "0").slice(0, 64),
      eventDay,
      uploadedAt: new Date().toISOString(),
      status: options.status ?? "active",
      deletedAt: options.status === "deleted" ? new Date().toISOString() : null,
      deletedByAdminId: null,
    };

    state.photos.set(photo.id, photo);
    state.photoObjects.set(storagePath, options.bytes ?? Buffer.from(`foto-${id}`));
    return photo;
  }

  return {
    state,
    event,
    ana,
    beto,
    extra,
    sessions,
    participantRepository,
    participants,
    albums,
    admin: adminServices,
    addPhoto,
  };
}
