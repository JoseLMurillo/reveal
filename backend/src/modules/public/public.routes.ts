import { Router } from "express";
import { ipKeyGenerator } from "express-rate-limit";

import type { Env } from "../../config/env.js";
import { createRateLimiter } from "../../middlewares/rate-limit.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { createPublicController } from "./public.controller.js";
import type { PublicService } from "./public.service.js";

export function createPublicRouter(env: Env, service: PublicService): Router {
  const router = Router();
  const controller = createPublicController(service);

  const redeemLimiter = createRateLimiter(env, {
    windowMs: 10 * 60 * 1000,
    limit: 10,
    keyGenerator: (req) =>
      `${ipKeyGenerator(req.ip ?? "unknown")}:${String(req.params.slug ?? "")}`,
  });

  const registerLimiter = createRateLimiter(env, {
    windowMs: 10 * 60 * 1000,
    limit: 5,
    keyGenerator: (req) =>
      `${ipKeyGenerator(req.ip ?? "unknown")}:${String(req.params.slug ?? "")}`,
  });

  router.get("/events/:slug", asyncHandler(controller.event));
  router.get("/events/:slug/status", asyncHandler(controller.status));
  router.post("/events/:slug/access/redeem", redeemLimiter, asyncHandler(controller.redeem));
  router.post("/events/:slug/register", registerLimiter, asyncHandler(controller.register));

  return router;
}
