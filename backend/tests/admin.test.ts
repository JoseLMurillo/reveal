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
  now: { value: Date };
};

async function createContext(): Promise<Context> {
  const harness = await createHarness();
  const now = { value: new Date() };

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
    now: () => now.value,
  });

  const app = createApp({
    env: testEnv,
    admin: services,
    checkReadiness: async () => ({ database: "ok", storage: "ok" }),
  });

  return { app, harness, now };
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
    allowSelfRegistration: true,
    participantLimit: 10,
    maxFileSizeBytes: 10_485_760,
    galleryVisibility: "participants",
    allowPhotoDeletion: false,
    ...overrides,
  };
}

describe("autenticación administrativa", () => {
  let context: Context;

  beforeEach(async () => {
    context = await createContext();
    await seedAdmin(context.harness.state, {
      email: "admin@rollo.test",
      password: PASSWORD,
    });
  });

  it("rechaza credenciales desconocidas con un error genérico", async () => {
    const response = await request(context.app)
      .post("/admin/auth/login")
      .send({ email: "nadie@rollo.test", password: PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("crea una sesión con cookies HttpOnly y responde con el CSRF", async () => {
    const response = await request(context.app)
      .post("/admin/auth/login")
      .send({ email: "admin@rollo.test", password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.admin.email).toBe("admin@rollo.test");
    expect(response.body.data.csrfToken.length).toBeGreaterThan(32);

    const cookies = response.headers["set-cookie"] as unknown as string[];
    const sessionCookie = cookies.find((cookie) => cookie.startsWith("rollo_admin_session="));
    const csrfCookie = cookies.find((cookie) => cookie.startsWith("rollo_csrf="));

    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(csrfCookie).not.toContain("HttpOnly");
  });

  it("aplica el bloqueo de origen antes del login", async () => {
    const response = await request(context.app)
      .post("/admin/auth/login")
      .set("Origin", "https://evil.example")
      .send({ email: "admin@rollo.test", password: PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_INVALID");
  });

  it("expira la sesión por inactividad", async () => {
    const { agent } = await login(context.app, "admin@rollo.test");

    context.now.value = new Date(context.now.value.getTime() + 61 * 60 * 1000);

    const response = await agent.get("/admin/auth/me");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("devuelve ADMIN_DISABLED y revoca la sesión si la cuenta se deshabilita", async () => {
    const { agent } = await login(context.app, "admin@rollo.test");
    context.harness.getAdmin("admin@rollo.test").isActive = false;

    const response = await agent.get("/admin/auth/me");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ADMIN_DISABLED");
  });

  it("cambia la contraseña, revoca todas las sesiones y permite entrar con la nueva", async () => {
    const { agent, csrf } = await login(context.app, "admin@rollo.test");

    const change = await agent
      .post("/admin/auth/password")
      .set("X-CSRF-Token", csrf)
      .send({ currentPassword: PASSWORD, newPassword: "una contraseña mucho más larga" });

    expect(change.status).toBe(204);

    const after = await agent.get("/admin/auth/me");
    expect(after.status).toBe(401);

    const oldLogin = await request(context.app)
      .post("/admin/auth/login")
      .send({ email: "admin@rollo.test", password: PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(context.app)
      .post("/admin/auth/login")
      .send({ email: "admin@rollo.test", password: "una contraseña mucho más larga" });
    expect(newLogin.status).toBe(200);
  });
});

describe("eventos administrativos", () => {
  let context: Context;
  let adminEmail: string;

  beforeEach(async () => {
    context = await createContext();
    adminEmail = "admin@rollo.test";
    await seedAdmin(context.harness.state, { email: adminEmail, password: PASSWORD });
  });

  it("exige CSRF en peticiones mutantes", async () => {
    const { agent } = await login(context.app, adminEmail);

    const withoutCsrf = await agent.post("/admin/events").send(eventPayload());
    expect(withoutCsrf.status).toBe(403);
    expect(withoutCsrf.body.error.code).toBe("CSRF_INVALID");
  });

  it("crea, lista, consulta y actualiza un evento", async () => {
    const { agent, csrf } = await login(context.app, adminEmail);

    const created = await agent
      .post("/admin/events")
      .set("X-CSRF-Token", csrf)
      .send(eventPayload());

    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("draft");
    expect(created.body.data.slug).toBe("cumpleanos-de-ana");
    expect(created.body.data.publicPath).toBe("/e/cumpleanos-de-ana");

    const id = created.body.data.id as string;

    const list = await agent.get("/admin/events");
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].id).toBe(id);

    const detail = await agent.get(`/admin/events/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.counts.remainingSlots).toBe(10);

    const updated = await agent
      .patch(`/admin/events/${id}`)
      .set("X-CSRF-Token", csrf)
      .send({ name: "Cumpleaños de Ana y Luis", participantLimit: 12 });

    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe("Cumpleaños de Ana y Luis");
    expect(updated.body.data.counts.remainingSlots).toBe(12);
  });

  it("genera slugs únicos al duplicar", async () => {
    const { agent, csrf } = await login(context.app, adminEmail);

    const created = await agent
      .post("/admin/events")
      .set("X-CSRF-Token", csrf)
      .send(eventPayload());

    const duplicated = await agent
      .post(`/admin/events/${created.body.data.id}/duplicate`)
      .set("X-CSRF-Token", csrf);

    expect(duplicated.status).toBe(201);
    expect(duplicated.body.data.slug).not.toBe(created.body.data.slug);
    expect(duplicated.body.data.status).toBe("draft");
  });

  it("aplica las transiciones schedule → activate → finish", async () => {
    const { agent, csrf } = await login(context.app, adminEmail);
    const created = await agent
      .post("/admin/events")
      .set("X-CSRF-Token", csrf)
      .send(eventPayload());
    const id = created.body.data.id as string;

    const scheduled = await agent.post(`/admin/events/${id}/schedule`).set("X-CSRF-Token", csrf);
    expect(scheduled.status).toBe(200);
    expect(scheduled.body.data.status).toBe("scheduled");

    const activated = await agent.post(`/admin/events/${id}/activate`).set("X-CSRF-Token", csrf);
    expect(activated.status).toBe(200);
    expect(activated.body.data.status).toBe("active");

    const finished = await agent.post(`/admin/events/${id}/finish`).set("X-CSRF-Token", csrf);
    expect(finished.status).toBe(200);
    expect(finished.body.data.status).toBe("finished");
  });

  it("rechaza activar un evento fuera de fechas", async () => {
    const { agent, csrf } = await login(context.app, adminEmail);
    const created = await agent
      .post("/admin/events")
      .set("X-CSRF-Token", csrf)
      .send(eventPayload({ startDate: isoDate(10), endDate: isoDate(15) }));

    const response = await agent
      .post(`/admin/events/${created.body.data.id}/activate`)
      .set("X-CSRF-Token", csrf);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EVENT_OUT_OF_DATES");
  });

  it("cancela con motivo y audita la acción", async () => {
    const { agent, csrf } = await login(context.app, adminEmail);
    const created = await agent
      .post("/admin/events")
      .set("X-CSRF-Token", csrf)
      .send(eventPayload());

    const cancelled = await agent
      .post(`/admin/events/${created.body.data.id}/cancel`)
      .set("X-CSRF-Token", csrf)
      .send({ reason: "Cancelado por el cliente" });

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("cancelled");
    expect(context.harness.state.audit.some((entry) => entry.action === "event.cancelled")).toBe(
      true,
    );
  });

  it("elimina solo con el nombre exacto y encola los objetos", async () => {
    const { agent, csrf } = await login(context.app, adminEmail);
    const created = await agent
      .post("/admin/events")
      .set("X-CSRF-Token", csrf)
      .send(eventPayload());
    const id = created.body.data.id as string;

    const wrong = await agent
      .delete(`/admin/events/${id}`)
      .set("X-CSRF-Token", csrf)
      .send({ confirmName: "otro nombre" });
    expect(wrong.status).toBe(409);

    const removed = await agent
      .delete(`/admin/events/${id}`)
      .set("X-CSRF-Token", csrf)
      .send({ confirmName: "Cumpleaños de Ana" });
    expect(removed.status).toBe(202);
    expect(removed.body.data.cleanupQueued).toBe(true);

    const detail = await agent.get(`/admin/events/${id}`);
    expect(detail.status).toBe(404);
  });

  it("gestiona la portada con intención, confirmación y borrado", async () => {
    const { agent, csrf } = await login(context.app, adminEmail);
    const created = await agent
      .post("/admin/events")
      .set("X-CSRF-Token", csrf)
      .send(eventPayload());
    const id = created.body.data.id as string;

    const intent = await agent
      .post(`/admin/events/${id}/cover/upload-intent`)
      .set("X-CSRF-Token", csrf)
      .send({ filename: "portada.jpg", mimeType: "image/jpeg", sizeBytes: 2048 });

    expect(intent.status).toBe(201);
    const storagePath = intent.body.data.storagePath as string;

    const confirmed = await agent
      .post(`/admin/events/${id}/cover/confirm`)
      .set("X-CSRF-Token", csrf)
      .send({ storagePath });

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.coverUrl).toContain(storagePath);

    const deleted = await agent.delete(`/admin/events/${id}/cover`).set("X-CSRF-Token", csrf);
    expect(deleted.status).toBe(204);

    const detail = await agent.get(`/admin/events/${id}`);
    expect(detail.body.data.coverUrl).toBeNull();
  });

  it("genera QR PNG y SVG autenticados", async () => {
    const { agent, csrf } = await login(context.app, adminEmail);
    const created = await agent
      .post("/admin/events")
      .set("X-CSRF-Token", csrf)
      .send(eventPayload());
    const id = created.body.data.id as string;

    const png = await agent.get(`/admin/events/${id}/qr?format=png&size=512`);
    expect(png.status).toBe(200);
    expect(png.headers["content-type"]).toContain("image/png");
    expect(png.headers["content-disposition"]).toContain("inline");
    expect(png.body.length).toBeGreaterThan(100);

    const svg = await agent.get(`/admin/events/${id}/qr?format=svg&download=1`);
    expect(svg.status).toBe(200);
    expect(svg.headers["content-type"]).toContain("image/svg+xml");
    expect(svg.headers["content-disposition"]).toContain("attachment");
    expect(Buffer.from(svg.body).toString("utf8")).toContain("<svg");
  });

  it("aísla los eventos entre administradores y deja pasar al owner", async () => {
    await seedAdmin(context.harness.state, {
      email: "otro@rollo.test",
      password: PASSWORD,
    });
    await seedAdmin(context.harness.state, {
      email: "owner@rollo.test",
      password: PASSWORD,
      role: "owner",
    });

    const first = await login(context.app, adminEmail);
    const created = await first.agent
      .post("/admin/events")
      .set("X-CSRF-Token", first.csrf)
      .send(eventPayload());
    const id = created.body.data.id as string;

    const second = await login(context.app, "otro@rollo.test");
    const denied = await second.agent.get(`/admin/events/${id}`);
    expect(denied.status).toBe(403);

    const secondList = await second.agent.get("/admin/events");
    expect(secondList.body.meta.total).toBe(0);

    const owner = await login(context.app, "owner@rollo.test");
    const allowed = await owner.agent.get(`/admin/events/${id}`);
    expect(allowed.status).toBe(200);
  });

  it("bloquea cambios de zona horaria cuando ya hay actividad", async () => {
    const { agent, csrf } = await login(context.app, adminEmail);
    const created = await agent
      .post("/admin/events")
      .set("X-CSRF-Token", csrf)
      .send(eventPayload());
    const id = created.body.data.id as string;

    context.harness.state.activity.add(id);

    const response = await agent
      .patch(`/admin/events/${id}`)
      .set("X-CSRF-Token", csrf)
      .send({ timezone: "Europe/Madrid" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("impide reducir el cupo por debajo de los participantes actuales", async () => {
    const { agent, csrf } = await login(context.app, adminEmail);
    const created = await agent
      .post("/admin/events")
      .set("X-CSRF-Token", csrf)
      .send(eventPayload());
    const id = created.body.data.id as string;

    context.harness.state.stats.set(id, {
      participants: 8,
      photos: 0,
      photosToday: 0,
      quotaConsumedToday: 0,
    });

    const response = await agent
      .patch(`/admin/events/${id}`)
      .set("X-CSRF-Token", csrf)
      .send({ participantLimit: 5 });

    expect(response.status).toBe(409);
    expect(response.body.error.details.current).toBe(8);
  });
});

describe("dashboard administrativo", () => {
  it("agrega solo los eventos accesibles", async () => {
    const context = await createContext();
    await seedAdmin(context.harness.state, {
      email: "admin@rollo.test",
      password: PASSWORD,
    });

    const { agent, csrf } = await login(context.app, "admin@rollo.test");
    const created = await agent
      .post("/admin/events")
      .set("X-CSRF-Token", csrf)
      .send(eventPayload());

    const id = created.body.data.id as string;
    context.harness.state.stats.set(id, {
      participants: 3,
      photos: 12,
      photosToday: 4,
      quotaConsumedToday: 6,
    });

    const response = await agent.get("/admin/dashboard");

    expect(response.status).toBe(200);
    expect(response.body.data.totals.events).toBe(1);
    expect(response.body.data.totals.participants).toBe(3);
    expect(response.body.data.totals.photos).toBe(12);
    expect(response.body.data.events[0].quotaConsumedToday).toBe(6);
    expect(
      response.body.data.recentActivity.some(
        (entry: { action: string }) => entry.action === "event.created",
      ),
    ).toBe(true);
  });
});
