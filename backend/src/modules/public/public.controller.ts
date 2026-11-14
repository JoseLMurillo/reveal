import type { Request, Response } from "express";

import {
  eventSlugParamSchema,
  redeemAccessCodeSchema,
  registerParticipantSchema,
} from "@rollo/shared";

import { sendData } from "../../utils/http.js";
import { requestIpHash, requestUserAgent } from "../admin/shared/request-context.js";
import type { PublicService } from "./public.service.js";

function actionContext(req: Request) {
  return {
    ipHash: requestIpHash(req),
    userAgent: requestUserAgent(req),
  };
}

export function createPublicController(service: PublicService) {
  return {
    async event(req: Request, res: Response): Promise<void> {
      const { slug } = eventSlugParamSchema.parse(req.params);
      sendData(res, await service.event(slug));
    },

    async status(req: Request, res: Response): Promise<void> {
      const { slug } = eventSlugParamSchema.parse(req.params);
      sendData(res, await service.status(slug));
    },

    async redeem(req: Request, res: Response): Promise<void> {
      const { slug } = eventSlugParamSchema.parse(req.params);
      const input = redeemAccessCodeSchema.parse(req.body);
      sendData(res, await service.redeem(slug, input, actionContext(req)));
    },

    async register(req: Request, res: Response): Promise<void> {
      const { slug } = eventSlugParamSchema.parse(req.params);
      const input = registerParticipantSchema.parse(req.body);
      sendData(res, await service.register(slug, input, actionContext(req)), 201);
    },
  };
}
