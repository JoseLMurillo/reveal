import { randomUUID } from "node:crypto";

import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import type { EventRecord } from "../src/modules/admin/shared/types.js";
import type { AuditRepository } from "../src/modules/admin/shared/audit.repository.js";
import type { StorageService } from "../src/modules/admin/shared/storage.service.js";
import { createApp } from "../src/app.js";
import { createParticipantService } from "../src/modules/participants/participants.service.js";
import type { ParticipantRepository } from "../src/modules/participants/participants.repository.js";
import type {
  ParticipantRecord,
  ParticipantSessionRecord,
  QuotaRecord,
} from "../src/modules/participants/types.js";
import { createPublicService } from "../src/modules/public/public.service.js";
import type { PublicRepository } from "../src/modules/public/public.repository.js";
import { AppError } from "../src/errors/app-error.js";
import { ERROR_CODES } from "../src/errors/error-codes.js";
import { dayNumberFor, eventDayInTimezone, nextQuotaReset } from "../src/utils/event-time.js";
import { hashToken } from "../src/utils/token.js";
import { testEnv } from "./fixtures.js";

type State = {
  now: Date;
  events: Map<string, EventRecord>;
  participants: Map<string, ParticipantRecord>;
  sessions: Map<string, ParticipantSessionRecord>;
};

const SLUG = "cumple-de-ana";
const ACCESS_CODE = "codigo-de-acceso-de-128-bits";
const PARTICIPANT_ID = "11111111-1111-4111-8111-111111111111";

function eventOf(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: randomUUID(),
    adminId: randomUUID(),
    slug: SLUG,
    name: "Cumpleaños de Ana",
    description: "Una tarde para recordar.",
    coverImagePath: null,
    startDate: "2026-11-14",
    endDate: "2026-11-17",
    timezone: "America/Mexico_City",
    dailyPhotoLimit: 10,
    totalPhotoLimit: 30,
    requireName: true,
    showParticipantNames: false,
    allowSelfRegistration: true,
    participantLimit: 2,
    maxFileSizeBytes: 10_485_760,
    galleryVisibility: "participants",
    allowPhotoDeletion: false,
    status: "active",
    createdAt: "2026-11-01T18:00:00.000Z",
    updatedAt: "2026-11-01T18:00:00.000Z",
    ...overrides,
  };
}

function participantOf(
  event: EventRecord,
  overrides: Partial<ParticipantRecord> = {},
): ParticipantRecord {
  return {
    id: randomUUID(),
    eventId: event.id,
    displayName: "Ana",
    note: null,
    registrationSource: "admin",
    accessCodeHash: hashToken(ACCESS_CODE),
    accessCodePrefix: ACCESS_CODE.slice(0, 6),
    accessCodeCreatedAt: "2026-11-14T18:00:00.000Z",
    accessCodeRevokedAt: null,
    isActive: true,
    createdAt: "2026-11-14T18:00:00.000Z",
    updatedAt: "2026-11-14T18:00:00.000Z",
    lastSeenAt: "2026-11-14T18:00:00.000Z",
    ...overrides,
  };
}

function quotaOf(state: State, participant: ParticipantRecord): QuotaRecord {
  const event = [...state.events.values()].find((item) => item.id === participant.eventId);

  if (!event) {
    throw new Error("missing event");
  }

  const day = eventDayInTimezone(event.timezone, state.now);

  return {
    eventDay: day,
    dayNumber: dayNumberFor(event.startDate, day),
    dailyLimit: event.dailyPhotoLimit,
    totalLimit: event.totalPhotoLimit,
    usedDay: 0,
    usedTotal: 0,
    reservedDay: 0,
    reservedTotal: 0,
    remainingDay: event.dailyPhotoLimit,
    remainingTotal: event.totalPhotoLimit,
    resetsAt: nextQuotaReset(event.timezone, state.now).toISOString(),
    eventStatus: event.status,
  };
}

function badAccessCode(): AppError {
  return new AppError(
    401,
    ERROR_CODES.ACCESS_CODE_INVALID,
    "El enlace de acceso no es válido o ya no está activo.",
  );
}

