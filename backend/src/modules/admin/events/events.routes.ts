import { Router } from "express";

import { asyncHandler } from "../../../utils/async-handler.js";
import type { EventsService } from "./events.service.js";
import { createEventsController } from "./events.controller.js";

export function createEventsRouter(events: EventsService): Router {
  const router = Router();
  const controller = createEventsController(events);

  router.get("/", asyncHandler(controller.list));
  router.post("/", asyncHandler(controller.create));

  router.get("/:id", asyncHandler(controller.detail));
  router.patch("/:id", asyncHandler(controller.update));
  router.delete("/:id", asyncHandler(controller.remove));

  router.post("/:id/schedule", asyncHandler(controller.schedule));
  router.post("/:id/activate", asyncHandler(controller.activate));
  router.post("/:id/finish", asyncHandler(controller.finish));
  router.post("/:id/cancel", asyncHandler(controller.cancel));
  router.post("/:id/duplicate", asyncHandler(controller.duplicate));

  router.post("/:id/cover/upload-intent", asyncHandler(controller.coverIntent));
  router.post("/:id/cover/confirm", asyncHandler(controller.confirmCover));
  router.delete("/:id/cover", asyncHandler(controller.deleteCover));

  router.get("/:id/qr", asyncHandler(controller.qr));

  return router;
}
