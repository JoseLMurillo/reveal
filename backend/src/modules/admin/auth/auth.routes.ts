import { Router } from "express";
import { ipKeyGenerator } from "express-rate-limit";

import type { Env } from "../../../config/env.js";
import { createAuthAdmin } from "../../../middlewares/auth-admin.js";
import { csrfProtect } from "../../../middlewares/csrf.js";
import { createOriginGuard } from "../../../middlewares/origin.js";
import { createRateLimiter } from "../../../middlewares/rate-limit.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import type { AuthService } from "./auth.service.js";
import { createAuthController } from "./auth.controller.js";

export function createAuthRouter(env: Env, auth: AuthService): Router {
  const router = Router();
  const controller = createAuthController(env, auth);
  const authAdmin = createAuthAdmin(auth);
  const originGuard = createOriginGuard(env);

  const loginLimiter = createRateLimiter(env, {
    windowMs: 15 * 60 * 1000,
    limit: 5,
    keyGenerator: (req) => {
      const email =
        typeof req.body === "object" &&
        req.body !== null &&
        "email" in req.body &&
        typeof (req.body as { email?: unknown }).email === "string"
          ? (req.body as { email: string }).email.trim().toLowerCase()
          : "";
      return `${ipKeyGenerator(req.ip ?? "unknown")}:${email}`;
    },
  });

  const passwordLimiter = createRateLimiter(env, {
    windowMs: 15 * 60 * 1000,
    limit: 5,
    keyGenerator: (req) => req.admin?.admin.id ?? ipKeyGenerator(req.ip ?? "unknown"),
  });

  router.post("/login", originGuard, loginLimiter, asyncHandler(controller.login));
  router.get("/me", authAdmin, asyncHandler(controller.me));
  router.post("/logout", authAdmin, csrfProtect, asyncHandler(controller.logout));
  router.post(
    "/password",
    authAdmin,
    csrfProtect,
    passwordLimiter,
    asyncHandler(controller.changePassword),
  );

  return router;
}
