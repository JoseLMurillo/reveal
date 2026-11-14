import type { Request, Response } from "express";

import {
  accessCodeActionSchema,
  adminBulkCreateParticipantsSchema,
  adminCreateParticipantSchema,
  adminParticipantListQuerySchema,
  adminUpdateParticipantSchema,
  eventIdParamSchema,
  participantIdParamSchema,
} from "@rollo/shared";

import { sendData, sendPaginated } from "../../../utils/http.js";
import { currentAdmin } from "../shared/current-admin.js";
import type { AdminParticipantsService } from "./participants.service.js";

export function createAdminParticipantsController(service: AdminParticipantsService) {
  return {
    async list(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const query = adminParticipantListQuerySchema.parse(req.query);
      const result = await service.list(admin, id, query);

      sendPaginated(res, result.rows, {
        page: query.page,
        limit: query.limit,
        total: result.total,
      });
    },

    async create(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const input = adminCreateParticipantSchema.parse(req.body);
      sendData(res, await service.create(admin, id, input), 201);
    },

    async bulkCreate(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const input = adminBulkCreateParticipantsSchema.parse(req.body);
      sendData(res, await service.bulkCreate(admin, id, input), 201);
    },

    async update(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { participantId } = participantIdParamSchema.parse(req.params);
      const input = adminUpdateParticipantSchema.parse(req.body);
      sendData(res, await service.update(admin, participantId, input));
    },

    async regenerateAccessCode(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { participantId } = participantIdParamSchema.parse(req.params);
      const input = accessCodeActionSchema.parse(req.body ?? {});
      sendData(res, await service.regenerateAccessCode(admin, participantId, input));
    },

    async revokeAccessCode(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { participantId } = participantIdParamSchema.parse(req.params);
      const input = accessCodeActionSchema.parse(req.body ?? {});
      sendData(res, await service.revokeAccessCode(admin, participantId, input));
    },
  };
}
