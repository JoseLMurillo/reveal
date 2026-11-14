import type { StorageCleanupService } from "./cleanup.service.js";

export type CleanupWorkerLogger = {
  info: (details: Record<string, unknown>, message: string) => void;
  error: (details: Record<string, unknown>, message: string) => void;
};

export type CleanupWorker = {
  start(): void;
  stop(): void;
  runNow(): Promise<void>;
};

export function createCleanupWorker(deps: {
  service: StorageCleanupService;
  intervalSeconds: number;
  logger: CleanupWorkerLogger;
  runOnStart?: boolean;
}): CleanupWorker {
  let timer: NodeJS.Timeout | null = null;
  let active = false;

  async function execute(): Promise<void> {
    if (active) {
      return;
    }

    active = true;

    try {
      const result = await deps.service.runOnce();
      deps.logger.info(
        {
          claimed: result.claimed,
          removed: result.removed,
          failed: result.failed,
          expiredSessions: result.expiredSessions,
        },
        "Limpieza de Storage completada.",
      );
    } catch (error) {
      deps.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "La limpieza de Storage falló.",
      );
    } finally {
      active = false;
    }
  }

  return {
    start() {
      if (timer) {
        return;
      }

      if (deps.runOnStart ?? true) {
        void execute();
      }

      timer = setInterval(
        () => {
          void execute();
        },
        Math.max(deps.intervalSeconds, 60) * 1000,
      );
      timer.unref();
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },

    runNow: execute,
  };
}
