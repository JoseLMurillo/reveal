import { describe, expect, it, vi } from "vitest";

import { createCleanupWorker } from "../src/modules/storage-cleanup/cleanup.worker.js";
import { createStorageCleanupService } from "../src/modules/storage-cleanup/cleanup.service.js";
import type {
  CleanupClaim,
  StorageCleanupRepository,
} from "../src/modules/storage-cleanup/cleanup.repository.js";

function createRepository(claims: CleanupClaim[]): {
  repository: StorageCleanupRepository;
  finished: Array<{ id: number; success: boolean; error: string | null }>;
  expireCalls: number[];
} {
  const finished: Array<{ id: number; success: boolean; error: string | null }> = [];
  const expireCalls: number[] = [];

  return {
    finished,
    expireCalls,
    repository: {
      async claim(limit) {
        const batch = claims.slice(0, limit);
        claims.splice(0, batch.length);
        return batch;
      },
      async finish(id, success, error) {
        finished.push({ id, success, error });
      },
      async expireUploadSessions(limit) {
        expireCalls.push(limit);
        return 1;
      },
    },
  };
}

describe("limpieza de Storage", () => {
  it("elimina los objetos reclamados y cierra la cola", async () => {
    const { repository, finished, expireCalls } = createRepository([
      { id: 1, bucket: "rollo-originals", objectPath: "a.jpg", attempts: 0 },
      { id: 2, bucket: "rollo-originals", objectPath: "b.jpg", attempts: 1 },
    ]);
    const removeObject = vi.fn(async () => undefined);
    const service = createStorageCleanupService({ repository, removeObject });

    const result = await service.runOnce();

    expect(result).toEqual({ claimed: 2, removed: 2, failed: 0, expiredSessions: 1 });
    expect(expireCalls).toEqual([200]);
    expect(removeObject).toHaveBeenCalledTimes(2);
    expect(finished).toEqual([
      { id: 1, success: true, error: null },
      { id: 2, success: true, error: null },
    ]);
  });

  it("registra el fallo sin detener el resto de la cola", async () => {
    const { repository, finished } = createRepository([
      { id: 1, bucket: "rollo-originals", objectPath: "a.jpg", attempts: 0 },
      { id: 2, bucket: "rollo-originals", objectPath: "b.jpg", attempts: 0 },
    ]);
    const removeObject = vi.fn(async (_bucket: string, path: string) => {
      if (path === "a.jpg") {
        throw new Error("Storage no disponible");
      }
    });
    const service = createStorageCleanupService({ repository, removeObject });

    const result = await service.runOnce();

    expect(result).toEqual({ claimed: 2, removed: 1, failed: 1, expiredSessions: 1 });
    expect(finished).toEqual([
      { id: 1, success: false, error: "Storage no disponible" },
      { id: 2, success: true, error: null },
    ]);
  });

  it("no solapa ejecuciones simultáneas", async () => {
    const { repository } = createRepository([
      { id: 1, bucket: "rollo-originals", objectPath: "a.jpg", attempts: 0 },
    ]);
    let releaseRemove: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseRemove = resolve;
    });
    const removeObject = vi.fn(() => gate);
    const service = createStorageCleanupService({ repository, removeObject });

    const first = service.runOnce();
    const second = await service.runOnce();

    expect(second).toEqual({ claimed: 0, removed: 0, failed: 0, expiredSessions: 0 });

    releaseRemove();
    await first;
  });

  it("el worker ejecuta la limpieza y registra el resultado", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const service = {
      runOnce: vi.fn(async () => ({
        claimed: 1,
        removed: 1,
        failed: 0,
        expiredSessions: 0,
      })),
    };
    const worker = createCleanupWorker({
      service,
      intervalSeconds: 60,
      logger,
      runOnStart: false,
    });

    await worker.runNow();

    expect(service.runOnce).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ claimed: 1, removed: 1 }),
      "Limpieza de Storage completada.",
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("el worker captura los errores sin lanzar", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const service = {
      runOnce: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const worker = createCleanupWorker({
      service,
      intervalSeconds: 60,
      logger,
      runOnStart: false,
    });

    await expect(worker.runNow()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith({ error: "boom" }, "La limpieza de Storage falló.");
  });
});
