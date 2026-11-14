import type { Server } from "node:http";

import { createApp } from "./app.js";
import { loadEnv, type Env } from "./config/env.js";
import { createSupabaseAdminClient } from "./config/supabase.js";
import { createAdminServices } from "./modules/admin/index.js";
import { createAlbumsPublicModule } from "./modules/albums/index.js";
import { createParticipantModule } from "./modules/participants/index.js";
import { createPhotosModule } from "./modules/photos/index.js";
import { createPublicModule } from "./modules/public/index.js";
import {
  createCleanupWorker,
  createStorageCleanupModule,
} from "./modules/storage-cleanup/index.js";
import { checkSupabaseReadiness } from "./services/health.service.js";
import { createLogger } from "./utils/logger.js";

function bootstrap(): void {
  let env: Env;
  try {
    env = loadEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }

  const logger = createLogger(env);
  const supabase = createSupabaseAdminClient(env);
  const admin = createAdminServices(env, supabase);
  const publicService = createPublicModule(env, supabase);
  const participants = createParticipantModule(env, supabase);
  const photos = createPhotosModule(env, supabase);
  const albums = createAlbumsPublicModule(env, supabase);
  const cleanup = createStorageCleanupModule(env, supabase);
  const cleanupWorker = createCleanupWorker({
    service: cleanup,
    intervalSeconds: env.CLEANUP_INTERVAL_SECONDS,
    logger,
  });

  const app = createApp({
    env,
    logger,
    admin,
    public: publicService,
    participants,
    photos,
    albums,
    checkReadiness: () => checkSupabaseReadiness(supabase, env.SUPABASE_STORAGE_BUCKET),
  });

  let server: Server;
  try {
    server = app.listen(env.PORT, () => {
      cleanupWorker.start();
      logger.info({ port: env.PORT, env: env.NODE_ENV }, "API de Rollo escuchando");
    });
  } catch (error) {
    logger.fatal({ err: error }, "No se pudo iniciar el servidor");
    process.exit(1);
  }

  let shuttingDown = false;

  const shutdown = (reason: string, exitCode = 0): void => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info({ reason }, "Cerrando servidor");
    cleanupWorker.stop();

    const forceExit = setTimeout(() => {
      logger.error("Cierre forzado: el servidor no terminó a tiempo");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close((error) => {
      clearTimeout(forceExit);

      if (error) {
        logger.error({ err: error }, "Error al cerrar el servidor");
        process.exit(1);
      }

      logger.info("Servidor cerrado correctamente");
      process.exit(exitCode);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (error) => {
    logger.fatal({ err: error }, "Promesa rechazada sin manejar");
    shutdown("unhandledRejection", 1);
  });
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Excepción no capturada");
    shutdown("uncaughtException", 1);
  });

  server.on("error", (error) => {
    logger.fatal({ err: error }, "Error del servidor HTTP");
    shutdown("server-error", 1);
  });
}

bootstrap();
