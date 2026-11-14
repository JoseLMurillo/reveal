import type { RequestHandler } from "express";

import { unauthorized } from "../errors/app-error.js";
import type { ParticipantService } from "../modules/participants/participants.service.js";

function bearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

export function createAuthParticipant(service: ParticipantService): RequestHandler {
  return (req, _res, next) => {
    const token = bearerToken(req.header("authorization"));

    if (!token) {
      next(unauthorized());
      return;
    }

    service
      .authenticate(token)
      .then((authenticated) => {
        req.participant = authenticated;
        next();
      })
      .catch(next);
  };
}
