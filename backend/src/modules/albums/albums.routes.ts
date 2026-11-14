import { Router } from "express";
import { ipKeyGenerator } from "express-rate-limit";

import type { Env } from "../../config/env.js";
import { createAuthParticipant } from "../../middlewares/auth-participant.js";
import { createOptionalAuthParticipant } from "../../middlewares/optional-auth-participant.js";
import { createRateLimiter } from "../../middlewares/rate-limit.js";
import { asyncHandler } from "../../utils/async-handler.js";
import type { ParticipantService } from "../participants/participants.service.js";
import { createAlbumsPublicController } from "./albums.controller.js";
import type { AlbumsPublicService } from "./albums.service.js";

export function createAlbumsPublicRouter(
  _env: Env,
  service: AlbumsPublicService,
  participants: ParticipantService,
): Router {
  const router = Router();
  const controller = createAlbumsPublicController(service);
  const optionalAuth = createOptionalAuthParticipant(participants);
  const requiredAuth = createAuthParticipant(participants);

  router.get("/events/:slug/gallery", optionalAuth, asyncHandler(controller.gallery));
  router.get("/albums/:slug", asyncHandler(controller.album));
  router.get("/events/:slug/vote", requiredAuth, asyncHandler(controller.voteFeed));

  return router;
}

export function createPhotoVotesRouter(
  env: Env,
  service: AlbumsPublicService,
  participants: ParticipantService,
): Router {
  const router = Router();
  const controller = createAlbumsPublicController(service);
  const voteLimiter = createRateLimiter(env, {
    windowMs: 60 * 1000,
    limit: 120,
    message: "Demasiados votos seguidos. Espera un momento.",
    keyGenerator: (req) => req.participant?.participant.id ?? ipKeyGenerator(req.ip ?? "unknown"),
  });

  router.post(
    "/:id/vote",
    createAuthParticipant(participants),
    voteLimiter,
    asyncHandler(controller.vote),
  );

  return router;
}
