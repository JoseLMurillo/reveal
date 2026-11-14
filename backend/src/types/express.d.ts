import type { Logger } from "pino";

import type { AuthenticatedAdmin } from "../modules/admin/shared/types.js";
import type { AuthenticatedParticipant } from "../modules/participants/participants.service.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: Logger;
      admin?: AuthenticatedAdmin;
      participant?: AuthenticatedParticipant;
    }
  }
}

export {};
