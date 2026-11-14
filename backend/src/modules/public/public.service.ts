import type {
  Participant,
  ParticipantEvent,
  PublicEvent,
  PublicEventStatus,
  RedeemAccessCodeInput,
  RedeemAccessResponse,
  RegisterParticipantInput,
  RegisterParticipantResponse,
  RegistrationInfo,
} from "@rollo/shared";

import type { Env } from "../../config/env.js";
import { notFound } from "../../errors/app-error.js";
import { generateOpaqueToken, hashToken, tokenPrefix } from "../../utils/token.js";
import {
  dayNumberFor,
  effectiveStatus,
  eventDayInTimezone,
  isWithinEventDates,
  nextQuotaReset,
  totalDaysFor,
} from "../../utils/event-time.js";
import type { AuditRepository } from "../admin/shared/audit.repository.js";
import type { StorageService } from "../admin/shared/storage.service.js";
import type { EventRecord } from "../admin/shared/types.js";
import type { ParticipantRecord } from "../participants/types.js";
import type { PublicRepository } from "./public.repository.js";

export type PublicActionContext = {
  ipHash: string | null;
  userAgent: string | null;
};

export type PublicService = {
  event(slug: string): Promise<PublicEvent>;
  status(slug: string): Promise<PublicEventStatus>;
  redeem(
    slug: string,
    input: RedeemAccessCodeInput,
    context: PublicActionContext,
  ): Promise<RedeemAccessResponse>;
  register(
    slug: string,
    input: RegisterParticipantInput,
    context: PublicActionContext,
  ): Promise<RegisterParticipantResponse>;
};

const ACCESS_CODE_BYTES = 16;
const SESSION_TOKEN_BYTES = 32;

function notPublished(): ReturnType<typeof notFound> {
  return notFound("El evento no existe.");
}

function participantOf(record: ParticipantRecord): Participant {
  return {
    id: record.id,
    displayName: record.displayName,
    anonymous: record.displayName === null,
    registrationSource: record.registrationSource,
    createdAt: record.createdAt,
  };
}

