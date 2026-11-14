import type { Request, Response } from "express";

import { updateParticipantSchema } from "@rollo/shared";

import { sendData } from "../../utils/http.js";
import { currentParticipant } from "./current-participant.js";
import type { ParticipantService } from "./participants.service.js";

export function createParticipantController(service: ParticipantService) {
  return {
    async me(req: Request, res: Response): Promise<void> {
      const auth = currentParticipant(req);
      sendData(res, await service.me(auth));
    },

    async updateMe(req: Request, res: Response): Promise<void> {
      const auth = currentParticipant(req);
      const input = updateParticipantSchema.parse(req.body);
      sendData(res, await service.updateMe(auth, input));
    },

    async quota(req: Request, res: Response): Promise<void> {
      const auth = currentParticipant(req);
      sendData(res, await service.quota(auth));
    },
  };
}
