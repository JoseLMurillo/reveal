import type { RequestHandler } from "express";

import type { Env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { ERROR_CODES } from "../errors/error-codes.js";

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Defensa CSRF adicional: si el navegador envía Origin, debe ser exactamente
 * el frontend configurado. Las peticiones sin Origin (CLI, pruebas) se aceptan
 * porque no transportan cookies de navegador y siguen exigiendo CSRF.
 */
export function createOriginGuard(env: Env): RequestHandler {
  const allowed = normalizeOrigin(env.FRONTEND_URL);

  return (req, _res, next) => {
    const origin = req.header("origin");

    if (origin && normalizeOrigin(origin) !== allowed) {
      next(
        new AppError(403, ERROR_CODES.CSRF_INVALID, "El origen de la solicitud no está permitido."),
      );
      return;
    }

    next();
  };
}