export function createPublicService(deps: {
  env: Env;
  repository: PublicRepository;
  storage: StorageService;
  audit: AuditRepository;
  now?: () => Date;
}): PublicService {
  const now = deps.now ?? (() => new Date());

  function participantEventOf(event: EventRecord, current: Date): ParticipantEvent {
    return {
      id: event.id,
      slug: event.slug,
      name: event.name,
      status: event.status,
      effectiveStatus: effectiveStatus(event, current),
      timezone: event.timezone,
      startDate: event.startDate,
      endDate: event.endDate,
      maxFileSizeBytes: event.maxFileSizeBytes,
    };
  }

  function registrationOf(event: EventRecord, used: number, current: Date): RegistrationInfo {
    const limit = event.participantLimit;
    const remaining = limit === null ? null : Math.max(limit - used, 0);
    const day = eventDayInTimezone(event.timezone, current);
    const withinDates = isWithinEventDates(event, day);

    let reason: RegistrationInfo["reason"] = null;

    if (!event.allowSelfRegistration) {
      reason = "disabled";
    } else if (event.status !== "active") {
      reason = "event_not_active";
    } else if (!withinDates) {
      reason = "event_out_of_dates";
    } else if (limit !== null && remaining === 0) {
      reason = "limit_reached";
    }

    const open =
      event.allowSelfRegistration &&
      event.status === "active" &&
      withinDates &&
      limit !== null &&
      (remaining ?? 0) > 0;

    return {
      enabled: event.allowSelfRegistration,
      open,
      limit,
      used,
      remaining,
      reason,
    };
  }

  async function loadEvent(slug: string): Promise<EventRecord> {
    const event = await deps.repository.findEventBySlug(slug);

    if (!event || event.status === "draft" || event.status === "cancelled") {
      throw notPublished();
    }

    return event;
  }

  async function accessUrl(slug: string, code: string): Promise<string> {
    return `${deps.env.FRONTEND_URL}/e/${slug}/a/${code}`;
  }

  return {
    async event(slug) {
      const current = now();
      const event = await loadEvent(slug);

      const [used, coverUrl, albumSlug] = await Promise.all([
        deps.repository.countParticipants(event.id),
        event.coverImagePath
          ? deps.storage.createSignedUrl(event.coverImagePath)
          : Promise.resolve(null),
        deps.repository.getPublicAlbumSlug(event.id),
      ]);

      const day = eventDayInTimezone(event.timezone, current);
      const registration = registrationOf(event, used, current);

      return {
        slug: event.slug,
        name: event.name,
        description: event.description,
        coverUrl,
        startDate: event.startDate,
        endDate: event.endDate,
        timezone: event.timezone,
        status: event.status,
        effectiveStatus: effectiveStatus(event, current),
        currentEventDay: day,
        dayNumber: dayNumberFor(event.startDate, day),
        totalDays: totalDaysFor(event.startDate, event.endDate),
        dailyPhotoLimit: event.dailyPhotoLimit,
        totalPhotoLimit: event.totalPhotoLimit,
        requireName: event.requireName,
        showParticipantNames: event.showParticipantNames,
        maxFileSizeBytes: event.maxFileSizeBytes,
        galleryVisibility: event.galleryVisibility,
        allowPhotoDeletion: event.allowPhotoDeletion,
        registration,
        canRegister: registration.open,
        quotaResetsAt: nextQuotaReset(event.timezone, current).toISOString(),
        publicAlbumSlug: albumSlug,
      };
    },

    async status(slug) {
      const current = now();
      const event = await loadEvent(slug);
      const used = await deps.repository.countParticipants(event.id);
      const day = eventDayInTimezone(event.timezone, current);
      const registration = registrationOf(event, used, current);

      return {
        status: event.status,
        effectiveStatus: effectiveStatus(event, current),
        currentEventDay: day,
        dayNumber: dayNumberFor(event.startDate, day),
        canRegister: registration.open,
        canUpload: event.status === "active" && isWithinEventDates(event, day),
        registration,
        quotaResetsAt: nextQuotaReset(event.timezone, current).toISOString(),
      };
    },

    async redeem(slug, input, context) {
      const current = now();
      const event = await deps.repository.findEventBySlug(slug);

      if (!event) {
        throw notPublished();
      }

      const sessionToken = generateOpaqueToken(SESSION_TOKEN_BYTES);

      const result = await deps.repository.redeem({
        eventId: event.id,
        accessCodeHash: hashToken(input.accessCode),
        sessionTokenHash: hashToken(sessionToken),
        displayName: input.displayName,
        sessionTtlSeconds: deps.env.PARTICIPANT_SESSION_TTL_SECONDS,
      });

      const participant = await deps.repository.findParticipantById(result.participantId);

      if (!participant) {
        throw notPublished();
      }

      const quota = await deps.repository.getQuota(participant.id);

      await deps.audit.record({
        adminId: null,
        eventId: event.id,
        action: "participant.redeemed",
        entityType: "participant",
        entityId: participant.id,
        metadata: { source: participant.registrationSource },
        ipHash: context.ipHash,
      });

      return {
        participant: participantOf(participant),
        session: {
          token: sessionToken,
          expiresAt: result.sessionExpiresAt,
        },
        event: participantEventOf(event, current),
        quota,
      };
    },

    async register(slug, input, context) {
      const current = now();
      const event = await deps.repository.findEventBySlug(slug);

      if (!event || event.status === "draft" || event.status === "cancelled") {
        throw notPublished();
      }

      const accessCode = generateOpaqueToken(ACCESS_CODE_BYTES);
      const sessionToken = generateOpaqueToken(SESSION_TOKEN_BYTES);

      const result = await deps.repository.register({
        eventId: event.id,
        displayName: input.displayName,
        accessCodeHash: hashToken(accessCode),
        accessCodePrefix: tokenPrefix(accessCode, 6),
        sessionTokenHash: hashToken(sessionToken),
        sessionTtlSeconds: deps.env.PARTICIPANT_SESSION_TTL_SECONDS,
      });

      const participant = await deps.repository.findParticipantById(result.participantId);

      if (!participant) {
        throw notPublished();
      }

      const [quota, used] = await Promise.all([
        deps.repository.getQuota(participant.id),
        deps.repository.countParticipants(event.id),
      ]);

      await deps.audit.record({
        adminId: null,
        eventId: event.id,
        action: "participant.registered",
        entityType: "participant",
        entityId: participant.id,
        metadata: { source: "self" },
        ipHash: context.ipHash,
      });

      return {
        participant: participantOf(participant),
        access: {
          code: accessCode,
          url: await accessUrl(event.slug, accessCode),
          createdAt: result.createdAt,
        },
        session: {
          token: sessionToken,
          expiresAt: result.sessionExpiresAt,
        },
        registration: {
          limit: event.participantLimit,
          used,
          remaining:
            event.participantLimit === null ? null : Math.max(event.participantLimit - used, 0),
        },
        event: participantEventOf(event, current),
        quota,
      };
    },
  };
}
