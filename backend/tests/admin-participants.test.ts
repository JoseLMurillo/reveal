import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { createAdminServices } from "../src/modules/admin/index.js";
import { testEnv } from "./fixtures.js";
import {
  createAdminParticipantsRepository,
  createAdminPhotosRepository,
  createAlbumRepository,
  createAdminRepository,
  createAuditRepository,
  createEventRepository,
  createHarness,
  createPhotoStorageService,
  createSessionRepository,
  createStatsRepository,
  createStorageService,
  seedAdmin,
  type Harness,
} from "./admin-helpers.js";

const PASSWORD = "correct horse battery staple";

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

type Context = {
  app: Express;
  harness: Harness;
};

async function createContext(): Promise<Context> {
  const harness = await createHarness();
  const services = createAdminServices(testEnv, null, {
    adminRepository: createAdminRepository(harness.state),
    sessionRepository: createSessionRepository(harness.state),
    auditRepository: createAuditRepository(harness.state),
    eventRepository: createEventRepository(harness.state),
    participantRepository: createAdminParticipantsRepository(harness.state),
    statsRepository: createStatsRepository(harness.state),
    storageService: createStorageService(harness.state),
    photoRepository: createAdminPhotosRepository(harness.state),
    albumRepository: createAlbumRepository(harness.state),
    photoStorageService: createPhotoStorageService(harness.state),
  });

  const app = createApp({
    env: testEnv,
    admin: services,
    checkReadiness: async () => ({ database: "ok", storage: "ok" }),
  });

  return { app, harness };
}

