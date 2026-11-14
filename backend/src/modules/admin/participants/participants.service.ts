import type {
  AccessCodeActionInput,
  AdminAccessCodeRevokeResult,
  AdminAccessCodeRotateResult,
  AdminCreateParticipantInput,
  AdminCreatedParticipant,
  AdminParticipant,
  AdminParticipantBulkResult,
  AdminParticipantCreateResult,
  AdminParticipantListQuery,
  AdminUpdateParticipantInput,
  AdminBulkCreateParticipantsInput,
  RegistrationCount,
} from "@rollo/shared";

import type { Env } from "../../../config/env.js";
import { internalError, notFound } from "../../../errors/app-error.js";
import { eventDayInTimezone } from "../../../utils/event-time.js";
import { generateOpaqueToken, hashToken, tokenPrefix } from "../../../utils/token.js";
import type {
  CreatedParticipantRow,
  ParticipantRecord,
  ParticipantPhotoStats,
} from "../../participants/types.js";
import type { AuditRepository } from "../shared/audit.repository.js";
import { assertEventAccess } from "../shared/access.js";
import type { AdminRecord, EventRecord } from "../shared/types.js";
import type { EventRepository } from "../events/events.repository.js";
import type {
  AdminParticipantsRepository,
  NewParticipantEntry,
} from "./participants.repository.js";

const ACCESS_CODE_BYTES = 16;
const ACCESS_CODE_PREFIX_LENGTH = 6;

const EMPTY_PHOTO_STATS: ParticipantPhotoStats = {
  photosTotal: 0,
  photosToday: 0,
  reservedToday: 0,
};

export type AdminParticipantPage = {
  rows: AdminParticipant[];
  total: number;
};

export type AdminParticipantsService = {
  list(
    admin: AdminRecord,
    eventId: string,
    query: AdminParticipantListQuery,
  ): Promise<AdminParticipantPage>;
  create(
    admin: AdminRecord,
    eventId: string,
    input: AdminCreateParticipantInput,
  ): Promise<AdminParticipantCreateResult>;
  bulkCreate(
    admin: AdminRecord,
    eventId: string,
    input: AdminBulkCreateParticipantsInput,
  ): Promise<AdminParticipantBulkResult>;
  update(
    admin: AdminRecord,
    participantId: string,
    input: AdminUpdateParticipantInput,
  ): Promise<AdminParticipant>;
  regenerateAccessCode(
    admin: AdminRecord,
    participantId: string,
    input: AccessCodeActionInput,
  ): Promise<AdminAccessCodeRotateResult>;
  revokeAccessCode(
    admin: AdminRecord,
    participantId: string,
    input: AccessCodeActionInput,
  ): Promise<AdminAccessCodeRevokeResult>;
};

function registrationOf(event: EventRecord, used: number): RegistrationCount {
  const limit = event.participantLimit;

  return {
    limit,
    used,
    remaining: limit === null ? null : Math.max(limit - used, 0),
  };
}

function createdParticipantOf(record: CreatedParticipantRow): AdminCreatedParticipant {
  return {
    id: record.id,
    displayName: record.displayName,
    anonymous: record.displayName === null,
    note: record.note,
    registrationSource: record.registrationSource,
    accessCodePrefix: record.accessCodePrefix,
    isActive: record.isActive,
    createdAt: record.createdAt,
    lastSeenAt: record.lastSeenAt,
  };
}

function accessCodeStatusOf(record: ParticipantRecord): AdminParticipant["accessCodeStatus"] {
  if (record.accessCodeRevokedAt !== null) {
    return "revoked";
  }

  return record.accessCodeHash ? "active" : "none";
}

function newEntry(input: AdminCreateParticipantInput): {
  entry: NewParticipantEntry;
  code: string;
} {
  const code = generateOpaqueToken(ACCESS_CODE_BYTES);

  return {
    code,
    entry: {
      displayName: input.displayName ?? null,
      note: input.note ?? null,
      accessCodeHash: hashToken(code),
      accessCodePrefix: tokenPrefix(code, ACCESS_CODE_PREFIX_LENGTH),
    },
  };
}

