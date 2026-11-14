import type { Request, Response } from "express";

import {
  adminEventListQuerySchema,
  cancelEventSchema,
  coverConfirmSchema,
  coverUploadIntentSchema,
  createEventSchema,
  deleteEventSchema,
  eventIdParamSchema,
  qrQuerySchema,
  updateEventSchema,
} from "@rollo/shared";

import { sendData, sendPaginated } from "../../../utils/http.js";
import { currentAdmin } from "../shared/current-admin.js";
import type { EventsService } from "./events.service.js";

export function createEventsController(events: EventsService) {
  return {
    async list(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const query = adminEventListQuerySchema.parse(req.query);
      const result = await events.list(admin, query);

      sendPaginated(res, result.rows, {
        page: query.page,
        limit: query.limit,
        total: result.total,
      });
    },

    async detail(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      sendData(res, await events.detail(admin, id));
    },

    async create(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const input = createEventSchema.parse(req.body);
      sendData(res, await events.create(admin, input), 201);
    },

    async update(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const input = updateEventSchema.parse(req.body);
      sendData(res, await events.update(admin, id, input));
    },

    async schedule(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      sendData(res, await events.schedule(admin, id));
    },

    async activate(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      sendData(res, await events.activate(admin, id));
    },

    async finish(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      sendData(res, await events.finish(admin, id));
    },

    async cancel(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const input = cancelEventSchema.parse(req.body);
      sendData(res, await events.cancel(admin, id, input));
    },

    async duplicate(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      sendData(res, await events.duplicate(admin, id), 201);
    },

    async remove(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const input = deleteEventSchema.parse(req.body);
      sendData(res, await events.remove(admin, id, input.confirmName), 202);
    },

    async coverIntent(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const input = coverUploadIntentSchema.parse(req.body);
      sendData(res, await events.coverIntent(admin, id, input), 201);
    },

    async confirmCover(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const input = coverConfirmSchema.parse(req.body);
      sendData(res, await events.confirmCover(admin, id, input.storagePath));
    },

    async deleteCover(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      await events.deleteCover(admin, id);
      res.status(204).send();
    },

    async qr(req: Request, res: Response): Promise<void> {
      const admin = currentAdmin(req).admin;
      const { id } = eventIdParamSchema.parse(req.params);
      const query = qrQuerySchema.parse(req.query);
      const result = await events.qr(admin, id, query);

      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader(
        "Content-Disposition",
        `${query.download === "1" ? "attachment" : "inline"}; filename="${result.filename}"`,
      );
      res.status(200).send(result.body);
    },
  };
}
