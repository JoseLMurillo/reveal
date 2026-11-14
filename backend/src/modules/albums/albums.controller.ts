import type { Request, Response } from "express";

import {
  eventSlugParamSchema,
  photoIdParamSchema,
  publicEventDayQuerySchema,
  voteInputSchema,
} from "@rollo/shared";

import { sendData } from "../../utils/http.js";
import { currentParticipant } from "../participants/current-participant.js";
import type { AlbumsPublicService } from "./albums.service.js";

export function createAlbumsPublicController(service: AlbumsPublicService) {
  return {
    async gallery(req: Request, res: Response): Promise<void> {
      const { slug } = eventSlugParamSchema.parse(req.params);
      const query = publicEventDayQuerySchema.parse(req.query);
      sendData(res, await service.gallery(slug, query.day, req.participant ?? null));
    },

    async album(req: Request, res: Response): Promise<void> {
      const { slug } = eventSlugParamSchema.parse(req.params);
      const data = await service.album(slug);

      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      sendData(res, data);
    },

    async voteFeed(req: Request, res: Response): Promise<void> {
      const { slug } = eventSlugParamSchema.parse(req.params);
      const query = publicEventDayQuerySchema.parse(req.query);
      sendData(res, await service.voteFeed(slug, query.day, currentParticipant(req)));
    },

    async vote(req: Request, res: Response): Promise<void> {
      const { id } = photoIdParamSchema.parse(req.params);
      const input = voteInputSchema.parse(req.body);
      sendData(res, await service.vote(id, input, currentParticipant(req)));
    },
  };
}
