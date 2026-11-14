import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";
import { ERROR_CODES } from "../errors/error-codes.js";
import { ADMIN_CSRF_COOKIE } from "../modules/admin/shared/cookies.js";
import { safeEqualToken } from "../utils/token.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const csrfProtect: RequestHandler = (req, _res, next) => {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[ADMIN_CSRF_COOKIE];
  const headerToken = req.header("x-csrf-token");

  if (
    typeof cookieToken !== "string" ||
    typeof headerToken !== "string" ||
    !safeEqualToken(cookieToken, headerToken)
  ) {
    next(
      new AppError(
        403,
        ERROR_CODES.CSRF_INVALID,
        "La solicitud no incluye un token CSRF válido. Recarga la página e inténtalo de nuevo.",
      ),
    );
    return;
  }

  next();
};
