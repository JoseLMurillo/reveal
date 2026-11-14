import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import type { Env } from "../config/env.js";
import { AppError, internalError } from "../errors/app-error.js";
import { ERROR_CODES } from "../errors/error-codes.js";
import type { Logger } from "pino";

function zodDetails(error: ZodError): Record<string, unknown> {
  return {
    fields: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    })),
  };
}

export function createErrorHandler(env: Env, logger: Logger): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    let appError: AppError;

    if (error instanceof AppError) {
      appError = error;
    } else if (error instanceof ZodError) {
      appError = new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Revisa los datos enviados.", {
        details: zodDetails(error),
      });
    } else if (
      error instanceof SyntaxError &&
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: number }).status === 400
    ) {
      appError = new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        "El cuerpo de la petición no es JSON válido.",
      );
    } else {
      appError = internalError(error);
    }

    const requestId = req.requestId ?? "unknown";

    if (appError.status >= 500) {
      logger.error(
        {
          err: error,
          requestId,
          method: req.method,
          path: req.originalUrl,
        },
        "Error no controlado",
      );
    } else if (!env.isTest) {
      logger.debug(
        {
          code: appError.code,
          requestId,
          method: req.method,
          path: req.originalUrl,
        },
        "Petición rechazada",
      );
    }

    res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.expose ? appError.message : "Ocurrió un error inesperado.",
        ...(appError.expose && appError.details !== undefined ? { details: appError.details } : {}),
        requestId,
      },
    });
  };
}
