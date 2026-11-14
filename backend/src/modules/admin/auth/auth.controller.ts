import type { Request, Response } from "express";

import { changePasswordSchema, loginSchema } from "@rollo/shared";

import type { Env } from "../../../config/env.js";
import { sendData } from "../../../utils/http.js";
import type { AuthService } from "./auth.service.js";
import { clearAdminCookies, setAdminCookies } from "../shared/cookies.js";
import { currentAdmin } from "../shared/current-admin.js";
import { requestIpHash, requestUserAgent } from "../shared/request-context.js";

export function createAuthController(env: Env, auth: AuthService) {
  const context = (req: Request) => ({
    ipHash: requestIpHash(req),
    userAgent: requestUserAgent(req),
  });

  return {
    async login(req: Request, res: Response): Promise<void> {
      const input = loginSchema.parse(req.body);
      const result = await auth.login(input, context(req));

      setAdminCookies(
        res,
        env,
        result.sessionToken,
        result.csrfToken,
        env.ADMIN_SESSION_TTL_SECONDS,
      );

      sendData(res, {
        admin: {
          id: result.admin.id,
          email: result.admin.email,
          displayName: result.admin.displayName,
          role: result.admin.role,
        },
        csrfToken: result.csrfToken,
        session: {
          id: result.sessionId,
          expiresAt: result.expiresAt,
          idleExpiresAt: result.idleExpiresAt,
        },
      });
    },

    async me(req: Request, res: Response): Promise<void> {
      const authenticated = currentAdmin(req);

      sendData(res, {
        admin: {
          id: authenticated.admin.id,
          email: authenticated.admin.email,
          displayName: authenticated.admin.displayName,
          role: authenticated.admin.role,
          isActive: authenticated.admin.isActive,
        },
        session: {
          id: authenticated.sessionId,
          expiresAt: authenticated.expiresAt,
          idleExpiresAt: authenticated.idleExpiresAt,
        },
      });
    },

    async logout(req: Request, res: Response): Promise<void> {
      await auth.logout(currentAdmin(req), context(req));
      clearAdminCookies(res, env);
      res.status(204).send();
    },

    async changePassword(req: Request, res: Response): Promise<void> {
      const input = changePasswordSchema.parse(req.body);
      await auth.changePassword(currentAdmin(req), input, context(req));
      clearAdminCookies(res, env);
      res.status(204).send();
    },
  };
}
