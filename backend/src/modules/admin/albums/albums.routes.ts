import { Router } from "express";

import { asyncHandler } from "../../../utils/async-handler.js";
import { createAdminAlbumsController } from "./albums.controller.js";
import type { AdminAlbumsService } from "./albums.service.js";

export function createAdminAlbumsRouter(service: AdminAlbumsService): Router {
  const router = Router();
  const controller = createAdminAlbumsController(service);

  router.get("/events/:id/album", asyncHandler(controller.detail));
  router.post("/events/:id/album", asyncHandler(controller.generate));
  router.patch("/events/:id/album", asyncHandler(controller.update));
  router.get("/events/:id/export/zip", asyncHandler(controller.download));

  return router;
}