function createRepositories(state: State): {
  publicRepository: PublicRepository;
  participantRepository: ParticipantRepository;
} {
  function countParticipants(eventId: string): number {
    return [...state.participants.values()].filter((participant) => participant.eventId === eventId)
      .length;
  }

  function issueSession(
    participant: ParticipantRecord,
    tokenHash: string,
  ): ParticipantSessionRecord {
    const session: ParticipantSessionRecord = {
      id: randomUUID(),
      participantId: participant.id,
      tokenHash,
      createdAt: state.now.toISOString(),
      expiresAt: new Date(state.now.getTime() + 30 * 86_400_000).toISOString(),
      lastUsedAt: state.now.toISOString(),
      revokedAt: null,
    };

    state.sessions.set(session.id, session);
    return session;
  }

  const publicRepository: PublicRepository = {
    async findEventBySlug(slug) {
      return [...state.events.values()].find((event) => event.slug === slug) ?? null;
    },

    async findParticipantById(id) {
      return state.participants.get(id) ?? null;
    },

    async countParticipants(eventId) {
      return countParticipants(eventId);
    },

    async getPublicAlbumSlug() {
      return null;
    },

    async getQuota(participantId) {
      const participant = state.participants.get(participantId);

      if (!participant) {
        throw new Error("PARTICIPANT_NOT_FOUND");
      }

      return quotaOf(state, participant);
    },

    async redeem(input) {
      const event = [...state.events.values()].find((item) => item.id === input.eventId);
      const participant = [...state.participants.values()].find(
        (item) => item.eventId === input.eventId && item.accessCodeHash === input.accessCodeHash,
      );

      if (
        !event ||
        !participant ||
        participant.accessCodeRevokedAt !== null ||
        !participant.isActive
      ) {
        throw badAccessCode();
      }

      if (event.status === "draft" || event.status === "cancelled") {
        throw badAccessCode();
      }

      const name = input.displayName?.trim() || null;

      if (event.requireName && participant.displayName === null && name === null) {
        throw new AppError(
          400,
          ERROR_CODES.NAME_REQUIRED,
          "Escribe tu nombre para entrar a este evento.",
        );
      }

      if (name !== null && (participant.displayName === null || event.status === "active")) {
        participant.displayName = name;
      }

      participant.lastSeenAt = state.now.toISOString();
      const session = issueSession(participant, input.sessionTokenHash);

      return {
        participantId: participant.id,
        displayName: participant.displayName,
        eventId: event.id,
        eventDay: eventDayInTimezone(event.timezone, state.now),
        eventStatus: event.status,
        sessionExpiresAt: session.expiresAt,
      };
    },

    async register(input) {
      const event = [...state.events.values()].find((item) => item.id === input.eventId);

      if (!event) {
        throw new Error("EVENT_NOT_FOUND");
      }

      if (!event.allowSelfRegistration) {
        throw new AppError(
          403,
          ERROR_CODES.SELF_REGISTRATION_DISABLED,
          "Este evento no permite el auto-registro.",
        );
      }

      if (event.status !== "active") {
        throw new AppError(409, ERROR_CODES.EVENT_NOT_ACTIVE, "El evento no está activo.");
      }

      const day = eventDayInTimezone(event.timezone, state.now);

      if (day < event.startDate || day > event.endDate) {
        throw new AppError(
          409,
          ERROR_CODES.EVENT_OUT_OF_DATES,
          "El evento está fuera del rango de fechas permitido.",
        );
      }

      const used = countParticipants(event.id);

      if (event.participantLimit !== null && used >= event.participantLimit) {
        throw new AppError(
          409,
          ERROR_CODES.PARTICIPANT_LIMIT_REACHED,
          "El evento alcanzó el cupo máximo de participantes.",
        );
      }

      const name = input.displayName?.trim() || null;

      if (event.requireName && name === null) {
        throw new AppError(
          400,
          ERROR_CODES.NAME_REQUIRED,
          "Escribe tu nombre para entrar a este evento.",
        );
      }

      const participant = participantOf(event, {
        displayName: name,
        registrationSource: "self",
        accessCodeHash: input.accessCodeHash,
        accessCodePrefix: input.accessCodePrefix,
        createdAt: state.now.toISOString(),
        updatedAt: state.now.toISOString(),
        lastSeenAt: state.now.toISOString(),
      });

      state.participants.set(participant.id, participant);
      const session = issueSession(participant, input.sessionTokenHash);

      return {
        participantId: participant.id,
        displayName: participant.displayName,
        eventId: event.id,
        eventDay: day,
        createdAt: participant.createdAt,
        sessionExpiresAt: session.expiresAt,
        remainingSlots:
          event.participantLimit === null ? null : Math.max(event.participantLimit - (used + 1), 0),
      };
    },
  };

  const participantRepository: ParticipantRepository = {
    async findSessionByTokenHash(tokenHash) {
      return (
        [...state.sessions.values()].find((session) => session.tokenHash === tokenHash) ?? null
      );
    },

    async findParticipantById(id) {
      return state.participants.get(id) ?? null;
    },

    async findEventById(id) {
      return state.events.get(id) ?? null;
    },

    async touchSession(id, lastUsedAt) {
      const session = state.sessions.get(id);

      if (session) {
        session.lastUsedAt = lastUsedAt;
      }
    },

    async revokeSessionsForParticipant(participantId) {
      for (const session of state.sessions.values()) {
        if (session.participantId === participantId) {
          session.revokedAt = state.now.toISOString();
        }
      }
    },

    async getQuota(participantId) {
      const participant = state.participants.get(participantId);

      if (!participant) {
        throw new Error("PARTICIPANT_NOT_FOUND");
      }

      return quotaOf(state, participant);
    },

    async updateDisplayName(participantId, displayName) {
      const participant = state.participants.get(participantId);

      if (!participant) {
        throw new Error("PARTICIPANT_NOT_FOUND");
      }

      participant.displayName = displayName;
      participant.updatedAt = state.now.toISOString();
      return participant;
    },
  };

  return { publicRepository, participantRepository };
}

