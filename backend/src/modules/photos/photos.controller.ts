import type { Request, Response } from "express";

import {
  confirmUploadSchema,
  photoIdParamSchema,
  photoListQuerySchema,
  releaseUploadSchema,
  uploadIntentSchema,
} from "@rollo/shared";

import { sendData, sendPaginated } from "../../utils/http.js";
import { currentParticipant } from "../participants/current-participant.js";
import type { PhotosService } from "./photos.service.js";

export function createPhotosController(service: PhotosService) {
  return {
    async uploadIntent(req: Request, res: Response): Promise<void> {
      const auth = currentParticipant(req);
      const input = uploadIntentSchema.parse(req.body);
      const result = await service.uploadIntent(auth, input);
      sendData(res, result, 201);
    },

    async confirm(req: Request, res: Response): Promise<void> {
      const auth = currentParticipant(req);
      const input = confirmUploadSchema.parse(req.body);
      sendData(res, await service.confirm(auth, input));
    },

    async release(req: Request, res: Response): Promise<void> {
      const auth = currentParticipant(req);
      const input = releaseUploadSchema.parse(req.body);
      sendData(res, await service.release(auth, input));
    },

    async listMine(req: Request, res: Response): Promise<void> {
      const auth = currentParticipant(req);
      const query = photoListQuerySchema.parse(req.query);
      const result = await service.listMine(auth, query);

      sendPaginated(res, result.rows, {
        page: query.page,
        limit: query.limit,
        total: result.total,
      });
    },

    async deleteMine(req: Request, res: Response): Promise<void> {
      const auth = currentParticipant(req);
      const { id } = photoIdParamSchema.parse(req.params);
      sendData(res, await service.deleteMine(auth, id));
    },
  };
}
