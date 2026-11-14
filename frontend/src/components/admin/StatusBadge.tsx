import type { EventStatus } from "@rollo/shared";

import { cn } from "@/utils/cn";
import { eventStatusLabel } from "@/utils/event-status";

const STYLES: Record<EventStatus, string> = {
  draft: "border-brown/30 bg-cream/60 text-brown",
  scheduled: "border-warning/30 bg-warning/10 text-warning",
  active: "border-success/35 bg-success/10 text-success",
  finished: "border-border bg-paper text-muted",
  cancelled: "border-red/30 bg-red/10 text-red",
};

export function StatusBadge({ status, className }: { status: EventStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.1em]",
        STYLES[status],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {eventStatusLabel(status)}
    </span>
  );
}
