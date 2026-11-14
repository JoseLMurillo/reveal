import type { Request } from "express";

import { unauthorized } from "../../errors/app-error.js";
import type { AuthenticatedParticipant } from "./participants.service.js";

export function currentParticipant(req: Request): AuthenticatedParticipant {
  if (!req.participant) {
    throw unauthorized();
  }

  return req.participant;
}
