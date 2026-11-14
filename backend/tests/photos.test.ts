import { createHash, randomUUID } from "node:crypto";

import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { createParticipantService } from "../src/modules/participants/participants.service.js";
import { createPhotosService } from "../src/modules/photos/photos.service.js";
import { testEnv } from "./fixtures.js";
import { SESSION_TOKEN, createPhotoHarness, type PhotoHarness } from "./photos-helpers.js";

type Context = {
  app: Express;
  harness: PhotoHarness;
};

function createContext(now?: Date): Context {
  const harness = createPhotoHarness(now ? { now } : {});
  const participants = createParticipantService({
    env: testEnv,
    repository: harness.participantRepository,
    now: () => harness.state.now,
  });
  const photos = createPhotosService({
    env: testEnv,
    repository: harness.repository,
    storage: harness.storage,
    now: () => harness.state.now,
  });

  const app = createApp({
    env: testEnv,
    participants,
    photos,
    checkReadiness: async () => ({ database: "ok", storage: "ok" }),
  });

  return { app, harness };
}

function auth<T extends request.Test>(test: T): T {
  return test.set("Authorization", `Bearer ${SESSION_TOKEN}`) as T;
}

function fileInput(overrides: Record<string, unknown> = {}) {
  return {
    clientFileId: randomUUID(),
    filename: "IMG_0001.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 2048,
    ...overrides,
  };
}

async function intent(
  context: Context,
  files: Array<Record<string, unknown>>,
): Promise<request.Response> {
  return auth(request(context.app).post("/photos/upload-intent")).send({ files });
}

async function reserveAndSeed(context: Context): Promise<{
  sessionId: string;
  uploads: Array<{
    itemId: string;
    clientFileId: string;
    storagePath: string;
    signedUrl: string;
  }>;
}> {
  const response = await intent(context, [fileInput()]);
  expect(response.status).toBe(201);

  for (const upload of response.body.data.uploads as Array<{ storagePath: string }>) {
    context.harness.seedObject(upload.storagePath);
  }

  return response.body.data;
}

