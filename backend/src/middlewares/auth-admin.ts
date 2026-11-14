import type { RequestHandler } from "express";

import type { AuthService } from "../modules/admin/auth/auth.service.js";
import { ADMIN_SESSION_COOKIE } from "../modules/admin/shared/cookies.js";

export function createAuthAdmin(auth: AuthService): RequestHandler {
  return (req, _res, next) => {
    const token = req.cookies?.[ADMIN_SESSION_COOKIE];

    auth
      .authenticate(typeof token === "string" ? token : "")
      .then((authenticated) => {
        req.admin = authenticated;
        next();
      })
      .catch(next);
  };
}
