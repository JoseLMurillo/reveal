import type {
  AdminEventCreateResult,
  AdminEventDetail,
  AdminEventListQuery,
  AdminEventSummary,
  CancelEventInput,
  CoverUploadIntentInput,
  CreateEventInput,
  QrQuery,
  UpdateEventInput,
} from "@rollo/shared";
import QRCode from "qrcode";

import type { Env } from "../../../config/env.js";
import { conflict, notFound } from "../../../errors/app-error.js";
import { ERROR_CODES } from "../../../errors/error-codes.js";
import type { AuditRepository } from "../shared/audit.repository.js";
import { assertEventAccess } from "../shared/access.js";
import { generateUniqueSlug } from "../shared/slug.js";
import type { StorageService } from "../shared/storage.service.js";
import type { EventRepository } from "./events.repository.js";
import type { StatsRepository } from "../shared/stats.repository.js";
import type { AdminRecord, EventCreateValues, EventRecord, EventStats } from "../shared/types.js";

export type EventListPage = {
  rows: AdminEventSummary[];
  total: number;
};

export type QrResult = {
  filename: string;
  contentType: string;
  body: Buffer | string;
};

export type EventsService = {
  list(admin: AdminRecord, query: AdminEventListQuery): Promise<EventListPage>;
  detail(admin: AdminRecord, id: string): Promise<AdminEventDetail>;
  create(admin: AdminRecord, input: CreateEventInput): Promise<AdminEventCreateResult>;
  update(admin: AdminRecord, id: string, input: UpdateEventInput): Promise<AdminEventDetail>;
  schedule(admin: AdminRecord, id: string): Promise<AdminEventDetail>;
  activate(admin: AdminRecord, id: string): Promise<AdminEventDetail>;
  finish(admin: AdminRecord, id: string): Promise<AdminEventDetail>;
  cancel(admin: AdminRecord, id: string, input: CancelEventInput): Promise<AdminEventDetail>;
  duplicate(admin: AdminRecord, id: string): Promise<AdminEventCreateResult>;
  remove(admin: AdminRecord, id: string, confirmName: string): Promise<{ cleanupQueued: boolean }>;
  coverIntent(
    admin: AdminRecord,
    id: string,
    input: CoverUploadIntentInput,
  ): Promise<{ storagePath: string; signedUrl: string; token: string; expiresAt: string }>;
  confirmCover(
    admin: AdminRecord,
    id: string,
    storagePath: string,
  ): Promise<{ coverUrl: string | null; coverImagePath: string }>;
  deleteCover(admin: AdminRecord, id: string): Promise<void>;
  qr(admin: AdminRecord, id: string, query: QrQuery): Promise<QrResult>;
};

const EMPTY_STATS: EventStats = {
  participants: 0,
  photos: 0,
  photosToday: 0,
  quotaConsumedToday: 0,
};

