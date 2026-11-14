import type { Request, Response } from "express";

import {
  adminEventActivityQuerySchema,
  adminPhotoDownloadParamSchema,
  adminPhotoListQuerySchema,
  eventIdParamSchema,
  photoIdParamSchema,
} from "@rollo/shared";

import { sendData, sendPaginated } from "../../../utils/http.js";
import { currentAdmin } from "../shared/current-admin.js";
import type { AdminPhotosService } from "./photos.service.js";

export function createAdminPhotosController(service: AdminPhotosService) {
  return {
    async list(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const query = adminPhotoListQuerySchema.parse(req.query);
      const result = await service.list(admin, id, query);

      sendPaginated(res, result.rows, {
        page: query.page,
        limit: query.limit,
        total: result.total,
      });
    },

    async remove(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = photoIdParamSchema.parse(req.params);
      sendData(res, await service.remove(admin, id));
    },

    async download(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { eventId, photoId } = adminPhotoDownloadParamSchema.parse(req.params);
      const url = await service.downloadUrl(admin, eventId, photoId);

      res.setHeader("Cache-Control", "no-store");
      res.redirect(302, url);
    },

    async stats(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      sendData(res, await service.stats(admin, id));
    },

    async activity(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const query = adminEventActivityQuerySchema.parse(req.query);
      const result = await service.activity(admin, id, query);

      sendPaginated(res, result.rows, {
        page: query.page,
        limit: query.limit,
        total: result.total,
      });
    },
  };
}
