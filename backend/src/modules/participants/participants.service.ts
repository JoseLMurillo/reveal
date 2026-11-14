import type {
  Participant,
  ParticipantMe,
  ParticipantPermissions,
  Quota,
  UpdateParticipantInput,
} from "@rollo/shared";
import type { Env } from "../../config/env.js";
import { AppError, forbidden, conflict } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { hashToken } from "../../utils/token.js";
import { effectiveStatus, eventDayInTimezone, isWithinEventDates } from "../../utils/event-time.js";
import type { EventRecord } from "../admin/shared/types.js";
import type { ParticipantRecord, ParticipantSessionRecord } from "./types.js";
import type { ParticipantRepository } from "./participants.repository.js";

export type AuthenticatedParticipant = {
  participant: ParticipantRecord;
  session: ParticipantSessionRecord;
  event: EventRecord;
};

export type ParticipantService = {
  authenticate(token: string): Promise<AuthenticatedParticipant>;
  me(auth: AuthenticatedParticipant): Promise<ParticipantMe>;
  updateMe(auth: AuthenticatedParticipant, input: UpdateParticipantInput): Promise<ParticipantMe>;
  quota(auth: AuthenticatedParticipant): Promise<Quota>;
};

const LAST_USED_THROTTLE_MS = 60_000;

function expiredSession(): AppError {
  return new AppError(
    401,
    ERROR_CODES.PARTICIPANT_SESSION_EXPIRED,
    "Tu sesión expiró. Vuelve a abrir tu enlace personal.",
  );
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

export function createParticipantService(deps: {
  env: Env;
  repository: ParticipantRepository;
  now?: () => Date;
}): ParticipantService {
  const now = deps.now ?? (() => new Date());

  function permissionsOf(
    event: EventRecord,
    participant: ParticipantRecord,
  ): ParticipantPermissions {
    const current = now();
    const day = eventDayInTimezone(event.timezone, current);
    const canUpload = event.status === "active" && isWithinEventDates(event, day);

    return {
      canUpload,
      canDeletePhotos: event.allowPhotoDeletion && canUpload,
      canViewGallery: event.galleryVisibility !== "private",
      canChangeName:
        event.requireName && (participant.displayName === null || event.status === "active"),
    };
  }

  async function meOf(auth: AuthenticatedParticipant): Promise<ParticipantMe> {
    const quota = await deps.repository.getQuota(auth.participant.id);

    return {
      participant: participantOf(auth.participant),
      session: { expiresAt: auth.session.expiresAt },
      event: {
        id: auth.event.id,
        slug: auth.event.slug,
        name: auth.event.name,
        status: auth.event.status,
        effectiveStatus: effectiveStatus(auth.event, now()),
        timezone: auth.event.timezone,
        startDate: auth.event.startDate,
        endDate: auth.event.endDate,
        maxFileSizeBytes: auth.event.maxFileSizeBytes,
      },
      quota,
      permissions: permissionsOf(auth.event, auth.participant),
    };
  }

  return {
    async authenticate(token) {
      if (!token) {
        throw expiredSession();
      }

      const session = await deps.repository.findSessionByTokenHash(hashToken(token));

      if (!session || session.revokedAt !== null) {
        throw expiredSession();
      }

      const current = now();

      if (new Date(session.expiresAt).getTime() <= current.getTime()) {
        throw expiredSession();
      }

      const participant = await deps.repository.findParticipantById(session.participantId);

      if (!participant) {
        throw expiredSession();
      }

      if (!participant.isActive) {
        await deps.repository.revokeSessionsForParticipant(participant.id);
        throw forbidden(
          "Este participante está deshabilitado. Pide al organizador que reactive tu acceso.",
        );
      }

      const event = await deps.repository.findEventById(participant.eventId);

      if (!event) {
        throw expiredSession();
      }

      if (current.getTime() - new Date(session.lastUsedAt).getTime() >= LAST_USED_THROTTLE_MS) {
        await deps.repository.touchSession(session.id, current.toISOString());
      }

      return { participant, session, event };
    },

    async me(auth) {
      return meOf(auth);
    },

    async updateMe(auth, input) {
      if (!auth.event.requireName) {
        throw forbidden("Este evento no usa nombres.");
      }

      if (auth.participant.displayName !== null && auth.event.status !== "active") {
        throw conflict(
          ERROR_CODES.EVENT_NOT_ACTIVE,
          "Solo puedes cambiar tu nombre mientras el evento está activo.",
        );
      }

      const updated = await deps.repository.updateDisplayName(
        auth.participant.id,
        input.displayName,
      );

      return meOf({ ...auth, participant: updated });
    },

    async quota(auth) {
      return deps.repository.getQuota(auth.participant.id);
    },
  };
}
