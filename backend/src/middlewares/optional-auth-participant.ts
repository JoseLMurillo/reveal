import type { RequestHandler } from "express";

import type { ParticipantService } from "../modules/participants/participants.service.js";

function bearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

/**
 * Adjunta la sesión de participante cuando el token es válido. Si no hay
 * token o ya expiró, la petición continúa como anónima. Esto permite que una
 * galería pública siga funcionando con una sesión vieja en localStorage.
 * Los endpoints que exigen identidad usan `createAuthParticipant`.
 */
export function createOptionalAuthParticipant(service: ParticipantService): RequestHandler {
  return (req, _res, next) => {
    const token = bearerToken(req.header("authorization"));

    if (!token) {
      next();
      return;
    }

    service
      .authenticate(token)
      .then((authenticated) => {
        req.participant = authenticated;
        next();
      })
      .catch(() => {
        next();
      });
  };
}
