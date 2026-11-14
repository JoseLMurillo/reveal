import { Router } from "express";

import { createAuthParticipant } from "../../middlewares/auth-participant.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { createParticipantController } from "./participants.controller.js";
import type { ParticipantService } from "./participants.service.js";

export function createParticipantRouter(service: ParticipantService): Router {
  const router = Router();
  const controller = createParticipantController(service);

  router.use(createAuthParticipant(service));

  router.get("/me", asyncHandler(controller.me));
  router.patch("/me", asyncHandler(controller.updateMe));
  router.get("/me/quota", asyncHandler(controller.quota));

  return router;
}
