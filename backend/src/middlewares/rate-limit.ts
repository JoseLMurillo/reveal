import { rateLimit, type Options } from "express-rate-limit";
import type { RequestHandler } from "express";

import type { Env } from "../config/env.js";
import { ERROR_CODES } from "../errors/error-codes.js";
import { AppError } from "../errors/app-error.js";

export type RateLimitOptions = {
  windowMs: number;
  limit: number;
  message?: string;
  keyGenerator?: Options["keyGenerator"];
};

export function createRateLimiter(env: Env, options: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => env.isTest,
    keyGenerator: options.keyGenerator,
    handler: (_req, res) => {
      const error = new AppError(
        429,
        ERROR_CODES.RATE_LIMITED,
        options.message ?? "Demasiadas peticiones. Espera un momento y vuelve a intentarlo.",
      );

      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          requestId: res.getHeader("X-Request-Id") ?? "unknown",
        },
      });
    },
  });
}
