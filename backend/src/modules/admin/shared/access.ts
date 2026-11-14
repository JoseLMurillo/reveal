import type { AdminRole } from "@rollo/shared";

import { forbidden } from "../../../errors/app-error.js";
import type { AdminRecord, EventRecord } from "./types.js";

export function isOwner(role: AdminRole): boolean {
  return role === "owner";
}

export function canAccessEvent(admin: AdminRecord, event: EventRecord): boolean {
  return admin.role === "owner" || event.adminId === admin.id;
}

export function assertEventAccess(admin: AdminRecord, event: EventRecord): void {
  if (!canAccessEvent(admin, event)) {
    throw forbidden("Este evento pertenece a otro administrador.");
  }
}
