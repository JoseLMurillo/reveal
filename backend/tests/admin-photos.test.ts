import { randomUUID } from "node:crypto";

import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { createAdminServices } from "../src/modules/admin/index.js";
import type { EventRecord } from "../src/modules/admin/shared/types.js";
import type { ParticipantRecord } from "../src/modules/participants/types.js";
import type { PhotoRecord } from "../src/modules/photos/types.js";
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
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(
  new Date(),
);

function shiftDay(days: number): string {
  const date = new Date(`${TODAY}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type Context = {
  app: Express;
  harness: Harness;
  event: EventRecord;
  participant: ParticipantRecord;
  photo: PhotoRecord;
};

async function createContext(): Promise<Context> {
  const harness = await createHarness();
  const admin = await seedAdmin(harness.state, {
    email: "admin@rollo.test",
    password: PASSWORD,
  });

  const event: EventRecord = {
    id: randomUUID(),
    adminId: admin.id,
    slug: "cumple-de-ana",
    name: "Cumpleaños de Ana",
    description: null,
    coverImagePath: null,
    startDate: shiftDay(-2),
    endDate: shiftDay(2),
    timezone: "America/Mexico_City",
    dailyPhotoLimit: 10,
    totalPhotoLimit: 30,
    requireName: true,
    showParticipantNames: true,
    allowSelfRegistration: true,
    participantLimit: 20,
    maxFileSizeBytes: 10_485_760,
    galleryVisibility: "participants",
    allowPhotoDeletion: false,
    status: "active",
    createdAt: "2026-11-01T18:00:00.000Z",
    updatedAt: "2026-11-01T18:00:00.000Z",
  };
  harness.state.events.set(event.id, event);

  const participant: ParticipantRecord = {
    id: randomUUID(),
    eventId: event.id,
    displayName: "Ana",
    note: null,
    registrationSource: "admin",
    accessCodeHash: "hash",
    accessCodePrefix: "abc123",
    accessCodeCreatedAt: "2026-11-12T18:00:00.000Z",
    accessCodeRevokedAt: null,
    isActive: true,
    createdAt: "2026-11-12T18:00:00.000Z",
    updatedAt: "2026-11-12T18:00:00.000Z",
    lastSeenAt: "2026-11-12T18:00:00.000Z",
  };
  harness.state.participants.set(participant.id, participant);

  const photo: PhotoRecord = {
    id: randomUUID(),
    eventId: event.id,
    participantId: participant.id,
    uploadItemId: null,
    storagePath: `events/${event.id}/originals/2026-11-15/${participant.id}/${randomUUID()}.jpg`,
    originalFilename: "IMG_0001.jpg",
    mimeType: "image/jpeg",
    fileSize: 2048,
    width: 1600,
    height: 1200,
    contentHash: randomUUID().replace(/-/g, "").padEnd(64, "0").slice(0, 64),
    eventDay: TODAY,
    uploadedAt: `${TODAY}T17:00:00.000Z`,
    status: "active",
    deletedAt: null,
    deletedByAdminId: null,
  };
  harness.state.photos.set(photo.id, photo);

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

  return { app, harness, event, participant, photo };
}

async function login(
  app: Express,
  email = "admin@rollo.test",
): Promise<{ agent: ReturnType<typeof request.agent>; csrf: string }> {
  const agent = request.agent(app);
  const response = await agent.post("/admin/auth/login").send({ email, password: PASSWORD });

  if (response.status !== 200) {
    throw new Error(`Login falló: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return { agent, csrf: response.body.data.csrfToken as string };
}

describe("fotografías administrativas", () => {
  let context: Context;

  beforeEach(async () => {
    context = await createContext();
  });

  it("exige autenticación administrativa", async () => {
    const response = await request(context.app).get(`/admin/events/${context.event.id}/photos`);

    expect(response.status).toBe(401);
  });

  it("lista fotos con participante, filtros y metadatos", async () => {
    const { agent } = await login(context.app);

    const second = {
      ...context.photo,
      id: randomUUID(),
      originalFilename: "IMG_0002.jpg",
      eventDay: shiftDay(-1),
      storagePath: `events/${context.event.id}/originals/${shiftDay(-1)}/${context.participant.id}/${randomUUID()}.jpg`,
    };
    context.harness.state.photos.set(second.id, second);

    const all = await agent.get(`/admin/events/${context.event.id}/photos`);

    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.meta).toMatchObject({ page: 1, limit: 24, total: 2, totalPages: 1 });
    expect(all.body.data[0].participant).toMatchObject({
      id: context.participant.id,
      displayName: "Ana",
      anonymous: false,
    });
    expect(all.body.data[0].url).toContain("https://storage.test/");

    const byDay = await agent.get(`/admin/events/${context.event.id}/photos?day=${shiftDay(-1)}`);
    expect(byDay.body.data).toHaveLength(1);
    expect(byDay.body.data[0].originalFilename).toBe("IMG_0002.jpg");

    const bySearch = await agent.get(`/admin/events/${context.event.id}/photos?search=ana`);
    expect(bySearch.body.data).toHaveLength(2);

    const noMatch = await agent.get(`/admin/events/${context.event.id}/photos?search=zzz`);
    expect(noMatch.body.data).toHaveLength(0);
  });

  it("incluye las borradas solo cuando se pide explícitamente", async () => {
    const deleted = {
      ...context.photo,
      id: randomUUID(),
      status: "deleted" as const,
      deletedAt: "2026-11-15T18:00:00.000Z",
    };
    context.harness.state.photos.set(deleted.id, deleted);

    const { agent } = await login(context.app);

    const activeOnly = await agent.get(`/admin/events/${context.event.id}/photos`);
    expect(activeOnly.body.data).toHaveLength(1);

    const withDeleted = await agent.get(
      `/admin/events/${context.event.id}/photos?includeDeleted=true`,
    );
    expect(withDeleted.body.data).toHaveLength(2);
  });

  it("borra con soft delete, audita y es idempotente", async () => {
    const { agent, csrf } = await login(context.app);

    const response = await agent
      .delete(`/admin/photos/${context.photo.id}`)
      .set("x-csrf-token", csrf);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ deleted: true });
    expect(context.harness.state.photos.get(context.photo.id)?.status).toBe("deleted");

    const audit = context.harness.state.audit.at(-1);
    expect(audit).toMatchObject({
      action: "photo.deleted",
      eventId: context.event.id,
      metadata: { participantId: context.participant.id, eventDay: TODAY },
    });

    const again = await agent.delete(`/admin/photos/${context.photo.id}`).set("x-csrf-token", csrf);

    expect(again.status).toBe(200);
    expect(
      context.harness.state.audit.filter((entry) => entry.action === "photo.deleted"),
    ).toHaveLength(1);
  });

  it("rechaza borrar sin CSRF o sin acceso al evento", async () => {
    const { agent, csrf } = await login(context.app);

    const noCsrf = await agent.delete(`/admin/photos/${context.photo.id}`);
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe("CSRF_INVALID");

    const other = await seedAdmin(context.harness.state, {
      email: "otro@rollo.test",
      password: PASSWORD,
    });
    const foreignEvent: EventRecord = {
      ...context.event,
      id: randomUUID(),
      adminId: other.id,
    };
    context.harness.state.events.set(foreignEvent.id, foreignEvent);
    const foreignPhoto: PhotoRecord = {
      ...context.photo,
      id: randomUUID(),
      eventId: foreignEvent.id,
    };
    context.harness.state.photos.set(foreignPhoto.id, foreignPhoto);

    const { agent: otherAgent, csrf: otherCsrf } = await login(context.app, "otro@rollo.test");

    const foreignAsAdmin = await agent
      .delete(`/admin/photos/${foreignPhoto.id}`)
      .set("x-csrf-token", csrf);
    expect(foreignAsAdmin.status).toBe(403);

    const own = await otherAgent
      .delete(`/admin/photos/${context.photo.id}`)
      .set("x-csrf-token", otherCsrf);
    expect(own.status).toBe(403);
  });

  it("redirige a una URL firmada de descarga y oculta las borradas", async () => {
    const { agent } = await login(context.app);

    const response = await agent.get(
      `/admin/events/${context.event.id}/photos/${context.photo.id}/download`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("https://storage.test/");

    context.harness.state.photos.get(context.photo.id)!.status = "deleted";

    const deleted = await agent.get(
      `/admin/events/${context.event.id}/photos/${context.photo.id}/download`,
    );

    expect(deleted.status).toBe(404);
  });

  it("devuelve estadísticas del evento", async () => {
    context.harness.state.photos.set(randomUUID(), {
      ...context.photo,
      id: randomUUID(),
      status: "deleted",
      deletedAt: "2026-11-15T18:00:00.000Z",
    });

    const { agent } = await login(context.app);
    const response = await agent.get(`/admin/events/${context.event.id}/statistics`);

    expect(response.status).toBe(200);
    expect(response.body.data.event).toMatchObject({
      id: context.event.id,
      name: "Cumpleaños de Ana",
      status: "active",
    });
    expect(response.body.data.totals).toMatchObject({
      participants: 1,
      anonymousParticipants: 0,
      photos: 1,
      photosToday: 1,
      storageBytes: 2048,
      deletedPhotos: 1,
    });
  });

  it("lista la actividad del evento", async () => {
    context.harness.state.audit.push({
      id: 10,
      action: "photo.deleted",
      eventId: context.event.id,
      eventName: context.event.name,
      metadata: { photoId: context.photo.id },
      createdAt: "2026-11-15T18:00:00.000Z",
    });

    const { agent } = await login(context.app);
    const response = await agent.get(`/admin/events/${context.event.id}/activity?page=1&limit=8`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      action: "photo.deleted",
      metadata: { photoId: context.photo.id },
    });
  });
});
