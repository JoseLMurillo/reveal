import { Buffer } from "node:buffer";

import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testEnv } from "./fixtures.js";
import { TOKEN_ANA, createAlbumHarness, type AlbumHarness } from "./albums-helpers.js";

const PASSWORD = "correct horse battery staple";

type Context = {
  app: Express;
  harness: AlbumHarness;
  firstDay: string;
  secondDay: string;
};

function createContext(harness: AlbumHarness): Context {
  const app = createApp({
    env: testEnv,
    admin: harness.admin,
    participants: harness.participants,
    albums: harness.albums,
    checkReadiness: async () => ({ database: "ok", storage: "ok" }),
  });

  return {
    app,
    harness,
    firstDay: harness.event.startDate,
    secondDay: harness.event.endDate,
  };
}

async function login(app: Express): Promise<{
  agent: ReturnType<typeof request.agent>;
  csrf: string;
}> {
  const agent = request.agent(app);
  const response = await agent.post("/admin/auth/login").send({
    email: "admin@rollo.test",
    password: PASSWORD,
  });

  if (response.status !== 200) {
    throw new Error(`Login falló: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return { agent, csrf: response.body.data.csrfToken as string };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function binaryParser(
  response: unknown,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const stream = response as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  stream.on("end", () => callback(null, Buffer.concat(chunks)));
  stream.on("error", (error) => callback(error, Buffer.alloc(0)));
}

async function generateAlbum(
  context: Context,
  input: Record<string, unknown> = {},
): Promise<request.Response> {
  const { agent, csrf } = await login(context.app);

  return agent
    .post(`/admin/events/${context.harness.event.id}/album`)
    .set("x-csrf-token", csrf)
    .send(input);
}

describe("álbum y galería", () => {
  let harness: AlbumHarness;
  let context: Context;

  beforeEach(async () => {
    harness = await createAlbumHarness();
    context = createContext(harness);
  });

  it("exige fotos confirmadas para generar el álbum", async () => {
    const response = await generateAlbum(context);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("NO_PHOTOS");
  });

  it("genera un snapshot por días, con portada y estadísticas", async () => {
    const first = harness.addPhoto({ participant: harness.ana, day: context.firstDay });
    harness.addPhoto({ participant: harness.beto, day: context.firstDay });
    harness.addPhoto({ participant: harness.beto, day: context.secondDay });

    const response = await generateAlbum(context, {
      title: "Los mejores momentos",
      subtitle: "Un fin de semana para recordar.",
      visibility: "public",
      coverPhotoId: first.id,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.album).toMatchObject({
      slug: "los-mejores-momentos",
      title: "Los mejores momentos",
      subtitle: "Un fin de semana para recordar.",
      status: "draft",
      visibility: "public",
      coverPhotoId: first.id,
    });
    expect(response.body.data.days).toHaveLength(2);
    expect(response.body.data.days[0].photos).toHaveLength(2);
    expect(response.body.data.stats).toEqual({
      totalPhotos: 3,
      totalParticipants: 2,
      totalDays: 2,
    });
    expect(response.body.data.album.coverUrl).toContain("https://storage.test/");
    expect(harness.state.audit.at(-1)?.action).toBe("album.generated");
  });

  it("regenera conservando el slug y actualiza el snapshot", async () => {
    harness.addPhoto({ participant: harness.ana, day: context.firstDay });
    const first = await generateAlbum(context, { title: "Álbum de Ana" });
    const slug = first.body.data.album.slug as string;

    harness.addPhoto({ participant: harness.beto, day: context.secondDay });
    const { agent, csrf } = await login(context.app);
    const regenerated = await agent
      .post(`/admin/events/${harness.event.id}/album`)
      .set("x-csrf-token", csrf)
      .send({ title: "Álbum de Ana y Beto" });

    expect(regenerated.status).toBe(200);
    expect(regenerated.body.data.album.slug).toBe(slug);
    expect(regenerated.body.data.album.title).toBe("Álbum de Ana y Beto");
    expect(regenerated.body.data.stats.totalPhotos).toBe(2);
    expect(harness.state.audit.at(-1)?.action).toBe("album.regenerated");
  });

  it("publica, despublica y respeta la privacidad del álbum", async () => {
    harness.addPhoto({ participant: harness.ana, day: context.firstDay });
    const generated = await generateAlbum(context, { visibility: "public" });
    const slug = generated.body.data.album.slug as string;
    const { agent, csrf } = await login(context.app);
    const eventId = harness.event.id;

    const hiddenDraft = await request(context.app).get(`/public/albums/${slug}`);
    expect(hiddenDraft.status).toBe(404);

    const published = await agent
      .patch(`/admin/events/${eventId}/album`)
      .set("x-csrf-token", csrf)
      .send({ status: "published" });

    expect(published.status).toBe(200);
    expect(published.body.data.album.status).toBe("published");
    expect(published.body.data.album.publishedAt).toBeTruthy();

    const publicAlbum = await request(context.app).get(`/public/albums/${slug}`);
    expect(publicAlbum.status).toBe(200);
    expect(publicAlbum.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(publicAlbum.headers["cache-control"]).toBe("no-store");
    expect(publicAlbum.body.data.album.eventSlug).toBe(harness.event.slug);
    expect(publicAlbum.body.data.album.eventName).toBe(harness.event.name);
    expect(publicAlbum.body.data.days).toHaveLength(1);
    expect(publicAlbum.body.data.days[0].photos[0].author).toEqual({
      displayName: "Ana",
    });

    const unpublished = await agent
      .patch(`/admin/events/${eventId}/album`)
      .set("x-csrf-token", csrf)
      .send({ status: "draft" });

    expect(unpublished.body.data.album.status).toBe("draft");
    expect(unpublished.body.data.album.publishedAt).toBeNull();

    const hiddenAgain = await request(context.app).get(`/public/albums/${slug}`);
    expect(hiddenAgain.status).toBe(404);
  });

  it("oculta los nombres en el álbum cuando el evento lo configura", async () => {
    harness.event.showParticipantNames = false;
    harness.addPhoto({ participant: harness.ana, day: context.firstDay });
    const generated = await generateAlbum(context, { visibility: "public" });
    const slug = generated.body.data.album.slug as string;
    const { agent, csrf } = await login(context.app);

    await agent
      .patch(`/admin/events/${harness.event.id}/album`)
      .set("x-csrf-token", csrf)
      .send({ status: "published" });

    const response = await request(context.app).get(`/public/albums/${slug}`);
    expect(response.status).toBe(200);
    expect(response.body.data.days[0].photos[0].author).toBeNull();
  });

  it("aplica la visibilidad de la galería en el servidor", async () => {
    harness.addPhoto({ participant: harness.ana, day: context.firstDay });
    const slug = harness.event.slug;

    const participantsAnonymous = await request(context.app).get(`/public/events/${slug}/gallery`);
    expect(participantsAnonymous.status).toBe(403);

    const participantsAuth = await request(context.app)
      .get(`/public/events/${slug}/gallery`)
      .set(auth(TOKEN_ANA));
    expect(participantsAuth.status).toBe(200);
    expect(participantsAuth.body.data.days).toHaveLength(1);
    expect(participantsAuth.body.data.days[0].photos[0].author).toEqual({
      displayName: "Ana",
    });

    harness.event.galleryVisibility = "private";
    const privateResponse = await request(context.app)
      .get(`/public/events/${slug}/gallery`)
      .set(auth(TOKEN_ANA));
    expect(privateResponse.status).toBe(403);

    harness.event.galleryVisibility = "public";
    harness.event.showParticipantNames = false;
    const publicResponse = await request(context.app).get(`/public/events/${slug}/gallery`);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.data.days[0].photos[0].author).toBeNull();
  });

  it("exporta un ZIP con los originales sin usar disco local", async () => {
    const first = harness.addPhoto({
      participant: harness.ana,
      day: context.firstDay,
      filename: "IMG_0001.jpg",
      bytes: Buffer.from("contenido-foto-uno"),
    });
    harness.addPhoto({
      participant: harness.beto,
      day: context.firstDay,
      filename: "IMG_0002.jpg",
      bytes: Buffer.from("contenido-foto-dos"),
    });
    expect(first.storagePath).toContain("/originals/");

    const { agent, csrf } = await login(context.app);
    const response = await agent
      .get(`/admin/events/${harness.event.id}/export/zip`)
      .set("x-csrf-token", csrf)
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/zip");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["x-export-count"]).toBe("2");
    expect(response.body.subarray(0, 2).toString("utf8")).toBe("PK");
  });

  it("filtra el ZIP por día y rechaza exportaciones vacías", async () => {
    harness.addPhoto({ participant: harness.ana, day: context.firstDay });
    harness.addPhoto({ participant: harness.beto, day: context.secondDay });
    const { agent, csrf } = await login(context.app);

    const filtered = await agent
      .get(`/admin/events/${harness.event.id}/export/zip?day=${context.secondDay}`)
      .set("x-csrf-token", csrf)
      .buffer(true)
      .parse(binaryParser);

    expect(filtered.status).toBe(200);
    expect(filtered.headers["x-export-count"]).toBe("1");

    const emptyDay = await agent
      .get("/admin/events/" + harness.event.id + "/export/zip?day=1999-01-01")
      .set("x-csrf-token", csrf);
    expect(emptyDay.status).toBe(409);
    expect(emptyDay.body.error.code).toBe("NO_PHOTOS");
  });
});

describe("votación anónima", () => {
  let harness: AlbumHarness;
  let context: Context;

  beforeEach(async () => {
    harness = await createAlbumHarness();
    context = createContext(harness);
  });

  it("exige sesión de participante para votar y consultar la votación", async () => {
    const feed = await request(context.app).get(`/public/events/${harness.event.slug}/vote`);
    expect(feed.status).toBe(401);

    const vote = await request(context.app)
      .post(`/photos/${crypto.randomUUID()}/vote`)
      .send({ value: "like" });
    expect(vote.status).toBe(401);
  });

  it("muestra un feed sin las fotos propias ni las ya votadas", async () => {
    const own = harness.addPhoto({ participant: harness.ana, day: context.firstDay });
    const betoPhoto = harness.addPhoto({
      participant: harness.beto,
      day: context.firstDay,
    });
    harness.addPhoto({ participant: harness.beto, day: context.secondDay });

    const response = await request(context.app)
      .get(`/public/events/${harness.event.slug}/vote?day=${context.firstDay}`)
      .set(auth(TOKEN_ANA));

    expect(response.status).toBe(200);
    expect(response.body.data.selectedDay).toBe(context.firstDay);
    expect(response.body.data.days).toHaveLength(2);
    expect(response.body.data.photos).toHaveLength(1);
    expect(response.body.data.photos[0].id).toBe(betoPhoto.id);
    expect(response.body.data.photos.map((photo: { id: string }) => photo.id)).not.toContain(
      own.id,
    );
    expect(response.body.data.results).toEqual([]);
    expect(response.body.data.counts).toEqual({ liked: 0, disliked: 0, remaining: 1 });
  });

  it("registra me gusta y no me gusta, actualiza el ranking y es idempotente", async () => {
    const liked = harness.addPhoto({ participant: harness.beto, day: context.firstDay });
    const disliked = harness.addPhoto({ participant: harness.beto, day: context.firstDay });

    const like = await request(context.app)
      .post(`/photos/${liked.id}/vote`)
      .set(auth(TOKEN_ANA))
      .send({ value: "like" });

    expect(like.status).toBe(200);
    expect(like.body.data).toEqual({
      photoId: liked.id,
      value: "like",
      likes: 1,
      dislikes: 0,
    });
    expect(JSON.stringify(like.body.data)).not.toContain(harness.ana.id);

    await request(context.app)
      .post(`/photos/${disliked.id}/vote`)
      .set(auth(TOKEN_ANA))
      .send({ value: "dislike" });

    const again = await request(context.app)
      .post(`/photos/${liked.id}/vote`)
      .set(auth(TOKEN_ANA))
      .send({ value: "like" });

    expect(again.body.data.likes).toBe(1);
    expect(harness.state.photoVotes.size).toBe(2);

    const feed = await request(context.app)
      .get(`/public/events/${harness.event.slug}/vote?day=${context.firstDay}`)
      .set(auth(TOKEN_ANA));

    expect(feed.body.data.photos).toEqual([]);
    expect(feed.body.data.results).toHaveLength(1);
    expect(feed.body.data.results[0]).toMatchObject({ id: liked.id, likes: 1 });
    expect(feed.body.data.counts).toEqual({ liked: 1, disliked: 1, remaining: 0 });
  });

  it("no permite votar por la propia foto ni por fotos borradas", async () => {
    const own = harness.addPhoto({ participant: harness.ana, day: context.firstDay });
    const deleted = harness.addPhoto({
      participant: harness.beto,
      day: context.firstDay,
      status: "deleted",
    });

    const ownVote = await request(context.app)
      .post(`/photos/${own.id}/vote`)
      .set(auth(TOKEN_ANA))
      .send({ value: "like" });
    expect(ownVote.status).toBe(403);

    const deletedVote = await request(context.app)
      .post(`/photos/${deleted.id}/vote`)
      .set(auth(TOKEN_ANA))
      .send({ value: "like" });
    expect(deletedVote.status).toBe(404);
  });

  it("separa los votos por día y por participante", async () => {
    const firstPhoto = harness.addPhoto({
      participant: harness.beto,
      day: context.firstDay,
    });
    const secondPhoto = harness.addPhoto({
      participant: harness.beto,
      day: context.secondDay,
    });

    await request(context.app)
      .post(`/photos/${firstPhoto.id}/vote`)
      .set(auth(TOKEN_ANA))
      .send({ value: "like" });
    await request(context.app)
      .post(`/photos/${secondPhoto.id}/vote`)
      .set(auth(TOKEN_ANA))
      .send({ value: "like" });

    const firstDay = await request(context.app)
      .get(`/public/events/${harness.event.slug}/vote?day=${context.firstDay}`)
      .set(auth(TOKEN_ANA));
    const secondDay = await request(context.app)
      .get(`/public/events/${harness.event.slug}/vote?day=${context.secondDay}`)
      .set(auth(TOKEN_ANA));

    expect(firstDay.body.data.results[0].id).toBe(firstPhoto.id);
    expect(secondDay.body.data.results[0].id).toBe(secondPhoto.id);
    expect(firstDay.body.data.results[0].likes).toBe(1);
    expect(secondDay.body.data.results[0].likes).toBe(1);
  });
});
