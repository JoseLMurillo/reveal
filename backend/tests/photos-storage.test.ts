import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { AppError } from "../src/errors/app-error.js";
import {
  createSupabasePhotoStorageService,
  isOriginalPathFor,
  originalPathFor,
  type OriginalLocation,
} from "../src/modules/photos/photos.storage.js";
import { testEnv } from "./fixtures.js";

function createStorageClient(objects: Map<string, Buffer>): {
  client: SupabaseClient;
  removed: string[];
} {
  const removed: string[] = [];

  const client = {
    storage: {
      from: () => ({
        async download(path: string) {
          const bytes = objects.get(path);

          return bytes
            ? { data: new Blob([new Uint8Array(bytes)]), error: null }
            : { data: null, error: { message: "not found" } };
        },
        async remove(paths: string[]) {
          removed.push(...paths);
          return { error: null };
        },
        async createSignedUrl(path: string) {
          return {
            data: { signedUrl: `https://storage.test/${path}` },
            error: null,
          };
        },
        async createSignedUploadUrl(path: string) {
          return {
            data: { signedUrl: `https://upload.test/${path}`, token: "token" },
            error: null,
          };
        },
      }),
    },
  } as unknown as SupabaseClient;

  return { client, removed };
}

const location: OriginalLocation = {
  eventId: "11111111-1111-4111-8111-111111111111",
  eventDay: "2026-11-13",
  participantId: "22222222-2222-4222-8222-222222222222",
  itemId: "33333333-3333-4333-8333-333333333333",
};

async function image(format: "jpeg" | "png" | "webp"): Promise<Buffer> {
  const pipeline = sharp({
    create: {
      width: 64,
      height: 48,
      channels: 3,
      background: { r: 180, g: 120, b: 70 },
    },
  });

  return pipeline[format]().toBuffer();
}

async function expectAppError(action: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return;
  }

  throw new Error(`Se esperaba el error ${code}`);
}

describe("validación real de originales", () => {
  it("genera rutas inmutables por evento, día, participante e ítem", () => {
    const path = originalPathFor(location, "image/webp");

    expect(path).toBe(
      `events/${location.eventId}/originals/2026-11-13/${location.participantId}/${location.itemId}.webp`,
    );
    expect(isOriginalPathFor(location, path)).toBe(true);
    expect(isOriginalPathFor(location, path.replace(".webp", ".gif"))).toBe(false);
    expect(isOriginalPathFor(location, path.replace(location.eventDay, "2026-11-14"))).toBe(false);
  });

  it("acepta JPEG, PNG y WebP reales y calcula dimensiones y hash", async () => {
    for (const [format, mimeType] of [
      ["jpeg", "image/jpeg"],
      ["png", "image/png"],
      ["webp", "image/webp"],
    ] as const) {
      const bytes = await image(format);
      const path = originalPathFor(location, mimeType);
      const { client, removed } = createStorageClient(new Map([[path, bytes]]));
      const service = createSupabasePhotoStorageService(testEnv, client);

      const result = await service.validateOriginal(location, path, mimeType, 10_485_760);

      expect(result).toMatchObject({
        mimeType,
        fileSize: bytes.length,
        width: 64,
        height: 48,
        contentHash: createHash("sha256").update(bytes).digest("hex"),
      });
      expect(removed).toHaveLength(0);
    }
  });

  it("rechaza un archivo que no es imagen y elimina el objeto", async () => {
    const bytes = Buffer.from("<svg></svg>", "utf8");
    const path = originalPathFor(location, "image/png");
    const { client, removed } = createStorageClient(new Map([[path, bytes]]));
    const service = createSupabasePhotoStorageService(testEnv, client);

    await expectAppError(
      () => service.validateOriginal(location, path, "image/png", 10_485_760),
      "INVALID_FILE_TYPE",
    );
    expect(removed).toEqual([path]);
  });

  it("rechaza un MIME declarado distinto del contenido real", async () => {
    const bytes = await image("png");
    const path = originalPathFor(location, "image/jpeg");
    const { client, removed } = createStorageClient(new Map([[path, bytes]]));
    const service = createSupabasePhotoStorageService(testEnv, client);

    await expectAppError(
      () => service.validateOriginal(location, path, "image/jpeg", 10_485_760),
      "INVALID_FILE_TYPE",
    );
    expect(removed).toEqual([path]);
  });

  it("rechaza objetos ausentes, vacíos o demasiado grandes", async () => {
    const emptyPath = originalPathFor(location, "image/jpeg");
    const empty = createStorageClient(new Map([[emptyPath, Buffer.alloc(0)]]));
    const emptyService = createSupabasePhotoStorageService(testEnv, empty.client);

    await expectAppError(
      () => emptyService.validateOriginal(location, emptyPath, "image/jpeg", 10_485_760),
      "INVALID_FILE_TYPE",
    );

    const missingService = createSupabasePhotoStorageService(
      testEnv,
      createStorageClient(new Map()).client,
    );

    await expectAppError(
      () => missingService.validateOriginal(location, emptyPath, "image/jpeg", 10_485_760),
      "INVALID_FILE_TYPE",
    );

    const bytes = await image("jpeg");
    const path = originalPathFor(location, "image/jpeg");
    const large = createStorageClient(new Map([[path, bytes]]));
    const largeService = createSupabasePhotoStorageService(testEnv, large.client);

    await expectAppError(
      () => largeService.validateOriginal(location, path, "image/jpeg", 10),
      "FILE_TOO_LARGE",
    );
  });

  it("rechaza rutas que no pertenecen a la carga", async () => {
    const bytes = await image("jpeg");
    const path = originalPathFor(location, "image/jpeg");
    const { client } = createStorageClient(new Map([[path, bytes]]));
    const service = createSupabasePhotoStorageService(testEnv, client);

    await expectAppError(
      () =>
        service.validateOriginal(
          { ...location, itemId: "44444444-4444-4444-8444-444444444444" },
          path,
          "image/jpeg",
          10_485_760,
        ),
      "VALIDATION_ERROR",
    );
  });

  it("prepara URLs firmadas de subida y descarga", async () => {
    const path = originalPathFor(location, "image/jpeg");
    const { client } = createStorageClient(new Map());
    const service = createSupabasePhotoStorageService(testEnv, client);

    const target = await service.createUploadTarget(path);
    expect(target.signedUrl).toBe(`https://upload.test/${path}`);
    expect(target.token).toBe("token");
    expect(new Date(target.expiresAt).getTime()).toBeGreaterThan(Date.now());

    await expect(service.createSignedUrl(path, "foto.jpg")).resolves.toContain(
      "https://storage.test/",
    );
  });
});
