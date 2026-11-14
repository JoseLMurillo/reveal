import type { Request, Response } from "express";

import { sendData } from "../../../utils/http.js";
import { currentAdmin } from "../shared/current-admin.js";
import type { DashboardService } from "./dashboard.service.js";

export function createDashboardController(dashboard: DashboardService) {
  return {
    async get(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      sendData(res, await dashboard.get(admin));
    },
  };
}
