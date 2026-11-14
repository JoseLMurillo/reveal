import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type Request } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

import type { Env } from "./config/env.js";
import { parseTrustProxy } from "./config/env.js";
import type { AdminServices } from "./modules/admin/index.js";
import type { AlbumsPublicService } from "./modules/albums/index.js";
import type { ParticipantService } from "./modules/participants/index.js";
import type { PhotosService } from "./modules/photos/index.js";
import type { PublicService } from "./modules/public/index.js";
import { createErrorHandler } from "./middlewares/error-handler.js";
import { notFound } from "./middlewares/not-found.js";
import { requestId } from "./middlewares/request-id.js";
import { createRoutes } from "./routes/index.js";
import type { ReadinessCheckResult } from "./services/health.service.js";
import { createLogger } from "./utils/logger.js";

export type AppDependencies = {
  env: Env;
  checkReadiness: () => Promise<ReadinessCheckResult>;
  logger?: Logger;
  admin?: AdminServices;
  public?: PublicService;
  participants?: ParticipantService;
  photos?: PhotosService;
  albums?: AlbumsPublicService;
};

function requestIdOf(req: Request): string {
  return req.requestId;
}

export function createApp({
  env,
  checkReadiness,
  logger,
  admin,
  public: publicService,
  participants,
  photos,
  albums,
}: AppDependencies): Express {
  const log = logger ?? createLogger(env);
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", parseTrustProxy(env.TRUST_PROXY));

  app.use(requestId);
  app.use(
    pinoHttp({
      logger: log,
      genReqId: (req) => requestIdOf(req as Request),
      autoLogging: {
        ignore: (req) => req.url === "/health",
      },
      serializers: {
        req(req) {
          const raw = req.raw as Request;
          return {
            id: raw.requestId,
            method: raw.method,
            url: raw.originalUrl,
          };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) {
          return "error";
        }
        if (res.statusCode >= 400) {
          return "warn";
        }
        return "info";
      },
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        callback(null, origin.replace(/\/+$/, "") === env.FRONTEND_URL);
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "X-Request-Id",
        "X-CSRF-Token",
        "Idempotency-Key",
      ],
      exposedHeaders: ["X-Request-Id"],
      maxAge: 86_400,
      optionsSuccessStatus: 204,
    }),
  );
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "64kb" }));
  app.use(cookieParser());

  app.use(
    createRoutes(env, checkReadiness, {
      admin,
      public: publicService,
      participants,
      photos,
      albums,
    }),
  );

  app.use(notFound);
  app.use(createErrorHandler(env, log));

  return app;
}