const storage: StorageService = {
  async createSignedUrl(path) {
    return path ? `https://storage.test/${path}` : null;
  },
  async createCoverUploadTarget() {
    throw new Error("not used");
  },
  async validateCoverObject() {
    throw new Error("not used");
  },
  async removeObject() {
    throw new Error("not used");
  },
};

const audit: AuditRepository = {
  async record() {},
  async listRecent() {
    return [];
  },
};

type Context = {
  app: Express;
  state: State;
  event: EventRecord;
};

function createContext(eventOverrides: Partial<EventRecord> = {}): Context {
  const state: State = {
    now: new Date("2026-11-15T18:00:00.000Z"),
    events: new Map(),
    participants: new Map(),
    sessions: new Map(),
  };

  const event = eventOf(eventOverrides);
  state.events.set(event.id, event);

  const { publicRepository, participantRepository } = createRepositories(state);
  const now = () => state.now;

  const publicService = createPublicService({
    env: testEnv,
    repository: publicRepository,
    storage,
    audit,
    now,
  });

  const participants = createParticipantService({
    env: testEnv,
    repository: participantRepository,
    now,
  });

  const app = createApp({
    env: testEnv,
    public: publicService,
    participants,
    checkReadiness: async () => ({ database: "ok", storage: "ok" }),
  });

  return { app, state, event };
}

function seedParticipant(
  context: Context,
  overrides: Partial<ParticipantRecord> = {},
): ParticipantRecord {
  const participant = participantOf(context.event, { id: PARTICIPANT_ID, ...overrides });
  context.state.participants.set(participant.id, participant);
  return participant;
}

