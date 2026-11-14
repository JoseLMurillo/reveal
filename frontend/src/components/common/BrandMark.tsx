import { Aperture } from "lucide-react";

import { cn } from "@/utils/cn";

type BrandMarkProps = {
  className?: string;
  compact?: boolean;
  tone?: "default" | "inverted";
};

export function BrandMark({ className, compact = false, tone = "default" }: BrandMarkProps) {
  const inverted = tone === "inverted";

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-10 place-items-center rounded-sm border shadow-card",
          inverted
            ? "border-paper-raised bg-paper-raised text-ink"
            : "border-ink bg-ink text-paper-raised",
        )}
      >
        <Aperture className="size-5" strokeWidth={1.75} />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[1.65rem] font-semibold tracking-[-0.03em]",
            inverted ? "text-paper-raised" : "text-ink",
          )}
        >
          Rollo
        </span>
        {compact ? null : (
          <span
            className={cn(
              "mt-1 font-mono text-[0.56rem] uppercase tracking-[0.22em]",
              inverted ? "text-paper-raised/60" : "text-brown",
            )}
          >
            Álbum colectivo
          </span>
        )}
      </span>
    </span>
  );
}
