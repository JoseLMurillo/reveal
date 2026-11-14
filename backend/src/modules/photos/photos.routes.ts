import { Router } from "express";
import { ipKeyGenerator } from "express-rate-limit";

import type { Env } from "../../config/env.js";
import { createAuthParticipant } from "../../middlewares/auth-participant.js";
import { createRateLimiter } from "../../middlewares/rate-limit.js";
import { asyncHandler } from "../../utils/async-handler.js";
import type { ParticipantService } from "../participants/participants.service.js";
import { createPhotosController } from "./photos.controller.js";
import type { PhotosService } from "./photos.service.js";

export function createPhotosRouter(
  env: Env,
  service: PhotosService,
  participants: ParticipantService,
): Router {
  const router = Router();
  const controller = createPhotosController(service);

  const uploadLimiter = createRateLimiter(env, {
    windowMs: 60 * 1000,
    limit: 10,
    message: "Has solicitado demasiadas cargas. Espera un minuto y vuelve a intentarlo.",
    keyGenerator: (req) => req.participant?.participant.id ?? ipKeyGenerator(req.ip ?? "unknown"),
  });

  router.use(createAuthParticipant(participants));

  router.post("/upload-intent", uploadLimiter, asyncHandler(controller.uploadIntent));
  router.post("/confirm", asyncHandler(controller.confirm));
  router.post("/release", asyncHandler(controller.release));
  router.get("/mine", asyncHandler(controller.listMine));
  router.delete("/:id", asyncHandler(controller.deleteMine));

  return router;
}
