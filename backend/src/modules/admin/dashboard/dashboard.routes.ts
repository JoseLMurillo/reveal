import { Router } from "express";

import { asyncHandler } from "../../../utils/async-handler.js";
import type { DashboardService } from "./dashboard.service.js";
import { createDashboardController } from "./dashboard.controller.js";

export function createDashboardRouter(dashboard: DashboardService): Router {
  const router = Router();
  const controller = createDashboardController(dashboard);

  router.get("/", asyncHandler(controller.get));

  return router;
}
