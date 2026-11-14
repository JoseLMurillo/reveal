import { AppError, badRequest, conflict, forbidden, notFound } from "../errors/app-error.js";
import { ERROR_CODES } from "../errors/error-codes.js";

type DatabaseError = {
  message?: string;
  code?: string;
  details?: string;
};

function messageOf(error: DatabaseError | null): string {
  return `${error?.message ?? ""} ${error?.details ?? ""}`;
}

function detailsOf(error: DatabaseError | null): Record<string, unknown> | undefined {
  if (!error?.details) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(error.details) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Las RPC lanzan excepciones con un token estable. Se traducen a errores HTTP
 * sin filtrar detalles de PostgreSQL al cliente.
 */
export function mapDatabaseError(
  error: DatabaseError | null | undefined,
  fallback: string,
): AppError {
  const message = messageOf(error ?? null);

  if (message.includes("ACCESS_CODE_INVALID")) {
    return new AppError(
      401,
      ERROR_CODES.ACCESS_CODE_INVALID,
      "El enlace de acceso no es válido o ya no está activo.",
    );
  }

  if (message.includes("NAME_REQUIRED")) {
    return new AppError(
      400,
      ERROR_CODES.NAME_REQUIRED,
      "Escribe tu nombre para entrar a este evento.",
    );
  }

  if (message.includes("SELF_REGISTRATION_DISABLED")) {
    return new AppError(
      403,
      ERROR_CODES.SELF_REGISTRATION_DISABLED,
      "Este evento no permite el auto-registro.",
    );
  }

  if (message.includes("PARTICIPANT_LIMIT_REACHED")) {
    return conflict(
      ERROR_CODES.PARTICIPANT_LIMIT_REACHED,
      "El evento alcanzó el cupo máximo de participantes.",
    );
  }

  if (message.includes("QUOTA_EXCEEDED")) {
    return conflict(
      ERROR_CODES.QUOTA_EXCEEDED,
      "No tienes suficientes disparos disponibles para esta carga.",
      detailsOf(error ?? null),
    );
  }

  if (message.includes("PARTICIPANT_INACTIVE")) {
    return forbidden("Este participante está deshabilitado.");
  }

  if (message.includes("SESSION_EXPIRED")) {
    return conflict(ERROR_CODES.SESSION_EXPIRED, "La sesión de carga expiró. Vuelve a intentarlo.");
  }

  if (message.includes("SESSION_NOT_FOUND")) {
    return notFound("La sesión de carga no existe.");
  }

  if (message.includes("EVENT_OUT_OF_DATES")) {
    return conflict(
      ERROR_CODES.EVENT_OUT_OF_DATES,
      "El evento está fuera del rango de fechas permitido.",
    );
  }

  if (message.includes("EVENT_NOT_ACTIVE")) {
    return conflict(ERROR_CODES.EVENT_NOT_ACTIVE, "El evento no está activo en este momento.");
  }

  if (message.includes("EVENT_NOT_FOUND")) {
    return notFound("El evento no existe.");
  }

  if (message.includes("PARTICIPANT_NOT_FOUND")) {
    return notFound("El participante no existe.");
  }

  if (message.includes("INVALID_SESSION_TTL")) {
    return badRequest("La duración de la sesión no es válida.");
  }

  return new AppError(500, ERROR_CODES.INTERNAL_ERROR, fallback, {
    expose: false,
    cause: error ?? undefined,
  });
}