describe("fotografías de participantes", () => {
  let context: Context;

  beforeEach(() => {
    context = createContext();
  });

  it("exige una sesión de participante", async () => {
    const response = await request(context.app)
      .post("/photos/upload-intent")
      .send({ files: [fileInput()] });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("crea una intención de carga con rutas y cuota reservada", async () => {
    const files = [fileInput(), fileInput({ filename: "IMG_0002.png", mimeType: "image/png" })];
    const response = await intent(context, files);

    expect(response.status).toBe(201);
    expect(response.body.data.sessionId).toBeTruthy();
    expect(response.body.data.eventDay).toBe("2026-11-15");
    expect(response.body.data.quota).toEqual({ remainingDay: 1, remainingTotal: 10 });
    expect(response.body.data.uploads).toHaveLength(2);

    for (const upload of response.body.data.uploads) {
      expect(upload.signedUrl).toContain("https://upload.test/");
      expect(upload.storagePath).toContain(
        `events/${context.harness.state.event.id}/originals/2026-11-15/${context.harness.state.participant.id}/`,
      );
    }
  });

  it("rechaza una carga que supera la cuota diaria", async () => {
    const response = await intent(context, [fileInput(), fileInput(), fileInput(), fileInput()]);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("QUOTA_EXCEEDED");
    expect(response.body.error.details).toMatchObject({ requested: 4 });
  });

  it("rechaza archivos que superan el tamaño máximo del evento", async () => {
    const response = await intent(context, [
      fileInput({ sizeBytes: context.harness.state.event.maxFileSizeBytes + 1 }),
    ]);

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("no acepta cargas si el evento no está activo", async () => {
    context.harness.state.event.status = "scheduled";

    const response = await intent(context, [fileInput()]);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EVENT_NOT_ACTIVE");
  });

  it("libera la reserva si Storage no puede preparar la subida", async () => {
    context.harness.state.failUploadTarget = true;

    const response = await intent(context, [fileInput()]);

    expect(response.status).toBe(500);
    expect(context.harness.state.releaseCalls).toHaveLength(1);
    expect(context.harness.state.releaseCalls[0]?.reason).toBe("upload_target_failed");
  });

  it("confirma un archivo válido y es idempotente", async () => {
    const data = await reserveAndSeed(context);

    const confirmed = await auth(request(context.app).post("/photos/confirm")).send({
      sessionId: data.sessionId,
      items: data.uploads.map((upload) => ({ itemId: upload.itemId })),
    });

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.session.status).toBe("completed");
    expect(confirmed.body.data.results[0]).toMatchObject({ status: "confirmed" });
    expect(confirmed.body.data.results[0].photoId).toBeTruthy();
    expect(confirmed.body.data.quota.remainingDay).toBe(2);

    const again = await auth(request(context.app).post("/photos/confirm")).send({
      sessionId: data.sessionId,
      items: data.uploads.map((upload) => ({ itemId: upload.itemId })),
    });

    expect(again.status).toBe(200);
    expect(again.body.data.results).toEqual([]);
    expect(context.harness.state.photos.size).toBe(1);
  });

  it("rechaza un archivo cuyo contenido no coincide con el MIME declarado", async () => {
    const data = await reserveAndSeed(context);
    context.harness.seedObject(data.uploads[0]!.storagePath, { mimeType: "image/png" });

    const response = await auth(request(context.app).post("/photos/confirm")).send({
      sessionId: data.sessionId,
      items: data.uploads.map((upload) => ({ itemId: upload.itemId })),
    });

    expect(response.status).toBe(200);
    expect(response.body.data.results[0]).toMatchObject({
      status: "failed",
      error: { code: "INVALID_FILE_TYPE" },
    });
    expect(context.harness.state.photos.size).toBe(0);
    expect(context.harness.state.releaseCalls.at(-1)?.reason).toBe("invalid_file");
  });

  it("falla el ítem cuando el objeto no existe en Storage", async () => {
    const response = await intent(context, [fileInput()]);
    expect(response.status).toBe(201);

    const confirmed = await auth(request(context.app).post("/photos/confirm")).send({
      sessionId: response.body.data.sessionId,
      items: [{ itemId: response.body.data.uploads[0].itemId }],
    });

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.results[0]).toMatchObject({
      status: "failed",
      error: { code: "INVALID_FILE_TYPE" },
    });
  });

  it("detecta duplicados por hash y libera la cuota", async () => {
    const bytes = Buffer.from("foto-duplicada", "utf8");
    context.harness.addPhoto({
      contentHash: createHash("sha256").update(bytes).digest("hex"),
    });

    const data = await reserveAndSeed(context);
    context.harness.seedObject(data.uploads[0]!.storagePath, { bytes });

    const response = await auth(request(context.app).post("/photos/confirm")).send({
      sessionId: data.sessionId,
      items: [{ itemId: data.uploads[0]!.itemId }],
    });

    expect(response.status).toBe(200);
    expect(response.body.data.results[0]).toMatchObject({
      status: "failed",
      error: { code: "DUPLICATE_PHOTO" },
    });
    expect(context.harness.state.photos.size).toBe(1);
    expect(response.body.data.quota.remainingDay).toBe(2);
  });

  it("confirma los válidos aunque otro archivo falle", async () => {
    const response = await intent(context, [fileInput(), fileInput({ filename: "IMG_0002.jpg" })]);
    expect(response.status).toBe(201);

    const uploads = response.body.data.uploads as Array<{ itemId: string; storagePath: string }>;
    context.harness.seedObject(uploads[0]!.storagePath);

    const confirmed = await auth(request(context.app).post("/photos/confirm")).send({
      sessionId: response.body.data.sessionId,
      items: uploads.map((upload) => ({ itemId: upload.itemId })),
    });

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.session.status).toBe("partially_completed");
    expect(confirmed.body.data.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "confirmed" }),
        expect.objectContaining({
          status: "failed",
          error: expect.objectContaining({ code: "INVALID_FILE_TYPE" }),
        }),
      ]),
    );
    expect(context.harness.state.photos.size).toBe(1);
  });

  it("rechaza la confirmación cuando la reserva expiró", async () => {
    const data = await reserveAndSeed(context);
    const session = context.harness.state.sessions.get(data.sessionId);

    if (!session) {
      throw new Error("missing session");
    }

    session.expiresAt = new Date(context.harness.state.now.getTime() - 1000).toISOString();

    const response = await auth(request(context.app).post("/photos/confirm")).send({
      sessionId: data.sessionId,
      items: [{ itemId: data.uploads[0]!.itemId }],
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SESSION_EXPIRED");
    expect(context.harness.state.sessions.get(data.sessionId)?.status).toBe("expired");
  });

  it("libera una sesión pendiente de forma idempotente", async () => {
    const response = await intent(context, [fileInput(), fileInput()]);
    expect(response.status).toBe(201);

    const released = await auth(request(context.app).post("/photos/release")).send({
      sessionId: response.body.data.sessionId,
    });

    expect(released.status).toBe(200);
    expect(released.body.data.releasedNow).toBe(2);
    expect(released.body.data.quota.remainingDay).toBe(3);

    const again = await auth(request(context.app).post("/photos/release")).send({
      sessionId: response.body.data.sessionId,
    });

    expect(again.status).toBe(200);
    expect(again.body.data.releasedNow).toBe(0);
  });

  it("lista solo las fotos activas del participante con URL firmada", async () => {
    const first = context.harness.addPhoto({ originalFilename: "IMG_0001.jpg" });
    context.harness.addPhoto({
      originalFilename: "IMG_0002.jpg",
      status: "deleted",
      deletedAt: context.harness.state.now.toISOString(),
    });
    context.harness.addPhoto({
      originalFilename: "IMG_0003.jpg",
      eventDay: "2026-11-14",
    });

    const response = await auth(request(context.app).get("/photos/mine?page=1&limit=24"));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data.map((photo: { id: string }) => photo.id)).toContain(first.id);
    expect(response.body.data[0].url).toContain("https://storage.test/");
    expect(response.body.meta).toMatchObject({ page: 1, limit: 24, total: 2, totalPages: 1 });

    const filtered = await auth(
      request(context.app).get("/photos/mine?page=1&limit=24&day=2026-11-14"),
    );

    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].originalFilename).toBe("IMG_0003.jpg");
  });

  it("expone el alias GET /participants/me/photos", async () => {
    context.harness.addPhoto();

    const response = await auth(
      request(context.app).get("/participants/me/photos?page=1&limit=24"),
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });

  it("borra una foto propia con soft delete cuando está permitido", async () => {
    const photo = context.harness.addPhoto();

    const response = await auth(request(context.app).delete(`/photos/${photo.id}`));

    expect(response.status).toBe(200);
    expect(response.body.data.deleted).toBe(true);
    expect(context.harness.state.photos.get(photo.id)?.status).toBe("deleted");

    const again = await auth(request(context.app).delete(`/photos/${photo.id}`));

    expect(again.status).toBe(404);
  });

  it("no permite borrar fotos ajenas ni cuando el evento lo prohíbe", async () => {
    const foreign = context.harness.addPhoto({ participantId: randomUUID() });

    const notMine = await auth(request(context.app).delete(`/photos/${foreign.id}`));
    expect(notMine.status).toBe(404);

    context.harness.state.event.allowPhotoDeletion = false;
    const own = context.harness.addPhoto();

    const forbidden = await auth(request(context.app).delete(`/photos/${own.id}`));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });
});
