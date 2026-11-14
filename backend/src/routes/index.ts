import { Router } from "express";

import type { Env } from "../config/env.js";
import { createAuthParticipant } from "../middlewares/auth-participant.js";
import { createAdminRouter, type AdminServices } from "../modules/admin/index.js";
import {
  createAlbumsPublicRouter,
  createPhotoVotesRouter,
  type AlbumsPublicService,
} from "../modules/albums/index.js";
import { createHealthRouter, type ReadinessCheck } from "../modules/health/health.routes.js";
import { createParticipantRouter, type ParticipantService } from "../modules/participants/index.js";
import { createPhotosRouter, type PhotosService } from "../modules/photos/index.js";
import { createPhotosController } from "../modules/photos/photos.controller.js";
import { createPublicRouter, type PublicService } from "../modules/public/index.js";
import { asyncHandler } from "../utils/async-handler.js";

export type DomainServices = {
  admin?: AdminServices;
  public?: PublicService;
  participants?: ParticipantService;
  photos?: PhotosService;
  albums?: AlbumsPublicService;
};

export function createRoutes(
  env: Env,
  checkReadiness: ReadinessCheck,
  services: DomainServices = {},
): Router {
  const router = Router();

  router.use("/health", createHealthRouter(checkReadiness));

  if (services.public) {
    router.use("/public", createPublicRouter(env, services.public));
  }

  if (services.albums && services.participants) {
    router.use("/public", createAlbumsPublicRouter(env, services.albums, services.participants));
    router.use("/photos", createPhotoVotesRouter(env, services.albums, services.participants));
  }

  if (services.participants) {
    // Alias documentado de GET /photos/mine.
    if (services.photos) {
      const photosController = createPhotosController(services.photos);
      router.get(
        "/participants/me/photos",
        createAuthParticipant(services.participants),
        asyncHandler(photosController.listMine),
      );
    }

    router.use("/participants", createParticipantRouter(services.participants));
  }

  if (services.photos && services.participants) {
    router.use("/photos", createPhotosRouter(env, services.photos, services.participants));
  }

  if (services.admin) {
    router.use("/admin", createAdminRouter(env, services.admin));
  }

  return router;
}