export function createAdminParticipantsService(deps: {
  env: Env;
  events: EventRepository;
  participants: AdminParticipantsRepository;
  audit: AuditRepository;
  now?: () => Date;
}): AdminParticipantsService {
  const now = deps.now ?? (() => new Date());

  function accessUrl(slug: string, code: string): string {
    return `${deps.env.FRONTEND_URL}/e/${slug}/a/${code}`;
  }

  async function loadEvent(admin: AdminRecord, eventId: string): Promise<EventRecord> {
    const event = await deps.events.findById(eventId);

    if (!event) {
      throw notFound("El evento no existe.");
    }

    assertEventAccess(admin, event);
    return event;
  }

  async function loadParticipant(
    admin: AdminRecord,
    participantId: string,
  ): Promise<{ participant: ParticipantRecord; event: EventRecord }> {
    const participant = await deps.participants.findById(participantId);

    if (!participant) {
      throw notFound("El participante no existe.");
    }

    const event = await loadEvent(admin, participant.eventId);
    return { participant, event };
  }

  function toAdminParticipant(
    event: EventRecord,
    record: ParticipantRecord,
    stats: ParticipantPhotoStats,
  ): AdminParticipant {
    return {
      ...createdParticipantOf(record),
      accessCodeStatus: accessCodeStatusOf(record),
      photosTotal: stats.photosTotal,
      photosToday: stats.photosToday,
      remainingToday: Math.max(event.dailyPhotoLimit - stats.photosToday - stats.reservedToday, 0),
    };
  }

  async function photoStatsFor(event: EventRecord, participantIds: string[]) {
    return deps.participants.stats(participantIds, eventDayInTimezone(event.timezone, now()));
  }

  return {
    async list(admin, eventId, query) {
      const event = await loadEvent(admin, eventId);
      const result = await deps.participants.list(event.id, query);
      const stats = await photoStatsFor(
        event,
        result.rows.map((row) => row.id),
      );

      return {
        rows: result.rows.map((row) =>
          toAdminParticipant(event, row, stats.get(row.id) ?? EMPTY_PHOTO_STATS),
        ),
        total: result.total,
      };
    },

    async create(admin, eventId, input) {
      const event = await loadEvent(admin, eventId);
      const { entry, code } = newEntry(input);
      const result = await deps.participants.create(event.id, [entry], admin.id);
      const created = result.participants[0];

      if (!created) {
        throw internalError(new Error("La RPC no devolvió el participante creado."));
      }

      const used = await deps.participants.countParticipants(event.id);

      await deps.audit.record({
        adminId: admin.id,
        eventId: event.id,
        action: "participant.created",
        entityType: "participant",
        entityId: created.id,
        metadata: { source: "admin", count: 1 },
      });

      return {
        participant: createdParticipantOf(created),
        access: {
          code,
          url: accessUrl(event.slug, code),
          createdAt: created.accessCodeCreatedAt,
        },
        registration: registrationOf(event, used),
      };
    },

    async bulkCreate(admin, eventId, input) {
      const event = await loadEvent(admin, eventId);
      const entries = input.participants.map((participant) => newEntry(participant));
      const result = await deps.participants.create(
        event.id,
        entries.map((item) => item.entry),
        admin.id,
      );

      if (result.participants.length !== entries.length) {
        throw internalError(new Error("La RPC devolvió un número inesperado de participantes."));
      }

      const used = await deps.participants.countParticipants(event.id);

      await deps.audit.record({
        adminId: admin.id,
        eventId: event.id,
        action: "participant.bulk_created",
        entityType: "event",
        entityId: event.id,
        metadata: { source: "admin", count: result.participants.length },
      });

      return {
        created: result.participants.map((participant, index) => {
          const code = entries[index]?.code ?? "";

          return {
            participant: createdParticipantOf(participant),
            access: {
              code,
              url: accessUrl(event.slug, code),
              createdAt: participant.accessCodeCreatedAt,
            },
            registration: registrationOf(event, used),
          };
        }),
        registration: registrationOf(event, used),
      };
    },

    async update(admin, participantId, input) {
      const { participant, event } = await loadParticipant(admin, participantId);

      const profileChanges: { displayName?: string | null; note?: string | null } = {};

      if (input.displayName !== undefined) {
        profileChanges.displayName = input.displayName;
      }

      if (input.note !== undefined) {
        profileChanges.note = input.note;
      }

      let updated = participant;

      if (profileChanges.displayName !== undefined || profileChanges.note !== undefined) {
        updated = await deps.participants.updateProfile(participant.id, profileChanges);
      }

      if (input.isActive !== undefined && input.isActive !== participant.isActive) {
        await deps.participants.setActive(participant.id, input.isActive);
        updated = { ...updated, isActive: input.isActive };
      }

      const stats = await photoStatsFor(event, [participant.id]);

      await deps.audit.record({
        adminId: admin.id,
        eventId: event.id,
        action: "participant.updated",
        entityType: "participant",
        entityId: participant.id,
        metadata: { fields: Object.keys(input) },
      });

      return toAdminParticipant(event, updated, stats.get(participant.id) ?? EMPTY_PHOTO_STATS);
    },

    async regenerateAccessCode(admin, participantId, input) {
      const { participant, event } = await loadParticipant(admin, participantId);
      const code = generateOpaqueToken(ACCESS_CODE_BYTES);

      const result = await deps.participants.rotateAccessCode(
        participant.id,
        hashToken(code),
        tokenPrefix(code, ACCESS_CODE_PREFIX_LENGTH),
        input.revokeSessions,
      );

      await deps.audit.record({
        adminId: admin.id,
        eventId: event.id,
        action: "participant.access_code.regenerated",
        entityType: "participant",
        entityId: participant.id,
        metadata: { sessionsRevoked: input.revokeSessions },
      });

      return {
        participantId: participant.id,
        access: {
          code,
          url: accessUrl(event.slug, code),
          createdAt: result.accessCodeCreatedAt,
        },
        sessionsRevoked: input.revokeSessions,
      };
    },

    async revokeAccessCode(admin, participantId, input) {
      const { participant, event } = await loadParticipant(admin, participantId);

      await deps.participants.revokeAccessCode(participant.id, input.revokeSessions);

      await deps.audit.record({
        adminId: admin.id,
        eventId: event.id,
        action: "participant.access_code.revoked",
        entityType: "participant",
        entityId: participant.id,
        metadata: { sessionsRevoked: input.revokeSessions },
      });

      return {
        participantId: participant.id,
        accessCodeStatus: "revoked",
        sessionsRevoked: input.revokeSessions,
      };
    },
  };
}