async function login(
  app: Express,
  email: string,
  password = PASSWORD,
): Promise<{ agent: ReturnType<typeof request.agent>; csrf: string }> {
  const agent = request.agent(app);
  const response = await agent.post("/admin/auth/login").send({ email, password });

  if (response.status !== 200) {
    throw new Error(`Login falló: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return { agent, csrf: response.body.data.csrfToken as string };
}

function eventPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Cumpleaños de Ana",
    description: "Una tarde para recordar.",
    startDate: isoDate(-1),
    endDate: isoDate(5),
    timezone: "America/Mexico_City",
    dailyPhotoLimit: 10,
    totalPhotoLimit: 30,
    requireName: true,
    showParticipantNames: false,
    allowSelfRegistration: false,
    participantLimit: 4,
    maxFileSizeBytes: 10_485_760,
    galleryVisibility: "participants",
    allowPhotoDeletion: false,
    ...overrides,
  };
}

async function createEvent(
  agent: ReturnType<typeof request.agent>,
  csrf: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const response = await agent
    .post("/admin/events")
    .set("X-CSRF-Token", csrf)
    .send(eventPayload(overrides));

  if (response.status !== 201) {
    throw new Error(`No se creó el evento: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return response.body.data.id as string;
}

describe("participantes administrativos", () => {
  let context: Context;
  let agent: ReturnType<typeof request.agent>;
  let csrf: string;
  let eventId: string;

  beforeEach(async () => {
    context = await createContext();
    await seedAdmin(context.harness.state, { email: "admin@rollo.test", password: PASSWORD });
    const session = await login(context.app, "admin@rollo.test");
    agent = session.agent;
    csrf = session.csrf;
    eventId = await createEvent(agent, csrf);
  });

  it("crea un participante y devuelve el enlace personal una sola vez", async () => {
    const response = await agent
      .post(`/admin/events/${eventId}/participants`)
      .set("X-CSRF-Token", csrf)
      .send({ displayName: "Ana", note: "mesa 4" });

    expect(response.status).toBe(201);
    const data = response.body.data;

    expect(data.participant.displayName).toBe("Ana");
    expect(data.participant.note).toBe("mesa 4");
    expect(data.participant.anonymous).toBe(false);
    expect(data.participant.registrationSource).toBe("admin");
    expect(data.access.code.length).toBeGreaterThan(20);
    expect(data.access.url).toBe(
      `${testEnv.FRONTEND_URL}/e/cumpleanos-de-ana/a/${data.access.code}`,
    );
    expect(data.registration).toEqual({ limit: 4, used: 1, remaining: 3 });

    const list = await agent.get(`/admin/events/${eventId}/participants`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].accessCodePrefix).toBe(data.participant.accessCodePrefix);
    expect(list.body.data[0].accessCodeStatus).toBe("active");
    expect(list.body.data[0].photosToday).toBe(0);
    expect(list.body.data[0].remainingToday).toBe(10);
    expect(JSON.stringify(list.body)).not.toContain(data.access.code);
  });

  it("permite crear participantes sin nombre ni nota", async () => {
    const response = await agent
      .post(`/admin/events/${eventId}/participants`)
      .set("X-CSRF-Token", csrf)
      .send({});

    expect(response.status).toBe(201);
    expect(response.body.data.participant.displayName).toBeNull();
    expect(response.body.data.participant.note).toBeNull();
    expect(response.body.data.participant.anonymous).toBe(true);
  });

  it("crea lotes completos o rechaza el lote entero al agotar el cupo", async () => {
    const bulk = await agent
      .post(`/admin/events/${eventId}/participants/bulk`)
      .set("X-CSRF-Token", csrf)
      .send({
        participants: [{ displayName: "Ana" }, { displayName: "Luis" }, { note: "mesa 5" }],
      });

    expect(bulk.status).toBe(201);
    expect(bulk.body.data.created).toHaveLength(3);
    expect(bulk.body.data.registration).toEqual({ limit: 4, used: 3, remaining: 1 });

    const codes = bulk.body.data.created.map(
      (item: { access: { code: string } }) => item.access.code,
    );
    expect(new Set(codes).size).toBe(3);

    const overflow = await agent
      .post(`/admin/events/${eventId}/participants/bulk`)
      .set("X-CSRF-Token", csrf)
      .send({ participants: [{ displayName: "Uno" }, { displayName: "Dos" }] });

    expect(overflow.status).toBe(409);
    expect(overflow.body.error.code).toBe("PARTICIPANT_LIMIT_REACHED");

    const list = await agent.get(`/admin/events/${eventId}/participants`);
    expect(list.body.meta.total).toBe(3);
  });

  it("filtra por nombre, nota, prefijo, estado y origen", async () => {
    const created = await agent
      .post(`/admin/events/${eventId}/participants`)
      .set("X-CSRF-Token", csrf)
      .send({ displayName: "Ana", note: "mesa 4" });

    const prefix = created.body.data.participant.accessCodePrefix as string;

    const byName = await agent.get(
      `/admin/events/${eventId}/participants?search=${encodeURIComponent("ana")}`,
    );
    expect(byName.body.meta.total).toBe(1);

    const byNote = await agent.get(
      `/admin/events/${eventId}/participants?search=${encodeURIComponent("mesa")}`,
    );
    expect(byNote.body.meta.total).toBe(1);

    const byPrefix = await agent.get(`/admin/events/${eventId}/participants?search=${prefix}`);
    expect(byPrefix.body.meta.total).toBe(1);

    const anonymous = await agent.get(`/admin/events/${eventId}/participants?anonymous=true`);
    expect(anonymous.body.meta.total).toBe(0);

    const fromAdmin = await agent.get(`/admin/events/${eventId}/participants?source=admin`);
    expect(fromAdmin.body.meta.total).toBe(1);

    const fromSelf = await agent.get(`/admin/events/${eventId}/participants?source=self`);
    expect(fromSelf.body.meta.total).toBe(0);
  });

  it("actualiza nombre, nota y estado sin tocar el código", async () => {
    const created = await agent
      .post(`/admin/events/${eventId}/participants`)
      .set("X-CSRF-Token", csrf)
      .send({ displayName: "Ana", note: "mesa 4" });

    const participantId = created.body.data.participant.id as string;
    const prefix = created.body.data.participant.accessCodePrefix as string;

    const updated = await agent
      .patch(`/admin/participants/${participantId}`)
      .set("X-CSRF-Token", csrf)
      .send({ displayName: "Ana María", note: null, isActive: false });

    expect(updated.status).toBe(200);
    expect(updated.body.data.displayName).toBe("Ana María");
    expect(updated.body.data.note).toBeNull();
    expect(updated.body.data.isActive).toBe(false);
    expect(updated.body.data.accessCodePrefix).toBe(prefix);
    expect(updated.body.data.accessCodeStatus).toBe("active");
  });

  it("regenera y revoca el código de acceso", async () => {
    const created = await agent
      .post(`/admin/events/${eventId}/participants`)
      .set("X-CSRF-Token", csrf)
      .send({ displayName: "Ana" });

    const participantId = created.body.data.participant.id as string;

    const regenerated = await agent
      .post(`/admin/participants/${participantId}/access-code/regenerate`)
      .set("X-CSRF-Token", csrf)
      .send({ revokeSessions: true });

    expect(regenerated.status).toBe(200);
    expect(regenerated.body.data.access.code).not.toBe(created.body.data.access.code);
    expect(regenerated.body.data.sessionsRevoked).toBe(true);

    const revoked = await agent
      .post(`/admin/participants/${participantId}/access-code/revoke`)
      .set("X-CSRF-Token", csrf)
      .send({});

    expect(revoked.status).toBe(200);
    expect(revoked.body.data.accessCodeStatus).toBe("revoked");
    expect(revoked.body.data.sessionsRevoked).toBe(true);

    const list = await agent.get(`/admin/events/${eventId}/participants`);
    expect(list.body.data[0].accessCodeStatus).toBe("revoked");
  });

  it("exige sesión, CSRF y propiedad del evento", async () => {
    await seedAdmin(context.harness.state, {
      email: "otro@rollo.test",
      password: PASSWORD,
      role: "admin",
    });

    const anonymous = await request(context.app).get(`/admin/events/${eventId}/participants`);
    expect(anonymous.status).toBe(401);

    const withoutCsrf = await agent
      .post(`/admin/events/${eventId}/participants`)
      .send({ displayName: "Ana" });
    expect(withoutCsrf.status).toBe(403);

    const other = await login(context.app, "otro@rollo.test");

    const forbiddenList = await other.agent.get(`/admin/events/${eventId}/participants`);
    expect(forbiddenList.status).toBe(403);
    expect(forbiddenList.body.error.code).toBe("FORBIDDEN");

    const forbiddenCreate = await other.agent
      .post(`/admin/events/${eventId}/participants`)
      .set("X-CSRF-Token", other.csrf)
      .send({ displayName: "Ana" });
    expect(forbiddenCreate.status).toBe(403);
  });

  it("devuelve 404 si el participante no existe", async () => {
    const response = await agent
      .patch("/admin/participants/00000000-0000-4000-8000-000000000000")
      .set("X-CSRF-Token", csrf)
      .send({ displayName: "Nadie" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
