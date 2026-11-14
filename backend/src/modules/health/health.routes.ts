import { Router } from "express";

import { asyncHandler } from "../../utils/async-handler.js";
import { sendData } from "../../utils/http.js";
import type { ReadinessCheckResult } from "../../services/health.service.js";

export type ReadinessCheck = () => Promise<ReadinessCheckResult>;

export function createHealthRouter(checkReadiness: ReadinessCheck): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    sendData(res, {
      status: "ok",
      uptime: Number(process.uptime().toFixed(2)),
    });
  });

  router.get(
    "/ready",
    asyncHandler(async (req, res) => {
      const result = await checkReadiness();
      const ready = result.database === "ok" && result.storage === "ok";

      if (!ready && result.errors) {
        req.log?.warn({ checks: result.errors }, "Health check de dependencias falló");
      }

      res.status(ready ? 200 : 503).json({
        status: ready ? "ready" : "unavailable",
        checks: {
          database: result.database,
          storage: result.storage,
        },
      });
    }),
  );

  return router;
}