describe("evento público", () => {
  let context: Context;

  beforeEach(() => {
    context = createContext();
  });

  it("devuelve la información de bienvenida y el estado", async () => {
    const response = await request(context.app).get(`/public/events/${SLUG}`);

    expect(response.status).toBe(200);
    const data = response.body.data;
    expect(data.name).toBe("Cumpleaños de Ana");
    expect(data.status).toBe("active");
    expect(data.effectiveStatus).toBe("active");
    expect(data.currentEventDay).toBe("2026-11-15");
    expect(data.dayNumber).toBe(2);
    expect(data.totalDays).toBe(4);
    expect(data.registration).toEqual({
      enabled: true,
      open: true,
      limit: 2,
      used: 0,
      remaining: 2,
      reason: null,
    });
    expect(data.canRegister).toBe(true);
    expect(data.quotaResetsAt).toBe("2026-11-16T06:00:00.000Z");

    const status = await request(context.app).get(`/public/events/${SLUG}/status`);

    expect(status.status).toBe(200);
    expect(status.body.data.canUpload).toBe(true);
    expect(status.body.data.canRegister).toBe(true);
    expect(status.body.data.currentEventDay).toBe("2026-11-15");
  });

  it("oculta los eventos en borrador o cancelados", async () => {
    const draft = createContext({ slug: "borrador", status: "draft" });
    const cancelled = createContext({ slug: "cancelado", status: "cancelled" });

    expect((await request(draft.app).get("/public/events/borrador")).status).toBe(404);
    expect((await request(cancelled.app).get("/public/events/cancelado")).status).toBe(404);
    expect((await request(draft.app).get("/public/events/borrador/status")).status).toBe(404);
  });

  it("muestra un evento programado sin permitir subir ni registrarse", async () => {
    const scheduled = createContext({ status: "scheduled" });

    const response = await request(scheduled.app).get(`/public/events/${SLUG}`);

    expect(response.status).toBe(200);
    expect(response.body.data.effectiveStatus).toBe("active");
    expect(response.body.data.registration.open).toBe(false);
    expect(response.body.data.registration.reason).toBe("event_not_active");
    expect(response.body.data.canRegister).toBe(false);

    const status = await request(scheduled.app).get(`/public/events/${SLUG}/status`);
    expect(status.body.data.canUpload).toBe(false);
  });

  it("marca fuera de fechas y deshabilita el registro", async () => {
    const contextOut = createContext();
    contextOut.state.now = new Date("2026-11-20T18:00:00.000Z");

    const response = await request(contextOut.app).get(`/public/events/${SLUG}/status`);

    expect(response.body.data.effectiveStatus).toBe("out_of_dates");
    expect(response.body.data.canUpload).toBe(false);
    expect(response.body.data.registration.reason).toBe("event_out_of_dates");
  });

  it("exige nombre y aplica el cupo en el auto-registro", async () => {
    const missingName = await request(context.app).post(`/public/events/${SLUG}/register`).send({});

    expect(missingName.status).toBe(400);
    expect(missingName.body.error.code).toBe("NAME_REQUIRED");

    const first = await request(context.app)
      .post(`/public/events/${SLUG}/register`)
      .send({ displayName: "Ana" });

    expect(first.status).toBe(201);
    expect(first.body.data.participant.displayName).toBe("Ana");
    expect(first.body.data.participant.registrationSource).toBe("self");
    expect(first.body.data.access.code.length).toBeGreaterThan(20);
    expect(first.body.data.access.url).toContain(`/e/${SLUG}/a/`);
    expect(first.body.data.session.token.length).toBeGreaterThan(32);
    expect(first.body.data.registration).toEqual({ limit: 2, used: 1, remaining: 1 });

    const second = await request(context.app)
      .post(`/public/events/${SLUG}/register`)
      .send({ displayName: "Luis" });
    expect(second.status).toBe(201);

    const third = await request(context.app)
      .post(`/public/events/${SLUG}/register`)
      .send({ displayName: "Marta" });
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe("PARTICIPANT_LIMIT_REACHED");

    const publicEvent = await request(context.app).get(`/public/events/${SLUG}`);
    expect(publicEvent.body.data.registration.used).toBe(2);
    expect(publicEvent.body.data.registration.remaining).toBe(0);
    expect(publicEvent.body.data.registration.reason).toBe("limit_reached");
    expect(publicEvent.body.data.canRegister).toBe(false);
  });

  it("rechaza el auto-registro si está deshabilitado", async () => {
    const disabled = createContext({ allowSelfRegistration: false });

    const response = await request(disabled.app)
      .post(`/public/events/${SLUG}/register`)
      .send({ displayName: "Ana" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("SELF_REGISTRATION_DISABLED");
  });
});

describe("canje del enlace personal", () => {
  let context: Context;

  beforeEach(() => {
    context = createContext();
    seedParticipant(context);
  });

  it("canjea el código, emite una sesión y no invalida el código", async () => {
    const first = await request(context.app)
      .post(`/public/events/${SLUG}/access/redeem`)
      .send({ accessCode: ACCESS_CODE });

    expect(first.status).toBe(200);
    expect(first.body.data.participant.displayName).toBe("Ana");
    expect(first.body.data.session.token.length).toBeGreaterThan(32);
    expect(first.body.data.quota.eventDay).toBe("2026-11-15");

    const second = await request(context.app)
      .post(`/public/events/${SLUG}/access/redeem`)
      .send({ accessCode: ACCESS_CODE });

    expect(second.status).toBe(200);
    expect(second.body.data.session.token).not.toBe(first.body.data.session.token);
  });

  it("exige nombre al canjear si el evento lo requiere", async () => {
    seedParticipant(context, {
      id: randomUUID(),
      displayName: null,
      accessCodeHash: hashToken("otro-codigo-de-acceso-largo"),
    });

    const missing = await request(context.app)
      .post(`/public/events/${SLUG}/access/redeem`)
      .send({ accessCode: "otro-codigo-de-acceso-largo" });

    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("NAME_REQUIRED");

    const named = await request(context.app)
      .post(`/public/events/${SLUG}/access/redeem`)
      .send({ accessCode: "otro-codigo-de-acceso-largo", displayName: "Marta" });

    expect(named.status).toBe(200);
    expect(named.body.data.participant.displayName).toBe("Marta");
  });

  it("rechaza códigos revocados, participantes deshabilitados y eventos no publicados", async () => {
    seedParticipant(context, {
      id: randomUUID(),
      accessCodeHash: hashToken("codigo-revocado-123456"),
      accessCodeRevokedAt: "2026-11-15T10:00:00.000Z",
    });

    const revokedResponse = await request(context.app)
      .post(`/public/events/${SLUG}/access/redeem`)
      .send({ accessCode: "codigo-revocado-123456" });
    expect(revokedResponse.status).toBe(401);
    expect(revokedResponse.body.error.code).toBe("ACCESS_CODE_INVALID");

    seedParticipant(context, {
      id: randomUUID(),
      accessCodeHash: hashToken("codigo-deshabilitado-123"),
      isActive: false,
    });

    const disabledResponse = await request(context.app)
      .post(`/public/events/${SLUG}/access/redeem`)
      .send({ accessCode: "codigo-deshabilitado-123" });
    expect(disabledResponse.status).toBe(401);

    const draft = createContext({ status: "draft" });
    seedParticipant(draft);
    const draftResponse = await request(draft.app)
      .post(`/public/events/${SLUG}/access/redeem`)
      .send({ accessCode: ACCESS_CODE });
    expect(draftResponse.status).toBe(401);
  });
});

describe("sesión del participante", () => {
  let context: Context;

  beforeEach(() => {
    context = createContext();
    seedParticipant(context);
  });

  async function redeem(app: Express): Promise<string> {
    const response = await request(app)
      .post(`/public/events/${SLUG}/access/redeem`)
      .send({ accessCode: ACCESS_CODE });

    return response.body.data.session.token as string;
  }

  it("devuelve el perfil, la cuota y los permisos", async () => {
    const token = await redeem(context.app);

    const me = await request(context.app)
      .get("/participants/me")
      .set("Authorization", `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.data.participant.displayName).toBe("Ana");
    expect(me.body.data.participant.anonymous).toBe(false);
    expect(me.body.data.event.slug).toBe(SLUG);
    expect(me.body.data.event.effectiveStatus).toBe("active");
    expect(me.body.data.quota.eventDay).toBe("2026-11-15");
    expect(me.body.data.permissions).toEqual({
      canUpload: true,
      canDeletePhotos: false,
      canViewGallery: true,
      canChangeName: true,
    });

    const quota = await request(context.app)
      .get("/participants/me/quota")
      .set("Authorization", `Bearer ${token}`);

    expect(quota.status).toBe(200);
    expect(quota.body.data.dailyLimit).toBe(10);
    expect(quota.body.data.remainingDay).toBe(10);
  });

  it("permite cambiar el nombre mientras el evento está activo", async () => {
    const token = await redeem(context.app);

    const updated = await request(context.app)
      .patch("/participants/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "Ana María" });

    expect(updated.status).toBe(200);
    expect(updated.body.data.participant.displayName).toBe("Ana María");
  });

  it("responde 401 sin token, con token inválido o sesión revocada", async () => {
    const missing = await request(context.app).get("/participants/me");
    expect(missing.status).toBe(401);

    const invalid = await request(context.app)
      .get("/participants/me")
      .set("Authorization", "Bearer token-invalido");
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe("PARTICIPANT_SESSION_EXPIRED");

    const token = await redeem(context.app);

    for (const session of context.state.sessions.values()) {
      session.revokedAt = context.state.now.toISOString();
    }

    const revoked = await request(context.app)
      .get("/participants/me")
      .set("Authorization", `Bearer ${token}`);

    expect(revoked.status).toBe(401);
    expect(revoked.body.error.code).toBe("PARTICIPANT_SESSION_EXPIRED");
  });

  it("responde 403 y revoca sesiones si el participante fue deshabilitado", async () => {
    const token = await redeem(context.app);

    for (const participant of context.state.participants.values()) {
      participant.isActive = false;
    }

    const response = await request(context.app)
      .get("/participants/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(
      [...context.state.sessions.values()].every((session) => session.revokedAt !== null),
    ).toBe(true);
  });
});
