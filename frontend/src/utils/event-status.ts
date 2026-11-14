import type { EventStatus } from "@rollo/shared";

const LABELS: Record<EventStatus, string> = {
  draft: "Borrador",
  scheduled: "Programado",
  active: "Activo",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

export function eventStatusLabel(status: EventStatus): string {
  return LABELS[status];
}