function dateInTimezone(timezone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const value = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function createValues(input: CreateEventInput | EventRecord): EventCreateValues {
  return {
    name: input.name,
    description: input.description ?? undefined,
    startDate: input.startDate,
    endDate: input.endDate,
    timezone: input.timezone,
    dailyPhotoLimit: input.dailyPhotoLimit,
    totalPhotoLimit: input.totalPhotoLimit ?? null,
    requireName: input.requireName,
    showParticipantNames: input.showParticipantNames,
    allowSelfRegistration: input.allowSelfRegistration,
    participantLimit: input.participantLimit ?? null,
    maxFileSizeBytes: input.maxFileSizeBytes,
    galleryVisibility: input.galleryVisibility,
    allowPhotoDeletion: input.allowPhotoDeletion,
  };
}

export function createEventsService(deps: {
  env: Env;
  events: EventRepository;
  stats: StatsRepository;
  audit: AuditRepository;
  storage: StorageService;
  logger?: { warn: (obj: Record<string, unknown>, message: string) => void };
  now?: () => Date;
}): EventsService {
  const now = deps.now ?? (() => new Date());

  async function loadAccessible(admin: AdminRecord, id: string): Promise<EventRecord> {
    const event = await deps.events.findById(id);

    if (!event) {
      throw notFound("El evento no existe.");
    }

    assertEventAccess(admin, event);
    return event;
  }

  async function statsFor(eventId: string): Promise<EventStats> {
    const stats = await deps.stats.getEventStats([eventId]);
    return stats.get(eventId) ?? EMPTY_STATS;
  }

  async function toSummary(event: EventRecord, stats: EventStats): Promise<AdminEventSummary> {
    return {
      id: event.id,
      slug: event.slug,
      name: event.name,
      description: event.description,
      coverUrl: event.coverImagePath
        ? await deps.storage.createSignedUrl(event.coverImagePath)
        : null,
      startDate: event.startDate,
      endDate: event.endDate,
      timezone: event.timezone,
      status: event.status,
      dailyPhotoLimit: event.dailyPhotoLimit,
      totalPhotoLimit: event.totalPhotoLimit,
      galleryVisibility: event.galleryVisibility,
      participants: stats.participants,
      photos: stats.photos,
      photosToday: stats.photosToday,
      quotaConsumedToday: stats.quotaConsumedToday,
      remainingSlots:
        event.participantLimit === null
          ? null
          : Math.max(0, event.participantLimit - stats.participants),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  async function detailOf(event: EventRecord): Promise<AdminEventDetail> {
    const [stats, album] = await Promise.all([statsFor(event.id), deps.events.getAlbum(event.id)]);

    return {
      id: event.id,
      slug: event.slug,
      name: event.name,
      description: event.description,
      coverUrl: event.coverImagePath
        ? await deps.storage.createSignedUrl(event.coverImagePath)
        : null,
      startDate: event.startDate,
      endDate: event.endDate,
      timezone: event.timezone,
      dailyPhotoLimit: event.dailyPhotoLimit,
      totalPhotoLimit: event.totalPhotoLimit,
      requireName: event.requireName,
      showParticipantNames: event.showParticipantNames,
      allowSelfRegistration: event.allowSelfRegistration,
      participantLimit: event.participantLimit,
      maxFileSizeBytes: event.maxFileSizeBytes,
      galleryVisibility: event.galleryVisibility,
      allowPhotoDeletion: event.allowPhotoDeletion,
      status: event.status,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      counts: {
        participants: stats.participants,
        participantLimit: event.participantLimit,
        remainingSlots:
          event.participantLimit === null
            ? null
            : Math.max(0, event.participantLimit - stats.participants),
        photos: stats.photos,
        photosToday: stats.photosToday,
      },
      album: album
        ? {
            id: album.id,
            slug: album.slug,
            status: album.status,
            visibility: album.visibility,
          }
        : null,
    };
  }

  async function auditAction(
    admin: AdminRecord,
    action: string,
    event: EventRecord | null,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await deps.audit.record({
      adminId: admin.id,
      eventId: event?.id ?? null,
      action,
      entityType: "event",
      entityId: event?.id ?? null,
      metadata,
    });
  }

  function assertActiveTransitionTarget(event: EventRecord): void {
    if (event.status === "active") {
      return;
    }

    if (event.status === "cancelled") {
      throw conflict(ERROR_CODES.EVENT_NOT_ACTIVE, "Un evento cancelado no puede reactivarse.");
    }
  }

  return {
    async list(admin, query) {
      const result = await deps.events.list(admin, {
        page: query.page,
        limit: query.limit,
        status: query.status,
        search: query.search,
        from: query.from,
        to: query.to,
      });

      const ids = result.rows.map((event) => event.id);
      const stats = await deps.stats.getEventStats(ids);

      const rows = await Promise.all(
        result.rows.map((event) => toSummary(event, stats.get(event.id) ?? EMPTY_STATS)),
      );

      return { rows, total: result.total };
    },

    async detail(admin, id) {
      return detailOf(await loadAccessible(admin, id));
    },

    async create(admin, input) {
      const slug = await generateUniqueSlug(input.name, (candidate) =>
        deps.events.slugExists(candidate),
      );

      const event = await deps.events.create(admin.id, createValues(input), slug);
      await auditAction(admin, "event.created", event, { name: event.name });

      return {
        id: event.id,
        slug: event.slug,
        status: event.status,
        publicPath: `/e/${event.slug}`,
        createdAt: event.createdAt,
      };
    },

    async update(admin, id, input) {
      const event = await loadAccessible(admin, id);

      const nextStart = input.startDate ?? event.startDate;
      const nextEnd = input.endDate ?? event.endDate;

      if (nextEnd < nextStart) {
        throw conflict(
          ERROR_CODES.CONFLICT,
          "La fecha de fin no puede ser anterior a la de inicio.",
        );
      }

      if (input.timezone !== undefined && input.timezone !== event.timezone) {
        const activity = await deps.events.hasActivity(event.id);

        if (activity) {
          throw conflict(
            ERROR_CODES.CONFLICT,
            "No se puede cambiar la zona horaria cuando el evento ya tiene fotos o sesiones de carga.",
          );
        }
      }

      const nextParticipantLimit =
        input.participantLimit !== undefined ? input.participantLimit : event.participantLimit;

      if (input.participantLimit !== undefined && input.participantLimit !== null) {
        const participants = await deps.events.countParticipants(event.id);

        if (input.participantLimit < participants) {
          throw conflict(
            ERROR_CODES.CONFLICT,
            "El cupo no puede quedar por debajo del número actual de participantes.",
            { current: participants },
          );
        }
      }

      const nextSelfRegistration =
        input.allowSelfRegistration !== undefined
          ? input.allowSelfRegistration
          : event.allowSelfRegistration;

      if (nextSelfRegistration && nextParticipantLimit === null) {
        throw conflict(
          ERROR_CODES.CONFLICT,
          "El auto-registro exige un cupo máximo de participantes.",
        );
      }

      const updated = await deps.events.update(event.id, {
        name: input.name,
        description: input.description,
        startDate: input.startDate,
        endDate: input.endDate,
        timezone: input.timezone,
        dailyPhotoLimit: input.dailyPhotoLimit,
        totalPhotoLimit: input.totalPhotoLimit,
        requireName: input.requireName,
        showParticipantNames: input.showParticipantNames,
        allowSelfRegistration: input.allowSelfRegistration,
        participantLimit: input.participantLimit,
        maxFileSizeBytes: input.maxFileSizeBytes,
        galleryVisibility: input.galleryVisibility,
        allowPhotoDeletion: input.allowPhotoDeletion,
      });

      await auditAction(admin, "event.updated", updated, {
        fields: Object.keys(input),
      });

      return detailOf(updated);
    },

    async schedule(admin, id) {
      const event = await loadAccessible(admin, id);

      if (event.status === "scheduled") {
        return detailOf(event);
      }

      if (event.status !== "draft") {
        throw conflict(
          ERROR_CODES.CONFLICT,
          "Solo un borrador puede programarse. Para reabrir un evento, actívalo de nuevo.",
        );
      }

      const today = dateInTimezone(event.timezone, now());

      if (event.endDate < today) {
        throw conflict(
          ERROR_CODES.EVENT_OUT_OF_DATES,
          "No se puede programar un evento cuyas fechas ya pasaron.",
        );
      }

      const updated = await deps.events.setStatus(event.id, "scheduled");
      await auditAction(admin, "event.scheduled", updated);
      return detailOf(updated);
    },

    async activate(admin, id) {
      const event = await loadAccessible(admin, id);
      assertActiveTransitionTarget(event);

      if (event.status === "active") {
        return detailOf(event);
      }

      const today = dateInTimezone(event.timezone, now());

      if (today < event.startDate || today > event.endDate) {
        throw conflict(
          ERROR_CODES.EVENT_OUT_OF_DATES,
          "Hoy está fuera del rango de fechas del evento.",
        );
      }

      const updated = await deps.events.setStatus(event.id, "active");
      await auditAction(admin, "event.activated", updated);
      return detailOf(updated);
    },

    async finish(admin, id) {
      const event = await loadAccessible(admin, id);

      if (event.status === "finished") {
        return detailOf(event);
      }

      if (event.status !== "active") {
        throw conflict(ERROR_CODES.EVENT_NOT_ACTIVE, "Solo un evento activo puede finalizarse.");
      }

      const updated = await deps.events.setStatus(event.id, "finished");
      await auditAction(admin, "event.finished", updated);
      return detailOf(updated);
    },

    async cancel(admin, id, input) {
      const event = await loadAccessible(admin, id);

      if (event.status === "cancelled") {
        return detailOf(event);
      }

      if (event.status === "finished") {
        throw conflict(
          ERROR_CODES.CONFLICT,
          "Un evento finalizado no puede cancelarse; su álbum ya forma parte del archivo.",
        );
      }

      const cancelledSessions = await deps.events.cancelActiveUploadSessions(event.id);
      const updated = await deps.events.setStatus(event.id, "cancelled");

      await auditAction(admin, "event.cancelled", updated, {
        reason: input.reason,
        cancelledSessions,
      });

      return detailOf(updated);
    },

    async duplicate(admin, id) {
      const event = await loadAccessible(admin, id);
      const slug = await generateUniqueSlug(event.name, (candidate) =>
        deps.events.slugExists(candidate),
      );

      const copy = await deps.events.create(admin.id, createValues(event), slug);

      await auditAction(admin, "event.duplicated", copy, {
        sourceEventId: event.id,
        sourceName: event.name,
      });

      return {
        id: copy.id,
        slug: copy.slug,
        status: copy.status,
        publicPath: `/e/${copy.slug}`,
        createdAt: copy.createdAt,
      };
    },

    async remove(admin, id, confirmName) {
      const event = await loadAccessible(admin, id);

      if (confirmName !== event.name) {
        throw conflict(
          ERROR_CODES.CONFLICT,
          "El nombre de confirmación no coincide exactamente con el nombre del evento.",
        );
      }

      const paths = await deps.events.listStoragePaths(event.id);

      if (paths.length > 0) {
        await deps.events.enqueueCleanup(paths, "event_deleted");
      }

      await deps.events.remove(event.id);

      await deps.audit.record({
        adminId: admin.id,
        eventId: null,
        action: "event.deleted",
        entityType: "event",
        entityId: event.id,
        metadata: {
          name: event.name,
          slug: event.slug,
          queuedObjects: paths.length,
        },
      });

      return { cleanupQueued: true };
    },

    async coverIntent(admin, id, input) {
      const event = await loadAccessible(admin, id);

      return deps.storage.createCoverUploadTarget(event.id, input.mimeType);
    },

    async confirmCover(admin, id, storagePath) {
      const event = await loadAccessible(admin, id);
      await deps.storage.validateCoverObject(event.id, storagePath);

      const previous = event.coverImagePath;
      const updated = await deps.events.setCover(event.id, storagePath);

      if (previous && previous !== storagePath) {
        await deps.events.enqueueCleanup([previous], "event_cover_replaced");
      }

      await auditAction(admin, "event.cover_updated", updated, { storagePath });

      return {
        coverImagePath: storagePath,
        coverUrl: await deps.storage.createSignedUrl(storagePath),
      };
    },

    async deleteCover(admin, id) {
      const event = await loadAccessible(admin, id);

      if (!event.coverImagePath) {
        return;
      }

      const previous = event.coverImagePath;
      const updated = await deps.events.setCover(event.id, null);
      await deps.events.enqueueCleanup([previous], "event_cover_removed");
      await auditAction(admin, "event.cover_removed", updated);
    },

    async qr(admin, id, query) {
      const event = await loadAccessible(admin, id);
      const target = `${deps.env.FRONTEND_URL}/e/${event.slug}`;

      const options = {
        errorCorrectionLevel: "M" as const,
        margin: 2,
        width: query.size,
      };

      if (query.format === "svg") {
        return {
          filename: `qr-${event.slug}.svg`,
          contentType: "image/svg+xml; charset=utf-8",
          body: await QRCode.toString(target, { ...options, type: "svg" }),
        };
      }

      return {
        filename: `qr-${event.slug}.png`,
        contentType: "image/png",
        body: await QRCode.toBuffer(target, { ...options, type: "png" }),
      };
    },
  };
}
