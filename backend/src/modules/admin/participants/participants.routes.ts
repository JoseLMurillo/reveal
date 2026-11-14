import { Router } from "express";
import { ipKeyGenerator } from "express-rate-limit";

import type { Env } from "../../../config/env.js";
import { createRateLimiter } from "../../../middlewares/rate-limit.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import { createAdminParticipantsController } from "./participants.controller.js";
import type { AdminParticipantsService } from "./participants.service.js";

export function createAdminParticipantsRouter(env: Env, service: AdminParticipantsService): Router {
  const router = Router();
  const controller = createAdminParticipantsController(service);

  const createLimiter = createRateLimiter(env, {
    windowMs: 60 * 1000,
    limit: 30,
    message: "Has creado demasiados participantes. Espera un minuto y vuelve a intentarlo.",
    keyGenerator: (req) => (req.admin ? req.admin.admin.id : ipKeyGenerator(req.ip ?? "unknown")),
  });

  router.get("/events/:id/participants", asyncHandler(controller.list));
  router.post("/events/:id/participants", createLimiter, asyncHandler(controller.create));
  router.post("/events/:id/participants/bulk", createLimiter, asyncHandler(controller.bulkCreate));

  router.patch("/participants/:participantId", asyncHandler(controller.update));
  router.post(
    "/participants/:participantId/access-code/regenerate",
    asyncHandler(controller.regenerateAccessCode),
  );
  router.post(
    "/participants/:participantId/access-code/revoke",
    asyncHandler(controller.revokeAccessCode),
  );

  return router;
}
