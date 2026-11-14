import type { StorageCleanupRepository } from "./cleanup.repository.js";

export type CleanupRunResult = {
  claimed: number;
  removed: number;
  failed: number;
  expiredSessions: number;
};

export type StorageCleanupService = {
  runOnce(limit?: number): Promise<CleanupRunResult>;
};

export function createStorageCleanupService(deps: {
  repository: StorageCleanupRepository;
  removeObject(bucket: string, path: string): Promise<void>;
  sessionLimit?: number;
  claimLimit?: number;
}): StorageCleanupService {
  const sessionLimit = deps.sessionLimit ?? 200;
  const claimLimit = deps.claimLimit ?? 50;
  let running = false;

  return {
    async runOnce(limit = claimLimit) {
      if (running) {
        return { claimed: 0, removed: 0, failed: 0, expiredSessions: 0 };
      }

      running = true;

      try {
        const expiredSessions = await deps.repository.expireUploadSessions(sessionLimit);
        const claims = await deps.repository.claim(limit);
        let removed = 0;
        let failed = 0;

        for (const claim of claims) {
          try {
            await deps.removeObject(claim.bucket, claim.objectPath);
            await deps.repository.finish(claim.id, true, null);
            removed += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await deps.repository.finish(claim.id, false, message).catch(() => undefined);
            failed += 1;
          }
        }

        return { claimed: claims.length, removed, failed, expiredSessions };
      } finally {
        running = false;
      }
    },
  };
}
