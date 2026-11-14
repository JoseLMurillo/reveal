import { ERROR_CODES, type ErrorCode } from "./error-codes.js";

export type ErrorDetails = Record<string, unknown> | unknown[] | undefined;

export class AppError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode;
  public readonly details: ErrorDetails;
  public readonly expose: boolean;

  public constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options: { details?: ErrorDetails; expose?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.expose = options.expose ?? true;
  }
}

export const badRequest = (message: string, details?: ErrorDetails): AppError =>
  new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, { details });

export const unauthorized = (message = "Necesitas una sesión válida."): AppError =>
  new AppError(401, ERROR_CODES.UNAUTHORIZED, message);

export const forbidden = (message = "No tienes permiso para realizar esta acción."): AppError =>
  new AppError(403, ERROR_CODES.FORBIDDEN, message);

export const notFound = (message = "El recurso no existe."): AppError =>
  new AppError(404, ERROR_CODES.NOT_FOUND, message);

export const conflict = (code: ErrorCode, message: string, details?: ErrorDetails): AppError =>
  new AppError(409, code, message, { details });

export const internalError = (cause?: unknown): AppError =>
  new AppError(500, ERROR_CODES.INTERNAL_ERROR, "Ocurrió un error inesperado.", {
    expose: false,
    cause,
  });
