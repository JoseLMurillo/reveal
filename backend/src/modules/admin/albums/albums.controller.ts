import { pipeline } from "node:stream/promises";

import type { Request, Response } from "express";

import {
  albumExportQuerySchema,
  eventIdParamSchema,
  generateAlbumSchema,
  updateAlbumSchema,
} from "@rollo/shared";

import { sendData } from "../../../utils/http.js";
import { currentAdmin } from "../shared/current-admin.js";
import type { AdminAlbumsService } from "./albums.service.js";

export function createAdminAlbumsController(service: AdminAlbumsService) {
  return {
    async detail(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      sendData(res, await service.detail(admin, id));
    },

    async generate(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const input = generateAlbumSchema.parse(req.body);
      sendData(res, await service.generate(admin, id, input));
    },

    async update(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const input = updateAlbumSchema.parse(req.body);
      sendData(res, await service.update(admin, id, input));
    },

    async download(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const query = albumExportQuerySchema.parse(req.query);
      const zip = await service.exportZip(admin, id, query);

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${zip.filename.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
      );
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Export-Count", String(zip.count));
      await pipeline(zip.stream, res);
    },
  };
}
