import type { Request } from "express";

import { unauthorized } from "../../../errors/app-error.js";
import type { AuthenticatedAdmin } from "./types.js";

export function currentAdmin(req: Request): AuthenticatedAdmin {
  if (!req.admin) {
    throw unauthorized();
  }

  return req.admin;
}
