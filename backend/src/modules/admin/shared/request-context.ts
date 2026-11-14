import { createHash } from "node:crypto";

import type { Request } from "express";

/**
 * La auditoría no guarda la IP en claro. El hash permite correlacionar
 * intentos sin almacenar un dato personal directamente identificable.
 */
export function requestIpHash(req: Request): string | null {
  const ip = req.ip;
  if (!ip) {
    return null;
  }

  return createHash("sha256").update(ip, "utf8").digest("hex");
}

export function requestUserAgent(req: Request): string | null {
  const value = req.header("user-agent");
  return value ? value.slice(0, 512) : null;
}
