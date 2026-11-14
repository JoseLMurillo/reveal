import { Router } from "express";

import { asyncHandler } from "../../../utils/async-handler.js";
import { createAdminPhotosController } from "./photos.controller.js";
import type { AdminPhotosService } from "./photos.service.js";

export function createAdminPhotosRouter(service: AdminPhotosService): Router {
  const router = Router();
  const controller = createAdminPhotosController(service);

  router.get("/events/:id/photos", asyncHandler(controller.list));
  router.get("/events/:id/statistics", asyncHandler(controller.stats));
  router.get("/events/:id/activity", asyncHandler(controller.activity));
  router.get("/events/:eventId/photos/:photoId/download", asyncHandler(controller.download));
  router.delete("/photos/:id", asyncHandler(controller.remove));

  return router;
}
